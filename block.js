const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()

const Transaction = require('./transaction.js').Transaction

class Block{
  constructor(args){
    this.index     = parseInt(args.index) || 0
    this.nonce     = parseInt(args.nonce) || 0
    this.prevHash  = args.prevHash ||""
    this.timestamp = parseInt(args.timestamp)
    this.diffcult  = args.diffcult || 0
    this.merkleRoot= args.merkleRoot || ""
    this.data      = []
    for (var i=0 ;i < args.data.length;i++){
      this.data.push(Transaction.parseTransaction(args.data[i]))
    }
    this.hash     = args.hash     || this.updateHash()
  }  
  headerString(){
    return [this.index.toString(),
        this.prevHash,
        this.getMerkleRoot(),
        this.timestamp.toString(),
        this.diffcult.toString(),
        this.nonce.toString()].join("")
  }
  preHeaderString(){
    return [this.index.toString(),
        this.prevHash,
        this.getMerkleRoot(),
        this.timestamp.toString(),
        this.diffcult.toString()].join("")
  }
  getMerkleRoot(){
    let txHash=[]
    for (let item of this.data){
      txHash.push(item.hash)
    }
    this.merkleRoot=utils.hashlib.sha256(txHash.join(""))
    //merkleTree = merkle.Tree()
    //merkleRoot = merkleTree.makeTree(txHash)
    //self.merkleRoot = merkleRoot.value
    return this.merkleRoot

  }
  updateHash(preHeaderStr=null){
    if (preHeaderStr)
      this.hash = utils.hashlib.sha256(preHeaderStr+this.nonce.toString())
    else
      this.hash = utils.hashlib.sha256(this.headerString())
    return this.hash
  }
  dumps(){
    return {
      "index"      :this.index,
      "hash"       :this.hash,
      "prevHash"   :this.prevHash,
      "diffcult"   :this.diffcult,
      "nonce"      :this.nonce,
      "timestamp"  :this.timestamp,
      "merkleRoot" :this.merkleRoot,
      "data"       :this.data
    }
  }
  async save(){
    global.db.updateOne("blockchain",{"index":this.index},{"$set":this.dumps()},{"upsert":true})
    .catch(e=>console.log("save error:",e))
  }
  async saveToPool(){
    return new Promise(async (resolve,reject)=>{
      const {index,nonce} = this
      logger.warn(`save block ${index}-${nonce} to pool`)
      await global.db.updateOne("blockpool",{"hash":this.hash},{"$set":this.dumps()},{"upsert":true})
        .then(()=>resolve())
        .catch(e=>{console.log("saveToPool error:",e)
                   reject(e)   
              })
    })      
  }
  async removeFromPool(){
    global.db.deleteOne("blockpool",{"hash":this.hash})
    .catch(e=>console.log("removeFromPool error",e))
  }
  isValid(){
    if (this.index == 0 ) return true
    logger.debug(`verify block #${this.index}-${this.nonce}`)
    //logger.debug("verify proof of work")
    this.updateHash()
    if (this.hash.slice(0,this.diffcult) != Array(this.diffcult+1).join('0')){
      logger.debug(`${this.hash} is not worked because of WOF is not valid`)
      return false
    }
    //logger.debug(`${this.hash} is truly worked`)
    logger.debug("verify transaction data")
    for (let transaction of this.data){
      console.log("transaction hash:",transaction.hash)
      if (!transaction.isValid()) {
        logger.debug(`${this.hash} is not worked because of transaction is not valid`)
        return false
      }
    }
    return true
  }
}
exports.Block = Block