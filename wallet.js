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
    if (nameOrAddress.length==64) return true
    return false
  }

  isAddress(nameOrAddress){
    if (nameOrAddress.length==64) return true
    return false
  }
  async chooseByName(name){
    return new Promise((resolve,reject)=>{
      global.db.findMany("wallet",{"name":name}).then(accounts=>{
        if (accounts.length==0) return reject(new Error(`no such account,use function create('${name}') first.`))
        if (accounts.length >1) return reject(new Error(`multi account named ${name}`))
        let account = accounts[0]
        this.name = name
        this.key={"prvkey":account.prvkey,"pubkey":account.pubkey}
        this.pubkey64D=this.key.pubkey.map(pubkey=>{
          return utils.bufferlib.b64encode(pubkey)
        })
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
          this.pubkey64D=this.key.pubkey.map(pubkey=>{
            utils.bufferlib.b64encode(pubkey)
          })
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
          if (!utils.isArray(prvkey)) prvkey=[prvkey]
          if (!utils.isArray(pubkey)) pubkey=[pubkey]
          this.key={prvkey:prvkey,pubkey:pubkey}
          console.log("create wallet",this.key)
        }else if (!prvkey && !pubkey){ 
          let key=utils.crypto.genRSAKey(null,null)
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
        this.pubkey64D = this.key.pubkey.map(pubkey=>{
          return utils.bufferlib.b64encode(pubkey)
        })
        console.log("pubkey64D",this.pubkey64D)
        resolve(this)
      }catch(e){
        reject(e) 
      }
   })
  }
  static address(pubkey){
    if (utils.isArray(pubkey))
      return utils.hashlib.sha256(pubkey.join(""))
    else
      return utils.hashlib.sha256(pubkey)
  }
  static async getAll(){
    return await global.db.findMany("wallet",{},{"projection":{"_id":0,"name":1,"address":1}})  
  }
}

exports.Wallet = Wallet

