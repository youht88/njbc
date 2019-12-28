const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const Wallet = require("./wallet.js").Wallet

//function test
class TXin{
  constructor(args){
    this.prevHash=args.prevHash||""
    this.index   =args.index
    this.inAddr  =args.inAddr||""
    this.pubkey  =args.pubkey||[]
    this.sign    =args.sign  ||[]
    if (!Array.isArray(this.pubkey)) this.pubkey=[this.pubkey]
    if (!Array.isArray(this.sign))   this.sign = [this.sign]
  }
  canUnlockWith({signType,outsHash,prevTxAmount}){
    let prevTx = global.blockchain.findTransaction(this.prevHash)
    if (!prevTx.hash) return true //此方法仅为解决首次批量下载问题，目前尚未知更好的模式，过后修改
      
    let vout = prevTx.outs[this.index]
    let outAddr = vout.outAddr
    
    //prevTxAmount是一个数组，目的是累积每一个amount，用于后续验证fee交易费是否正确
    prevTxAmount.push({hash:this.prevHash,index:this.index,amount:vout.amount})
    
    if (vout.signNum && vout.signNum>this.pubkey.length){
      logger.warn(`需要签名校验的数量${vout.signNum}大于提供的公钥数量`)
      return false
    }
    //step1:verify it is mine 
    if (!(outAddr == this.inAddr && Wallet.address(this.pubkey)== outAddr)){
      logger.error("transaction",this.prevHash,this.index,"step1: inAddr can pass pubkey? false")
      return false
    }
    //step2:verify not to be changed!!!!
    logger.warn("canUnlockWith",outsHash)
    let signNum = 0 
    let isVerify=false
    for (let i=0 ;i<this.pubkey.length;i++){
      if (signType=="all"){
        if (utils.ecc.verify(
              this.prevHash+this.index.toString()+this.inAddr+outsHash,
              this.sign[i],
              this.pubkey[i])){
          signNum++
          if (signNum >= vout.signNum){
            isVerify=true
            logger.info(`[已验证了${vout.signNum}条签名]`)
            break
          }
        }
      }else{
        if (utils.ecc.verify(
              this.prevHash+this.index.toString()+this.inAddr,
              this.sign[i],
              this.pubkey[i])){
          signNum++
          if (signNum >= vout.signNum){
            isVerify=true
            logger.info(`[已验证了${vout.signNum}条签名]`)
            break
          }
        }
      }
    }
    if (!isVerify){
      logger.error("transaction",this.prevHash,this.index,"step2: can pass sign verify? false")
      return false
    }
    return true
  }
}
class TXout{
  constructor(args){
    this.amount=args.amount   || 0
    this.outAddr=args.outAddr || ""
    this.signNum = args.signNum || 1
    this.contractHash = args.contractHash || ""
    this.script=args.script   || ""
    this.assets=args.assets   || {}
    if (this.script && !this.contractHash)
      this.contractHash = utils.hashlib.hash160(this.script)
    //check type
    if (typeof this.amount !="number") throw new Error("amount type is not number")
    if (typeof this.outAddr != "string") throw new Error("outAddr type is not string")
  }
  canbeUnlockWith(address){
    if (this.outAddr != address) {
      return false
    }
    return true
  }
}
class Transaction{
  constructor(args){
    this.ins=args.ins
    this.insLen=this.ins.length
    this.outs=args.outs
    this.outsLen=this.outs.length
    if (args.timestamp) {
      this.timestamp = args.timestamp
    }else{
      this.timestamp = new Date().getTime() 
    }
    this.lockTime = args.lockTime || 0
    this.signType = args.signType || 'all'
    if (args.hash){
      this.hash=args.hash
    }else{
      this.hash=utils.hashlib.sha256(this.preHeaderString())     
    }
  }
  preHeaderString(){
    let ins=[]
    for (let item of this.ins){
      let temp={...item}
      temp.sign=[]
      temp.pubkey=[]
      ins.push(temp)
    }
    return [JSON.stringify(ins),
            JSON.stringify(this.outs),
            this.lockTime,
            this.timestamp,
            this.signType].join("")
  }
  dumps(){
    return JSON.stringify(this)
  }
  isCoinbase(){
    return this.ins[0].index==-1
  }
  isValid(txAmount=[]){
    logger.debug("transaction begin verify",this.hash)
    if (this.isCoinbase()){
      if (!(this.insLen==1 && this.outs[0].amount<=global.REWARD)){
        logger.error("transaction verify","coinbase transaction reward error.")
        return false
      }
      //check fee is coded in function block.isValid
      return true
    }
    if (utils.hashlib.sha256(this.preHeaderString())!=this.hash) {
      logger.warn("transaction verify","交易内容与hash不一致")
      return false
    }
    //验证lockTime合法性
    if (this.lockTime!=0 && this.lockTime >= new Date().getTime()){
      logger.warn("transaction verify","lockTime时期尚未到来")
      return false
    }
    //验证每条输入
    let signType = this.signType
    let outsHash = utils.hashlib.sha256(JSON.stringify(this.outs))
    //logger.error("isValid",outsHash)
    let prevTxAmount=[]
    for (let idx=0;idx<this.ins.length;idx++){
      let vin = this.ins[idx]
      if (!vin.canUnlockWith({signType,outsHash,prevTxAmount})) return false
    }
    let txInAmount=0
    if (prevTxAmount.length>0)
      txInAmount = prevTxAmount.map(x=>x.amount).reduce((x,y)=>x+y)
    let txOutAmount = this.outs.map(x=>x.amount).reduce((x,y)=>x+y)
    logger.warn("transaction verify","txInAmount",txInAmount,"txOutAmount",txOutAmount)
    if ( txInAmount < txOutAmount ){
      logger.error("transaction verify","输入的金额小于输出的金额","txInAmount",txInAmount,"txOutAmount",txOutAmount)
      console.log(prevTxAmount.map(x=>x.amount).join(","))
      return false
    }
    //txAmount的作用是供block.isValid函数判断coinbase交易的交易费是否合法
    txAmount.push({hash:this.hash,txInAmount:txInAmount,txOutAmount:txOutAmount})
    return true
  }
  static newCoinbase(outAddr,fee=0){
    let ins=[new TXin({"prevHash":"",
                       "index":-1,
                       "inAddr":""
                       })]
    let outs=[]
    outs.push(new TXout(
      {"amount":parseFloat(global.REWARD.toPrecision(12)),"outAddr":outAddr}))
    if (fee > 0){
      outs.push(new TXout({"amount":fee,"outAddr":outAddr}))
    }
    return new Transaction({ins,outs})
  }
  static parseTransaction(data){
    let ins=[]
    let outs=[]
    for (let i=0;i<data.ins.length;i++){
      ins.push(new TXin(data.ins[i]))
    }
    for (let j=0;j<data.outs.length;j++){
      outs.push(new TXout(data.outs[j]))
    }
    let hash=data["hash"]
    let timestamp=data["timestamp"]
    let lockTime = data["lockTime"]
    let signType = data["signType"]
    return new Transaction({hash,timestamp,lockTime,signType,ins,outs})
  }
  static async newTransaction({inPrvkey,inPubkey,inAddr,outAddr,amount,utxo,script="",assets={},signNum=1,lockTime=0}){
    if (!Array.isArray(inPrvkey)) inPrvkey = [inPrvkey]
    return new Promise((resolve,reject)=>{
      let preNewTx = Transaction.preNewTransaction({
          inAddr,outAddr,amount,utxo,script,assets,signNum,lockTime})
      preNewTx = Transaction.sign(inPrvkey,inPubkey,preNewTx)
      Transaction.newRawTransaction(preNewTx,utxo)
        .then(result=>resolve(result))
        .catch(error=>reject(error))
    })
  }
  static preNewTransaction({inAddr,outAddr,amount,fee=0,signType="all",utxo,script="",assets={},signNum,lockTime}){
    let totalAll=0,otherFee=0,total=0,average=0
    if (amount<0) throw new Error("金额不能小于零")
    if (Array.isArray(outAddr)){
      if (Array.isArray(amount)){
        outAddr.map((x,i)=>{
          if (amount[i]) return
          return amount.push(0) 
        })
        outAddr.length
        otherFee = amount.reduce((x,y,i)=>{
            if (i>outAddr.length) return x+y
            return y
          })
        total = amount.reduce((x,y)=>x+y) - otherFee
        fee = fee + otherFee
      }else{
        total   = amount
        average = parseFloat((total / outAddr.length).toPrecision(12))
        amount=[]
        outAddr.map(x=>amount.push(average))
      }
    }else{
      if (Array.isArray(amount)){
        total = amount.reduce((x,y)=>x+y)
      }else{
        total   = amount
      }
    }
    if (fee<0) throw new Error("交易费不能小于零")
    let ins=[]
    let outs=[]
    if (!outAddr)
      throw new Error("must define out address")
    totalAll = parseFloat((total+fee).toPrecision(12))
    let todo = utxo.findSpendableOutputs(inAddr,total)
    //todo={"acc":3,"unspend":{"3453425125":[{"index":0,"amount":"3","signNum":1},
    //                                       {"index":1,"amount":"2","signNum":1}],                 
    //                         "2543543543":{"index":0,"amount":"2","signNum":2}
    //                        }
    //     }
    //console.log("preNewTransaction",inAddr,todo)
    if (todo["acc"] < totalAll){
      logger.warn(`${inAddr} not have enough money.`)
      throw new Error("not enough money.")
    }
    let maxSignNum=1
    //ins
    for (let hash in todo["unspend"]){
      let output = todo["unspend"][hash]
      let prevHash = hash
      for (let item of output){
        let index = item["index"]
        ins.push({"prevHash":prevHash,
                  "index":index,
                  "inAddr":inAddr
                  })
        if (item["signNum"]>maxSignNum)
          maxSignNum = item["signNum"]    
      }
    }
    //outs
    if (Array.isArray(outAddr)){
      outAddr.map((x,i)=>{
        outs.push({"amount":amount[i],
               "outAddr":outAddr[i],
               "signNum":signNum,
               "contractHash":script?utils.hashlib.hash160(script):"",
               "script":script,
               "assets":assets
              })
      })
    }else{
      outs.push({"amount":total,
               "outAddr":outAddr,
               "signNum":signNum,
               "contractHash":script?utils.hashlib.hash160(script):"",
               "script":script,
               "assets":assets
              })
    }

    if (todo["acc"] > totalAll){
      outs.push({"amount":parseFloat((todo["acc"]-totalAll).toPrecision(12)),
                 "outAddr":inAddr,
                 "signNum":maxSignNum,  //????
                 "contractHash":"",
                 "script":"",
                 "assets":{}
                 })
    }
    const outsHash=utils.hashlib.sha256(JSON.stringify(outs))
    logger.warn("preNewTransaction",outsHash)
    
    /*let a=0
    for (let key in todo["unspend"]){
      a += todo["unspend"][key].map(x=>x["amount"]).reduce((x,y)=>x+y)
    }
    logger.warn("preNewTransaction",todo["acc"],a)
    */
    return {rawIns:ins,rawOuts:outs,lockTime:lockTime,signType:signType,outsHash:outsHash}
  }
  
  static sign(inPrvkey,inPubkey,preNewTx){
    //type = "all","none","sigle"
    const  type = preNewTx.signType
    console.log("?????????",preNewTx) //如果输入的地址没有tonken，那么即使交易费为0，系统也会找不到preNewTx.rawIns的记录而报错
    try{
      if (preNewTx.rawIns[0].index==-1) return preNewTx
      const rawIns=preNewTx.rawIns
      const rawOutsHash = utils.hashlib.sha256(JSON.stringify(preNewTx.rawOuts))
      logger.warn("sign",utils.hashlib.sha256(rawOutsHash))
      if (type=="all"){
        for (let rawIn of rawIns){
          let toSign=rawIn.prevHash+rawIn.index.toString()+rawIn.inAddr+rawOutsHash
          let sign=[]
          inPrvkey.map((key,i)=>{
            return sign[i]=utils.ecc.sign(toSign,key)
          })
          rawIn.sign = sign
          rawIn.pubkey = inPubkey
        }
      }else if (type=="none"){
        for (let rawIn of rawIns){
          let toSign=rawIn.prevHash+rawIn.index.toString()+rawIn.inAddr
          let sign=[]
          inPrvkey.map((key,i)=>{
            return sign[i]=utils.ecc.sign(toSign,key)
          })
          rawIn.sign = sign
          rawIn.pubkey = inPubkey
        }
      }
    }catch(error){
      throw error
    }
    return preNewTx
  }    

  static async newRawTransaction(raw,utxo){
    return new Promise((resolve,reject)=>{
      let ins=[]
      let outs=[]
      for (let rawIn of raw.rawIns){
        ins.push(new TXin(rawIn))
      }
      for (let rawOut of raw.rawOuts){
        outs.push(new TXout(rawOut))
      }
      let lockTime = raw.lockTime
      let signType = raw.signType
      let TX = new Transaction({ins,outs,lockTime,signType})
      //logger.warn("newRawTransaction",JSON.stringify(TX))
      let {...utxoSet} = utxo.utxoSet
      if (! utxo.updateWithTX(TX,utxoSet)){               
        return reject(new Error("double spend!!,Maybe not enough money."))
      }
      utxo.utxoSet = utxoSet
      return resolve(TX)
    })
  }
  
  static async getTxPool(){
    return global.db.findMany("transaction",{})
  }
}

//const dumps = (JSON.stringify(new Transaction("yyy")))
//console.log(dumps)

exports.Transaction = Transaction
exports.TXin = TXin
exports.TXout = TXout
