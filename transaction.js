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
    if (args.signD){
      this.signD=args.signD
    }else{
      this.signD = []
      args.sign.map((sign,i)=>{
        return this.signD[i] = sign
      })
    }
  }
  canUnlockWith(script){
    //暂停使用，移入canBeUnlockWith函数
    return true
    if (this.pubkey64D != script){
      logger.fatal("canUnlockWith error:self.pubkey64D != script")
    }
    //return self.pubkey64D == script
  }
}
class TXout{
  constructor(args){
    this.amount=args.amount   || 0
    this.outAddr=args.outAddr || ""
    this.signNum = args.signNum || 1
    if (args.pubkey64D){
      this.pubkey64D=args.pubkey64D
    }else if (args.pubkey){
      this.pubkey64D=[]
      args.pubkey.map((pubkey,i)=>{
        return this.pubkey64D[i]=utils.bufferlib.b64encode(pubkey)
      })
    }else{
      this.pubkey64D=[]
    }
    this.contractHash = args.contractHash || ""
    this.script=args.script   || ""
    this.assets=args.assets   || {}
    if (this.script && !this.contractHash)
      this.contractHash = utils.hashlib.sha256(this.script)
  }
  canbeUnlockWith(address){
    if (this.outAddr == address) return true
    return false    
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
    let outAddr=""
    for (let idx=0;idx<this.ins.length;idx++){
      let vin = this.ins[idx]
      
      let prevTx = global.blockchain.findTransaction(vin.prevHash)
      if (!prevTx.hash) return true //此方法仅为解决首次批量下载问题，目前尚未知更好的模式，过后修改
      let vout = prevTx.outs[vin.index]
      let outPubkey = vout.pubkey64D.map(pubkey64D=>{return utils.bufferlib.b64decode(pubkey64D)})
      outAddr = vout.outAddr
      if (vout.signNum && vout.signNum>outPubkey.length){
        logger.warn(`需要签名校验的数量${vin.signNum}大于提供的公钥数量`)
        return false
      }
              
      //step1:verify it is mine 
      if (!(outAddr == vin.inAddr && Wallet.address(outPubkey)== outAddr)){
        logger.fatal("transaction",outPubkey,Wallet.address(outPubkey),vin.inAddr)
        logger.error("transaction",vin.prevHash,vin.index,"step1: inAddr can pass pubkey? false")
        return false
      }
      //logger.debug("transaction",vin.prevHash,vin.index,"step1: inAddr can pass pubkey? ok")
      //step2:verify not to be changed!!!!
      let signNum = 0 
      let isVerify=false
      for (let i=0 ;i<outPubkey.length;i++){
        if (utils.crypto.verify(
              vin.prevHash+vin.index.toString()+vin.inAddr,
              vin.signD[i],
              outPubkey[i])){
          signNum++
          if (signNum >= vout.signNum){
            isVerify=true
            logger.info(`[已验证了${vout.signNum}条签名]`)
            break
          }
        }
      }
      if (!isVerify){
        logger.error("transaction",vin.prevHash,vin.index,"step2: can pass sign verify? false")
        return false
      }
      //logger.debug("transaction",vin.prevHash,vin.index,"step2: can pass sign verify? ok")
    }
    return true
  }
  static newCoinbase(outPubkey,outAddr){
    let ins=[new TXin({"prevHash":"",
                       "index":-1,
                       "inAddr":"",
                       "sign":[]
                       })]
    let outs=[new TXout({"amount":parseFloat(global.REWARD.toPrecision(12)),
                         "outAddr":outAddr,
                         "pubkey":outPubkey,
                         "signNum":1,
                         "script":"",
                         "assets":{}})]
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
  static async newTransaction({inPrvkey,inPubkey,inAddr,outPubkey,outAddr,amount,utxo,script="",assets={},signNum=1}){
    if (!Array.isArray(inPrvkey)) inPrvkey = [inPrvkey]
    if (!Array.isArray(outPubkey)) outPubkey = [outPubkey]
    return new Promise((resolve,reject)=>{
      let preNewTx = Transaction.preNewTransaction({
          inAddr,inPubkey,outPubkey,outAddr,amount,utxo,script,assets,signNum})
      Transaction.sign(inPrvkey,preNewTx)
      Transaction.newRawTransaction(preNewTx,utxo)
        .then(result=>resolve(result))
        .catch(error=>reject(error))
    })
  }
  static preNewTransaction({inAddr,inPubkey,outPubkey,outAddr,amount,utxo,script="",assets={},signNum}){
    if (amount<0) throw new Error("金额不能小于零")
    let ins=[]
    let outs=[]
    logger.warn("!!!!",outPubkey,Wallet.address(outPubkey),outAddr)
    if (!outAddr)
      outAddr = Wallet.address(outPubkey)
    amount = parseFloat(amount)
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
               "pubkey":outPubkey,
               "signNum":signNum,
               "script":script,
               "assets":assets})
    if (todo["acc"] > amount){
      outs.push({"amount":parseFloat((todo["acc"]-amount).toPrecision(12)),
                 "outAddr":inAddr,
                 "pubkey":inPubkey,
                 "signNum":maxSignNum,  //????
                 "script":"",
                 "assets":{}})
    }
    return {rawIns:ins,rawOuts:outs}
  }
  
  static sign(inPrvkey,preNewTx){
    try{
      if (preNewTx.rawIns[0].index==-1) return
      const rawIns=preNewTx.rawIns
      for (let rawIn of rawIns){
        let toSign=rawIn.prevHash+rawIn.index.toString()+rawIn.inAddr
        let sign=[]
        inPrvkey.map((key,i)=>{
          return sign[i]=utils.crypto.sign(toSign,key)
        })
        rawIn.sign = sign
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
