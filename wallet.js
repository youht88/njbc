const MongoClient = require('mongodb').MongoClient;
const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()

class Wallet{
  constructor(name=null){
    if (name)
      return (async ()=>{
        if (!this.isAddress(name)) 
          await this.chooseByName(name) 
        else 
          await this.chooseByAddress(name)
        return this
      })()
  }
  static  isAddress(nameOrAddress){
    let r,s1,s2,s3,s4,t
    try{
      t=utils.bufferlib.toBin(nameOrAddress,"base58")
      if (t.length!=25 || t[0]!=0) return false
      r = t.slice(0,21).toString('hex')
      s1 = utils.hashlib.sha256(r)
      s2 = utils.hashlib.sha256(s1)
      s3 = s2.slice(0,8)
      s4 = t.slice(21,25).toString('hex')
      if (s3 != s4) return false
      return true
    }catch(e){
      console.log("error",e.message)
      return false
    }
  }

  isAddress(nameOrAddress){
    return Wallet.isAddress(nameOrAddress)
  }
  async chooseByName(name){
    return new Promise((resolve,reject)=>{
      global.db.findMany("wallet",{"name":name}).then(accounts=>{
        if (accounts.length==0) return reject(new Error(`no such account,use function create('${name}') first.`))
        if (accounts.length >1) return reject(new Error(`multi account named ${name}`))
        let account = accounts[0]
        this.name = name
        this.key={"prvkey":account.prvkey,"pubkey":account.pubkey}
        this.address=account.address
        resolve('success')
      }).catch(e=>reject(e))
    })
  }
  async chooseByAddress(address){
    return new Promise((resolve,reject)=>{
      global.db.findMany("wallet",{"address":address}).then(accounts=>{
        if (accounts.length==0)
          return  reject (new Error("no such account address."))
        if (accounts.length >1)
          return reject (new Error(`multi account addressed ${address}`))
        let account = accounts[0]
        this.name = account.name
          this.key={"prvkey":account.prvkey,"pubkey":account.pubkey}
          this.address=address
        resolve('success')
      }).catch(e=>reject(e))
   })
  }
  static async deleteByName(name){
    global.db.deleteMany("wallet",{"name":name})
  }  
  static async deleteByAddress(address){
    global.db.deleteMany("wallet",{"address":address})
  }
  async create(name,prvkey=null,pubkey=null){
    return new Promise((resolve,reject)=>{
      try{
        if (prvkey && pubkey){
          if (!Array.isArray(prvkey)) prvkey=[prvkey]
          if (!Array.isArray(pubkey)) pubkey=[pubkey]
          this.key={prvkey:prvkey,pubkey:pubkey}
        }else if (!prvkey && !pubkey){
          let key=utils.ecc.generateKeys(null,null)
          this.key={prvkey:[key.prvkey],pubkey:[key.pubkey]}
        }else{
          reject(new Error("公钥和私钥必须同时提供，或同时为空。")) 
        }
        const address=Wallet.address(this.key.pubkey)
        global.db.insertOne('wallet',{"name":name,
           "address":address,
           "pubkey":this.key.pubkey,
           "prvkey":this.key.prvkey})
        this.name = name
        this.address = address
        resolve(this)
      }catch(e){
        reject(e) 
      }
   })
  }
  static address(pubkey){
    let p,q,r,s1,s2,s3,t
    if (Array.isArray(pubkey))
      p = pubkey.join("")
    else
      p = pubkey
    q=utils.hashlib.sha256(p)
    r='00'+utils.hashlib.ripemd160(q)
    s1=utils.hashlib.sha256(r)
    s2=utils.hashlib.sha256(s1)
    s3=s2.slice(0,8)
    t=r+s3
    return utils.bufferlib.transfer(t,"hex","base58")
  }
  static async getAll(){
    return await global.db.findMany("wallet",{},{"projection":{"_id":0,"name":1,"address":1}})  
  }
}

exports.Wallet = Wallet

