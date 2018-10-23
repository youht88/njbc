const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const Contract = require("./contract.js").Contract
const Wallet = require("./wallet.js").Wallet

//function test
class TXin{
  constructor(args){
    this.prevHash=args.prevHash||""
    this.index   =args.index
    this.inAddr  =args.inAddr||""
    if (args.pubkey64D){
      this.pubkey64D=args.pubkey64D
    }else{
      const pubkey=args.pubkey || null      
      if (!pubkey){
        this.pubkey64D=""
      }else{
        //64 mean use base64encode 
        this.pubkey64D=utils.base64.encode(pubkey)
      }
    }
    if (args.signD){
      this.signD=args.signD
    }else{
      const sign=args.sign || null
      if (!sign){
        this.signD=""
      }else{
        //D  mean decode bin to str
        this.signD=sign
      }
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
    this.script=args.script   || ""
    this.assets=args.assets   || {}
  }
  canbeUnlockWith(address){
    if (this.outAddr == address){
      if (this.script==""){
        return true
      }else{
        const contract = new Contract(this.script)
        const result = contract.check()
        if (result["errCode"]==0){
          return result["result"]
        }else{
          return false
        }
      }
    }else{
      return false    
    }
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
      this.timestamp = Math.round(new Date().getTime()/1000) 
    }
    if (args.hash){
      this.hash=args.hash
    }else{
      this.hash=utils.hashlib.sha256([JSON.stringify(this.ins),
                              JSON.stringify(this.outs),
                              this.timestamp])     
    }
  }
  dumps(){
    return JSON.stringify(this)
  }
  isCoinbase(){
    return this.ins[0].index==-1
  } 
  sign(self,prvkey,prevTXs){
    if (this.isCoinbase()) return
  }    
  isValid(){
    if (this.isCoinbase())
      return (this.insLen==1 && this.outsLen==1 && this.outs[0].amount<=global.REWARD)       
    logger.debug("transaction","begin verify:",this.hash)
    let outAddr=""
    for (let idx=0;idx<this.ins.length;idx++){
      let vin = this.ins[idx]
      let outPubkey = utils.base64.decode(vin.pubkey64D)
      outAddr = vin.inAddr
      //step1:verify it is mine 
      if (!(outAddr == vin.inAddr && utils.hashlib.sha256(outPubkey)== vin.inAddr)){
        logger.warn("transaction",outAddr,vin.inAddr)
        logger.error("transaction",vin.prevHash,vin.index,"step1: inAddr can pass pubkey? false")
        return false
      }
      logger.debug("transaction",vin.prevHash,vin.index,"step1: inAddr can pass pubkey? ok")
      //step2:verify not to be changed!!!!
      let isVerify=utils.crypto.verify(
        vin.prevHash+vin.index.toString()+vin.inAddr,
        vin.signD,
        outPubkey
       )
      if (!isVerify){
        logger.error("transaction",vin.prevHash,vin.index,"step2: can pass sign verify? false")
        return false
      }
      logger.debug("transaction",vin.prevHash,vin.index,"step2: can pass sign verify? ok")
    }
    return true
  }
  static newCoinbase(outAddr){
    let ins=[new TXin({"prevHash":"","index":-1,"inAddr":"","pubkey":null,"sign":null})]
    let outs=[new TXout({"amount":Math.round(global.REWARD*10000)/10000,"outAddr":outAddr,"script":"","assets":{}})]
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
  static async newTransaction(inPrvkey,inPubkey,outPubkey,amount,utxo,script="",assets={}){
    return new Promise((resolve,reject)=>{
      if (script){
        const result = (new Contract(script)).check()
        if (!result) 
          return reject(new Error("script error"))
      }
      let ins=[]
      let outs=[]
      let inAddr = Wallet.address(inPubkey)
      let outAddr= Wallet.address(outPubkey)
      let amountFloat = Math.round(amount*10000)/10000
      let todo = utxo.findSpendableOutputs(inAddr,amountFloat)
      //todo={"acc":3,"unspend":{"3453425125":{"index":0,"amount":"3"},        
      //                         "2543543543":{"index":0,"amount":"2"}
      //                        }
      //     }
      if (todo["acc"] < amountFloat){
        logger.warn(`${inAddr} not have enough money.`)
        return reject(new Error("not enough money."))
      }
      for (let hash in todo["unspend"]){
        let output = todo["unspend"][hash]
        let prevHash = hash
        let index = output["index"]
        let toSign=prevHash+index.toString()+inAddr
        let sign=utils.crypto.sign(toSign,inPrvkey)
        ins.push(new TXin({"prevHash":prevHash,
                         "index":index,
                         "inAddr":inAddr,
                         "pubkey":inPubkey,
                         "sign":sign}))
      }
      outs.push(new TXout({"amount":amountFloat,"outAddr":outAddr,"script":script,"assets":assets}))
      if (todo["acc"] > amountFloat){
        outs.push(new TXout({"amount":todo["acc"]-amountFloat,"outAddr":inAddr,"script":"","assets":{}}))
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
}

//const dumps = (JSON.stringify(new Transaction("yyy")))
//console.log(dumps)

exports.Transaction = Transaction
exports.TXin = TXin
exports.TXout = TXout
