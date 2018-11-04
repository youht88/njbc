const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const _     = require("underscore")
const logger = utils.logger.getLogger()
const vm = require('vm')
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
    this.assets  = {}
    this.owner  = ""
    
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
    this.contractAddr = contractDict.address
    this.script       = contractDict.script
    this.assets       = contractDict.assets
    this.owner        = contractDict.owner
    return true      
  }
  deploy(owner,amount,assets={}){
    if (!this.check()) return
    let script = this.script   
    global.emitter.emit("deployContract",{owner,amount,script,assets})  
  }
  check(){
    if (!this.script && !this.contractHash) throw new Error("空的合约脚本")
    if (this.script && this.contractHash) {
      if (utils.hashlib.sha256(this.script) != this.contractHash) 
        throw new Error("合约与合约摘要不匹配")
    } 
    if (this.script && !this.contractHash) {
      //检查合约语法
      try{
        new vm.Script(this.script)
      }catch(error){
        throw error
      }  
      this.contractHash = utils.hashlib.sha256(this.script)
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
  async run(){
    let result
    try{
      result=vm.runInContext(this.script,vm.createContext(this.sandbox),{timeout:global.contractTimeout})
    }catch(error){
      throw error
    }
    return result
  }
  setSandbox(sandbox){
    let that = this
    try{
      sandbox.setTimeout = setTimeout
      sandbox.console = console
      sandbox.async   = require("async")
      sandbox.crypto  = require('./utils.js').crypto
      sandbox.hashlib = require('./utils.js').hashlib
      sandbox.base64  = require('./utils.js').bufferlib
      sandbox.emitter = new EventEmitter()
      sandbox._       = _
      sandbox.nowE8   = new Date(new Date().getTime()+28800000)
      sandbox.callback = (data)=>{
        console.log("callback函数返回",data)
      }
      sandbox.getInstance = (hash)=>{
        const contractDict = this.sandbox.getContract(hash)
        if (!contractDict) return null
        vm.runInContext(contractDict.script,vm.createContext(this.sandbox),
             {timeout:global.contractTimeout})
        return { 
            isDeployed : true,
            blockHash    : contractDict.blockHash,
            blockIndex   : contractDict.blockIndex,
            blockNonce   : contractDict.blockNonce,
            txHash       : contractDict.txHash,
            contractAddr : contractDict.address,
            contractHash : hash,
            script       : contractDict.script,
            assets       : contractDict.assets,
            owner        : contractDict.owner
        }
      }
      sandbox.getContract = (contractHash)=>{
          let contract = global.blockchain.findContract(contractHash)
          return contract
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
        }
      
        getBlock(indexOrHash){
          if (typeof(indexOrHash)=="string"){
            return global.blockchain.findBlockByHash(indexOrHash)
          }else{
            return global.blockchain.findBlockByIndex(indexOrHash)
          }
        }
        getLastBlock(){
          return global.blockchain.lastblock()
        }
        getMaxIndex(){
          return global.blockchain.maxindex()
        }
        getTransaction(hash){
          return global.blockchain.findTransaction(hash)
        }
        async getTxPool(){
          return Transaction.getTxPool()
        }
        async getAllAccounts(){
          return Wallet.getAll()
        }
        async getBalance(address){
          let wallet = await new Wallet(address)
                        .catch((error)=>{throw error})
          return global.blockchain.utxo.getBalance(wallet.address)
        }
        async getPayBalance(to){
          let amount = await global.blockchain.findContractBalanceTo(
              this.blockIndex,this.contractAddr,to)
                         .catch((error)=>{throw error})
          this.callback(`the amount is ${amount}`)
          return amount
        }
        async payTo(to,amount,assets={}){
          global.emitter.emit("payTo",{
              contractAddr:this.contractAddr,
              to          :to,
              amount      :amount,
              assets      :assets
            },(err,result)=>{
              if (err) throw err
              logger.warn(`合约支付 ${amount} 给 ${to}的交易已提交`,result)
          })
        }
        preNewTransaction(inPubkey,outAddr,amount){
          if (!inPubkey){ //使用合约账户
          }
          return Transaction.preNewTransaction(inPubkey,outAddr,amount,global.blockchain.utxo)      
        }
        async newRawTransaction(raw){
          if (global.node)
            return Transaction.newRawTransaction(raw,global.node.tradeUTXO)
        }
        async set(caller,amount,assets={}){
          if (that.caller) caller = that.caller
          if (!caller) return false
          global.emitter.emit("setAssets",{
              caller      :caller,
              contractAddr:this.contractAddr,
              amount      :amount,
              assets      :assets
            },(err,result)=>{
              if (err) throw err
              logger.warn(`更新资源 ${assets} 到 ${this.contractAddr}的交易已提交`,result)
          })
        }
        get(key=null){
          let assets =global.blockchain.findContractAssets(this.blockIndex,this.contractAddr)
          if (!assets) return null
          if (key)
            return assets[key]
          else 
            return assets
        }
      } //define Contract class
      return sandbox
    }catch(error){
      throw error
    }
  }
}    

exports.Contract = Contract
