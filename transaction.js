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
  }
  canUnlockWith(){
    let prevTx = global.blockchain.findTransaction(this.prevHash)
    if (!prevTx.hash) return true //此方法仅为解决首次批量下载问题，目前尚未知更好的模式，过后修改
      
    let vout = prevTx.outs[this.index]
    let outAddr = vout.outAddr
    
    if (vout.lockTime >0 && new Date().getTime() < vout.lockTime) return false
    
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
    let signNum = 0 
    let isVerify=false
    for (let i=0 ;i<this.pubkey.length;i++){
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
    this.lockTime = args.lockTime || 0
    if (this.script && !this.contractHash)
      this.contractHash = utils.hashlib.hash160(this.script)
  }
  canbeUnlockWith(address){
    if (this.outAddr != address) {
      return false
    }
    if (this.lockTime>0 && new Date().getTime()<this.lockTime) {
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
    if (args.hash){
      this.hash=args.hash
    }else{
      this.hash=utils.hashlib.sha256(this.preHeaderString())     
    }
  }
  preHeaderString(){
    return [JSON.stringify(this.ins),
            JSON.stringify(this.outs),
            this.timestamp].join("")
  }
  dumps(){
    return JSON.stringify(this)
  }
  isCoinbase(){
    return this.ins[0].index==-1
  } 
  isValid(){
    if (this.isCoinbase())
      return (this.insLen==1 && this.outsLen==1 && this.outs[0].amount<=global.REWARD)    
    logger.debug("transaction","begin verify:",this.hash)
    if (utils.hashlib.sha256(this.preHeaderString())!=this.hash) {
      logger.warn("交易内容与hash不一致")
      return false
    }
    for (let idx=0;idx<this.ins.length;idx++){
      let vin = this.ins[idx]
      if (!vin.canUnlockWith({})) return false
    }
    return true
  }
  static newCoinbase(outAddr){
    let ins=[new TXin({"prevHash":"",
                       "index":-1,
                       "inAddr":""
                       })]
    let outs=[new TXout({"amount":parseFloat(global.REWARD.toPrecision(12)),
                         "outAddr":outAddr
                        })]
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
    return new Transaction({hash,timestamp,ins,outs})
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
  static preNewTransaction({inAddr,outAddr,amount,utxo,script="",assets={},signNum,lockTime}){
    if (amount<0) throw new Error("金额不能小于零")
    let ins=[]
    let outs=[]
    if (!outAddr)
      throw new Error("must define out address")
    amount = parseFloat(amount.toPrecision(12))
    let todo = utxo.findSpendableOutputs(inAddr,amount)
    //todo={"acc":3,"unspend":{"3453425125":{"index":0,"amount":"3","signNum":1},        
    //                         "2543543543":{"index":0,"amount":"2","signNum":2}
    //                        }
    //     }
    console.log("preNewTransaction",inAddr,todo)
    if (todo["acc"] < amount){
      logger.warn(`${inAddr} not have enough money.`)
      throw new Error("not enough money.")
    }
    let maxSignNum=1
    for (let hash in todo["unspend"]){
      let output = todo["unspend"][hash]
      let prevHash = hash
      let index = output["index"]
      ins.push({"prevHash":prevHash,
                "index":index,
                "inAddr":inAddr,
                "sign":[]})
      if (output["signNum"]>maxSignNum)
        maxSignNum = output["signNum"]    
    }
    outs.push({"amount":amount,
               "outAddr":outAddr,
               "signNum":signNum,
               "script":script,
               "assets":assets,
               "lockTime":lockTime})
    if (todo["acc"] > amount){
      outs.push({"amount":parseFloat((todo["acc"]-amount).toPrecision(12)),
                 "outAddr":inAddr,
                 "signNum":maxSignNum,  //????
                 "script":"",
                 "assets":{},
                 "lockTime":lockTime
                 })
    }
    return {rawIns:ins,rawOuts:outs}
  }
  
  static sign(inPrvkey,inPubkey,preNewTx){
    try{
      if (preNewTx.rawIns[0].index==-1) return preNewTx
      const rawIns=preNewTx.rawIns
      for (let rawIn of rawIns){
        let toSign=rawIn.prevHash+rawIn.index.toString()+rawIn.inAddr
        let sign=[]
        inPrvkey.map((key,i)=>{
          return sign[i]=utils.ecc.sign(toSign,key)
        })
        rawIn.sign = sign
        rawIn.pubkey = inPubkey
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
      let TX = new Transaction({ins,outs})
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
