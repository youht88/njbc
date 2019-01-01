const fs=require('fs')
const moment  = require('moment')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const {NodeVM,VMScript} = require('vm2')
const Block = require('./block.js').Block
const Transaction = require('./transaction.js').Transaction
const Wallet = require('./wallet.js').Wallet
const EventEmitter = require("events")

class Contract{
  constructor(args={}){
    this.contractAddr = ""
    this.txHash  = ""
    this.script  = args.script  ||""
    this.contractHash = args.contractHash ||""
    this.assets  = args.assets||{}
    this.owner  = ""
    this.version=""
    
    this.isDeployed = false
    this.caller = args.inAddr || ""
    this.check()
    this.sandbox = this.setSandbox(args.sandbox||{})
    
    let bin = utils.bufferlib.toBin(JSON.stringify(this))
    console.log("[constructor]",JSON.stringify(this),"[bin]",bin,"[bin length]",bin.length)
  }
  deployed(){
    if (this.isDeployed) return true
    let contractDict = global.blockchain.findContract(this.contractHash)
    if (!contractDict) return false
    this.isDeployed = true
    this.blockHash    = contractDict.blockHash
    this.blockIndex   = contractDict.blockIndex
    this.blockNonce   = contractDict.blockNonce
    this.txHash       = contractDict.txHash
    this.contractAddr = contractDict.contractAddr
    this.script       = contractDict.script
    this.assets       = contractDict.assets
    this.owner        = contractDict.owner
    return true      
  }
  deploy({owner,amount,lockTime=0}){
    if (!this.check()) return
    let script = this.script
    let assets = this.assets   
    global.emitter.emit("deployContract",{owner,amount,script,assets,lockTime})  
  }
  check(){
    if (!this.script && !this.contractHash) throw new Error("空的合约脚本")
    if (this.script){
      if (this.contractHash) {
        if (utils.hashlib.hash160(this.script) != this.contractHash) 
          throw new Error("合约与合约摘要不匹配")
      }else{
        this.contractHash = utils.hashlib.hash160(this.script)
      }
      this.version      = Contract.getVersion(this.script)
      //检查合约语法
      try{
        new VMScript(this.script)
      }catch(error){
        throw error
      }  
      //标记deployed 和 owner
      this.deployed() 
      //throw new Error(`合约${this.contractHash}尚未部署`)  
    }
    if (!this.script && this.contractHash){
      //标记deployed 和 owner
      if (!this.deployed()) throw new Error(`合约${this.contractHash}尚未部署`)
    }
    return true
  }
  run(cb=null){
    let result1,result2,isCallback=false
    try{
      const vm = new NodeVM({
           sandbox:this.sandbox,
           nesting:true,
           require:{
             external:true
           },
           timeout:global.contractTimeout,
           //lineOffset:73,
           //wrapper:'none'
        })
      vm.freeze(this.sandbox,"sandbox")
      //result1 = vm.run(this.script)
      //console.log(result1)
      //return result1
      
      let fun =vm.run(`module.exports = function(__callback) { ${this.script} }`)
      result1 = fun((x)=>{
         isCallback=true
         if (cb)
           result2 = cb(x)
         else {
           result2 = x
         }
      })
      if (result1 && typeof result1.then=="function"){  //返回的是promise
        return result1.then(x=>{
                  logger.info("处理异步返回",x)
                  return x
                })
               .catch(error=>{
                  logger.error("处理异步错误",error.stack)
                  throw error
                })
      }else{  //返回的return 或 calback调用
        if (!isCallback){
          logger.info("处理同步返回",result1)
          return result1
        }else{
          logger.info("处理同步callback调用",result2)
          return result2
        }
      }
    }catch(error){
      logger.error("处理同步错误",error.stack)
      throw error
    }
  }

  setSandbox(sandbox){
    let that = this
    try{
      sandbox.async   = require("async")
      sandbox.crypto  = require('./utils.js').crypto
      sandbox.hashlib = require('./utils.js').hashlib
      sandbox.bufferlib  = require('./utils.js').bufferlib
      sandbox.request = require('request')
      sandbox.assert = require('assert')
      sandbox.emitter = new EventEmitter()
      sandbox.nowE8   = (timestamp=null,formatStr=null)=>{
        if (timestamp){
          if (formatStr)
            return moment(new Date(timestamp+28800000)).format(formatStr)  
          else{ 
            if (typeof timestamp == "string"){ 
              return moment(new Date().getTime()+28800000).format(timestamp)
            }else {
              return new Date(timestamp+28800000)
            }
          }
        }else{
          if (formatStr)
            return moment(new Date().getTime()+28800000).format(formatStr)
          else
            return new Date(new Date().getTime()+28800000)
        }
      }
      sandbox.version = (ver)=>{Contract.checkVersion(ver,this.version)}
      sandbox.callback = (data)=>{
        console.log("callback函数返回",data)
      }
      
      sandbox.getInstance = (hash,caller)=>{
        const contractDict = this.sandbox.getContract(hash)
        if (!contractDict) return null
        let version = Contract.getVersion(contractDict.script)
        Contract.checkVersion(this.version,version)
        const parentContract = new Contract({script:contractDict.script,inAddr:caller})
        const result = parentContract.run()
        return result
        /*return parentContract
        return { 
            isDeployed : true,
            blockHash    : contractDict.blockHash,
            blockIndex   : contractDict.blockIndex,
            blockNonce   : contractDict.blockNonce,
            txHash       : contractDict.txHash,
            contractAddr : contractDict.contractAddr,
            contractHash : hash,
            script       : contractDict.script,
            assets       : contractDict.assets,
            owner        : contractDict.owner,
            version      : version,
        */
      }
      sandbox["getContract"] = (contractHash)=>{
        let contract = global.blockchain.findContract(contractHash)
        let contractSlim
        if (!Array.isArray(contract))
          return contract
        contractSlim = contract.map(item=>{
          return {contractHash:item.contractHash,
                  blockIndex:item.blockIndex,
                  contractAddr:item.contractAddr,
                  owner:item.owner,
                  assets:item.assets}
        })
        return contractSlim
      }
      sandbox["ajax"] = async (url,options)=>{
        /******  options struct  ********
          method:  'get' or 'post'
        ******/
        return new Promise((resolve,reject)=>{
          this.sandbox.request(url, function (error, response, body) {
            if(error) return reject(error)
            if (!error && response.statusCode == 200) {
              resolve(body) 
            }else{
              resolve(response)
            }
          })
        })
      }
      sandbox["Contract"] = class vmContract{
        constructor(args){
          this.contractAddr = (args)?args.contractAddr:that.contractAddr
          this.contractHash = (args)?args.contractHash:that.contractHash
          this.txHash  = (args)?args.txHash:that.txHash
          this.owner   = (args)?args.owner :that.owner
          this.assets  = (args)?args.assets:that.assets
          this.script  = (args)?args.script:that.script
          this.isDeployed = (args)?args.isDeployed:that.isDeployed
          this.blockHash  = (args)?args.blockHash :that.blockHash
          this.blockIndex = (args)?args.blockIndex:that.blockIndex
          this.blockNonce = (args)?args.blockNonce:that.blockNonce
          this.version    = (args)?args.version   :that.version
          this.caller     = (args)?args.caller    :that.caller
        }
      
        getBlock(indexOrHash){
          try{
            if (typeof(indexOrHash)=="string"){
              return blockchain.findBlockByHash(indexOrHash)
            }else{
              return blockchain.findBlockByIndex(indexOrHash)
            }
          }catch(error){
            throw error
          }
        }
        getLastBlock(){
          return blockchain.lastblock()
        }
        getMaxIndex(){
          return blockchain.maxindex()
        }
        getTransaction(hash){
          return blockchain.findTransaction(hash)
        }
        async getTxPool(){
          return Transaction.getTxPool()
        }
        async getAccount(addressOrName){
          if (!addressOrName)
            return Wallet.getAll()
          let  wallet = await new Wallet(addressOrName).catch(error=>{throw error})
          return {name:wallet.name,address:wallet.address,key:wallet.key}
        }
        async getBalance(address){
          if (!address) address=this.contractAddr
          if (!Wallet.isAddress(address)){
            let wallet = await new Wallet(address)
                          .catch((error)=>{throw error})
            address = wallet.address
          }
          return blockchain.utxo.getBalance(address)
        }
        async getBalancePaid(outAddr){
          let amount = await blockchain.findBalanceFromContract({
            contractHash:this.contractHash,outAddr:outAddr}).catch((error)=>{throw error})
          logger.warn(`the amount is ${amount}`)
          return amount
        }
        async payTo(to,amount,assets={},lockTime=0){
          return new Promise((resolve,reject)=>{
            global.emitter.emit("payTo",{
              contractAddr:this.contractAddr,
              to          :to,
              amount      :amount,
              assets      :assets,
              lockTime : lockTime
            },(err,result)=>{
              if (err) reject(err)
              resolve(result)
              logger.warn(`合约支付 ${amount} 给 ${to}的交易已提交`,result)
            })
          })
        }
        preNewTransaction(inPubkey,outAddr,amount){
          if (!inPubkey){ //使用合约账户
          }
          return Transaction.preNewTransaction(inPubkey,outAddr,amount,blockchain.utxo)      
        }
        async newRawTransaction(raw){
          if (global.node)
            return Transaction.newRawTransaction(raw,global.node.tradeUTXO)
        }
        async set(assets={},caller=null,amount=0,encrypt=false,lockTime=0){
          return new Promise(async (resolve,reject)=>{
            if (that.caller && !caller) caller = that.caller
            if (!caller)  return reject(new Error("必须指定caller地址"))
            let account = await new Wallet(caller).catch(error=>{return reject(error)})
            if (encrypt) {
              assets = utils.ecc.enCipher(assets,account.key.prvkey[0])
            }
            global.emitter.emit("trade",{
                from      :account.address,
                to        :this.contractAddr,
                amount    :amount,
                assets    :{},
                lockTime : lockTime
              },(err1,result1)=>{
                if (err1) return reject(err1)
                logger.warn(`${account.address}支付给${this.contractAddr}的交易已提交,txHash=${result1}`)
                global.emitter.emit("setAssets",{
                    from      :this.contractAddr,
                    to        :account.address,
                    amount    :0,
                    assets    :assets,
                    lockTime  : lockTime
                  },(err2,result2)=>{
                    if (err2) return reject(err2)
                    resolve([result1,result2])
                    logger.warn(`更新资源 ${JSON.stringify(assets)} 到 ${account.address}的交易已提交,txHash=${[result1,result2]}`)
                })
            })
          })
        }
        async get(key=null,toAddr=null,list=false){
          return new Promise(async (resolve,reject)=>{
            if (!this.isDeployed) return resolve({})
            let assets = await global.blockchain.findContractAssets({
              contractHash:this.contractHash,key:key,toAddr:toAddr,list:list}).catch(error=>{
                reject(error)
              })
            resolve(assets)
          })
        }
      } //define Contract class
      return sandbox
    }catch(error){
      throw error
    }
  }
  static getVersion(script){
    let str = script.split("\n")[0].trim()
    if(str.match(/^version\(/)){
      return /\(([^()]+)\)/g.exec(str)[1].replace(/\"/g,"")
    }else {
      return "*"
    }
  }

  static checkVersion(ver1="*",ver2="*"){
    let tbase=10
    let vNum=[0,0,0]
    let base=[10,10]
    let sign=[null,null]
    let nonce=null
    let ver3
    if (ver1=="*") ver1="0.0.0"
    if (ver2=="*") ver2=ver1
    ver1=ver1.split('.')
    ver2=ver2.split('.')
    let vers = [ver1,ver2]
    for (let i=0;i<vers.length;i++){    
      let ver = vers[i]
      if (ver[0].slice(0,1)=="^"){
       sign[i]='^'
       ver[0]=ver[0].slice(1)
      }
      for(let j=0 ;j<ver.length;j++){
        if (ver[j]=="*") ver[j]='0'
        if (i==0 && parseInt(ver[j])!=0 && nonce==null) nonce=j 
        let item = ver[j]
        if (item.length==1 && base[i]<10) base[i]=10
        else if (item.length==2 && base[i]<100) base[i]=100
        else if (item.length==3 && base[i]<1000) base[i]=1000
        else {
          ver[j]=item.slice(0,3)
          base[i] = 1000
        }
      }
    }
    let len = ver1.length - ver2.length
    for (let i=0;i<Math.abs(len);i++){
      (len>0)?ver2.push(0):ver1.push(0)
    }
    if (vers[0][nonce]!='9' && vers[0][nonce]!='99' && vers[0][nonce]!='999'){
       [...ver3] = vers[0]
       ver3[nonce] = parseInt(ver3[nonce])+1
       for (let i=nonce+1;i<ver3.length;i++){
         ver3[i] = 0
       }
    }
    vers.push(ver3)   
    tbase = base.sort()[base.length - 1]
    for (let i=0;i<vers.length;i++){
      let ver=vers[i]
      ver.reverse()
      for(let j=0 ;j<ver.length;j++){
        let item = ver[j]
        vNum[i] += parseInt(item)*(tbase**j)
      }
    }
    //console.log(nonce,sign,base,vers,vNum)
    ver1.reverse()
    ver2.reverse()
    ver3.reverse()    
    if (sign[0]=='^'){
      if (vNum[1]<vNum[0] || vNum[1]>=vNum[2])
        throw new Error(`we need version ${ver1.join(".")} ~ ${ver3.join(".")},but the version is ${ver2.join(".")}`)
    }else{
      if (vNum[1]<vNum[0]){
        throw new Error(`we need version >= ${ver1.join(".")},but version is ${ver2.join(".")}`)
      }
    }
  }
}    

exports.Contract = Contract
