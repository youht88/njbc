//crypto
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const log4js = require("log4js")
const b58 = require('base-x')('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')

const MongoClient = require("mongodb")

Object.defineProperty(global, '__stack', {
  get: function(){
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});
Object.defineProperty(global, '__footprint', {
  get: function(){
    return `[${__stack[1].getFileName()}-${__stack[1].getFunctionName()}-${__stack[1].getLineNumber()}]`
  }
});

Array.prototype.remove = function(item){
  let i=this.indexOf(item)
  if (i>=0)
    this.splice(i,1)
  return this
}

class Logger {
  getLogger(name="default",confFile="log4js.json"){
    var log4js_config = require("./"+confFile)
    log4js.configure(log4js_config);
    const logger = log4js.getLogger(name)
    return logger
  } 
}

logger=new Logger().getLogger()

class Crypto{
  toPEM(key,type){
    type = type.toUpperCase()
    if (type=="PUBLIC"){
      return this.PEM_PUBLIC_BEGIN+key+this.PEM_PUBLIC_END
    }else if (type =="PRIVATE"){
      return this.PEM_PRIVATE_BEGIN+key+this.PEM_PRIVATE_END
    }else {
      return null
    }
  }
  sign(message,prvkey=null,prvfile=null){
    let signature=null
    try{
      if (prvfile)
        prvkey = fs.readFileSync(prvfile,"utf8")
      if (prvkey){
        const signObj = crypto.createSign('sha256')
        signObj.update(message)
        const prvkeyPEM = this.toPEM(prvkey,"private")
        const signStr = signObj.sign(prvkeyPEM).toString('base64');
        return signStr  
      }else{
        return null
      }
    }catch(e){
      throw e
    }
  }
  verify(message,signStr,pubkey=null,pubfile=null){
    let verify=null
    try{
      if (pubfile)
        pubkey = fs.readFileSync(pubfile,"utf8")
      if (pubkey){
        const verifyObj = crypto.createVerify('sha256')
        verifyObj.update(message)
        const pubkeyPEM = this.toPEM(pubkey,"public")
        const verifyBool = verifyObj.verify(pubkeyPEM,Buffer.from(signStr,"base64"));
        return verifyBool  
      }else{
        return false
      }
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return false
    }
  }
  encrypt(message,pubkey=null,pubfile=null){
    let encrypted=null
    try{
      if (pubfile)
        pubkey = fs.readFileSync(pubfile,"utf8")
      if (pubkey){
        const pubkeyPEM = this.toPEM(pubkey,'public')
        encrypted = crypto.publicEncrypt({key:pubkeyPEM},Buffer.from(message)).toString('base64')
        return encrypted
      }else {
        return null
      }  
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }
  decrypt(message,prvkey=null,prvfile=null){
    let decrypted=null
    try{
      if (prvfile)
        prvkey = fs.readFileSync(prvfile,"utf8")
      if (prvkey){
        const prvkeyPEM = this.toPEM(prvkey,'private')
        decrypted = crypto.privateDecrypt({key:prvkeyPEM},Buffer.from(message,'base64')).toString()
        return decrypted
      }else {
        return null
      }  
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }
  enCipher(message,key){
    let encipher = crypto.createCipher(this.namedCipher,key)
    let encrypted = encipher.update(JSON.stringify(message),"utf8","base64")
    encrypted += encipher.final('base64') 
    return encrypted
  }
  deCipher(message,key){
    let decipher = crypto.createDecipher(this.namedCipher,key)
    let decrypted = decipher.update(message,"base64",'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }  
}
class ECC extends Crypto{
  constructor(namedCurve='secp256k1',namedCipher='aes192'){
    super()
    this.namedCurve = namedCurve
    this.namedCipher = namedCipher
    this.PEM_PRIVATE_BEGIN = "-----BEGIN EC PRIVATE KEY-----\n"
    this.PEM_PRIVATE_END="\n-----END EC PRIVATE KEY-----"
    this.PEM_PUBLIC_BEGIN = "-----BEGIN PUBLIC KEY-----\n"
    this.PEM_PUBLIC_END="\n-----END PUBLIC KEY-----"
  }
  generateKeys(prvfile="private",pubfile="public"){
    try{
     const key = crypto.generateKeyPairSync("ec",{
        namedCurve       :this.namedCurve,
        publicKeyEncoding:{
          type  :"spki",
          format:"der"
        },
        privateKeyEncoding:{
          type  :"sec1",
          format:"der"
        }
     })
     const pubkey = key.publicKey.toString("base64")
     const prvkey = key.privateKey.toString("base64")
     if (prvfile){
       fs.writeFileSync(prvfile,prvkey)
     }
     if (pubfile){
       fs.writeFileSync(pubfile,pubkey)
     }
     return {"prvkey":prvkey,"pubkey":pubkey}
    }catch(e){
     console.log(`error ${e.name} with ${e.message}`)
     return null
    } 
  }
  encrypt(){
    console.log("尚不支持改功能")
  }
  decrypt(){
    console.log("尚不支持改功能")
  }
  genECDH(){
    const ecdh = crypto.createECDH(this.namedCurve)
    const pubkey = ecdh.generateKeys("base64")
    const prvkey = ecdh.getPrivateKey("base64")
    return {prvkey,pubkey}
  }  
  computeSecret(prvkey,pubkey){
    const ecdh = crypto.createECDH(this.namedCurve)
    ecdh.setPrivateKey(prvkey,"base64")
    return ecdh.computeSecret(Buffer.from(pubkey,"base64")).toString("base64")
  }
  getKeys(prvkey){
    const ecdh = crypto.createECDH(this.namedCurve)
    ecdh.setPrivateKey(prvkey,"base64")
    const pubkey = ecdh.getPublicKey("base64")
    return {"prvkey":prvkey,"pubkey":pubkey}
  }
  genKeys(keyStr,num){
    if (!num) num=1
    const hashlib=new Hashlib()
    const bufferlib = new Bufferlib()
    let seed  = hashlib.sha512(keyStr)
    let keys=[]
    for (let i=0 ;i<num;i++){
      const temp = hashlib.sha512(seed)      
      seed =temp.slice(64,128)
      const prvkey=Buffer.from(temp.slice(0,64),'hex').toString('base64')
      keys.push(this.getKeys(prvkey))
    }
    return keys   
  }
  
}
class RSA extends Crypto{
  constructor(modulusLength=1024,namedCipher='aes192'){
    super()
    this.modulusLength = modulusLength
    this.namedCipher = namedCipher
    this.PEM_PRIVATE_BEGIN = "-----BEGIN PRIVATE KEY-----\n"
    this.PEM_PRIVATE_END="\n-----END PRIVATE KEY-----"
    this.PEM_PUBLIC_BEGIN = "-----BEGIN PUBLIC KEY-----\n"
    this.PEM_PUBLIC_END="\n-----END PUBLIC KEY-----"
  }
  generateKeys(prvfile="private",pubfile="public"){
    try{
     const key = crypto.generateKeyPairSync("rsa",{
        modulusLength    :this.modulusLength,
        publicKeyEncoding:{
          type  :"spki",
          format:"der"
        },
        privateKeyEncoding:{
          type  :"pkcs8",
          format:"der"
        }
     })
     const pubkey = key.publicKey.toString("base64")
     const prvkey = key.privateKey.toString("base64")
     if (prvfile){
       fs.writeFileSync(prvfile,prvkey)
     }
     if (pubfile){
       fs.writeFileSync(pubfile,pubkey)
     }
     return {"prvkey":prvkey,"pubkey":pubkey}
    }catch(e){
     console.log(`error ${e.name} with ${e.message}`)
     return null
    } 
  }
}
    
class Hashlib{
  sha256(...data){
    const hash = crypto.createHash("sha256")
    const str = data.map(i=>JSON.stringify(i)).join("")
    hash.update(str)
    return hash.digest("hex")
  }
  sha512(...data){
    const hash = crypto.createHash("sha512")
    const str = data.map(i=>JSON.stringify(i)).join("")
    hash.update(str)
    return hash.digest("hex")
  }
  md5(...data){
    const hash = crypto.createHash("md5")
    const str = data.map(i=>JSON.stringify(i)).join("")
    hash.update(str)
    return hash.digest("hex")
  }
  ripemd160(...data){
    const hash = crypto.createHash("ripemd160")
    const str = data.map(i=>JSON.stringify(i)).join("")
    hash.update(str)
    return hash.digest("hex")
  }
  hash160(...data){
    return this.ripemd160(this.sha256(data))
  }
  doubleSha256(...data){
    return this.sha256(this.sha256(data))
  }
}
class Bufferlib{
  constructor(){
    this.codeTypes = ['ascii','base64','utf8','hex','binary','base58']
  }
  b64encode(str){
    //对字符串进行base64编码
    
    Buffer.from(str).toString('base64')
  }
  b64decode(str){
    //对base64编码的字符串进行解码
    return Buffer.from(str,'base64').toString()
  }
  b58encode(str){
    return b58.encode(Buffer.from(str))
  }
  b58decode(str){
    return b58.decode(str).toString()
  }
  toBin(str,codeType='utf8'){
    //将特定编码类型的字符串压缩为bin码
    if (this.codeTypes.includes(codeType)){
      if (typeof str !== "string"){ 
        str = JSON.stringify(str)
        return Buffer.from(str,codeType)
      }else if (codeType == "base58"){
        return b58.decode(str)
      }else{
        return Buffer.from(str,codeType)
      }
    }else{
      throw new Error(`code type must be one of ${this.codeTypes}`)
    }
  }
  toString(buffer,codeType='utf8'){
    //将压缩的bin码转换为对应类型的string
    if (!Buffer.isBuffer(buffer)) throw new Error("first arg type must be buffer")
    if (this.codeTypes.includes(codeType)){
      if (codeType == "base58"){
        return b58.encode(buffer)
      }else{
        return buffer.toString(codeType)
      }
    }else{
      throw new Error(`code type must be one of ${this.codeTypes}`)
    }
  }
  transfer(str,fromCode,toCode){
    if (!this.codeTypes.includes(fromCode) || !this.codeTypes.includes(toCode) )
      throw new Error(`code type must be one of ${this.codeTypes}`)
    if (typeof str !== "string") {
       str = JSON.stringify(str)
       return this.toString(Buffer.from(str,'utf8'),toCode)
    }else if (fromCode=="base58"){
      return this.toString(b58.decode(str),toCode)
    }else{
      return this.toString(Buffer.from(str,fromCode),toCode)
    }
  }
}
class Set{
  removeRepeat(a) { // 去重
    var r = [];
    for(var i = 0; i < a.length; i ++) {
        var flag = true;
        var temp = a[i];
        for(var j = 0; j < r.length; j ++) {
            if(temp === r[j]) {
                flag = false;
                break;
            }
        }
        if(flag) {
            r.push(temp);
        }
    }
    return r;
  }
  intersection(a, b) { // 交集
    var result = [];
    for(var i = 0; i < b.length; i ++) {
        var temp = b[i];
        for(var j = 0; j < a.length; j ++) {
            if(temp === a[j]) {
                result.push(temp);
                break;
            }
        }
    }
    return this.removeRepeat(result);
  }
  
  union(a, b) { // 并集
    return this.removeRepeat(a.concat(b));
  }
  
  difference(a, b) { // 差集 a - b
    //clone = a
    var clone = a.slice(0);
    for(var i = 0; i < b.length; i ++) {
        var temp = b[i];
        for(var j = 0; j < clone.length; j ++) {
            if(temp === clone[j]) {
                //remove clone[j]
                clone.splice(j,1);
            }
        }
    }
    return this.removeRepeat(clone);
  }
}

class DB{
  constructor(){
    this.client = {}    
    this.db = null
  }
  
  async init(url){
    return new Promise((resolve,reject)=>{
      let conn = url.split("/")
      let newUrl = "mongodb://"+conn[0]
      let database = conn[1]
      MongoClient.connect(newUrl,{useNewUrlParser:true},(err,client)=>{
        if (err) reject(err)
        this.client = client
        this.db = client.db(database)
        console.log("数据库已链接")
        resolve(this.db)
      })
    })
  }
  close(){
    if (!this.client) return
    this.client.close()
    console.log("数据库已关闭")
  }
  async deleteOne(collection,condition,cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        coll.deleteOne(condition,(err,result)=>{
          if (typeof(cb)=="function"){
            cb(err,result)
            resolve(result)
          }else if (err){
            throw err
          }else{
            resolve(result)
          }
        })
      })
    })
  }
  async deleteMany(collection,condition,cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        coll.deleteMany(condition,(err,result)=>{
          if (typeof(cb)=="function"){
            cb(err,result)
            resolve(result)
          }else if (err){
            throw err
          }else{
            resolve(result)
          }
        })
      })
    })
  }
  async insertOne(collection,doc,options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject (new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options={}
        }
        coll.insertOne(doc,options,(err,result)=>{
          if (typeof(cb)=="function"){
            cb(err,result)
            resolve(result)
          }else if (err){
            throw err
          }else{
            resolve(result)
          }
        })
      })
    })
  }
  async insertMany(collection,docs,options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.insertMany(docs,options,(err,result)=>{
          if (typeof(cb)=="function"){
            cb(err,result)
            resolve(result)
          }else if (err){
            throw err
          }else{
            resolve(result)
          }
        })
      })
    })
  }
  async findOne(collection,condition={},options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.findOne(condition,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result)
            resolve(result)
          }else if(err){
            throw err
          }else{
            resolve(result)
          }
        })    
      })
    })
  }
  async findMany(collection,condition={},options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.find(condition,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result.toArray())
            resolve(result)
          }else if(err){
            throw err
          }else{
            resolve(result.toArray())
          }
        })    
      })
    })
  }
  async updateOne(collection,condition={},update={},options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.updateOne(condition,update,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result)
            resolve(result)
          }else if(err){
            reject(err)
          }else{
            resolve(result)
          }
        })    
      })
    })
  }
  async updateMany(collection,condition={},update={},options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.updateMany(condition,update,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result)
            resolve(result)
          }else if(err){
            throw err
          }else{
            resolve(result)
          }
        })    
      })
    })
  }
  async count(collection,condition={},options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.countDocuments(condition,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result)
            resolve(result)
          }else if(err){
            throw err
          }else{
            resolve(result)
          }
        })    
      })
    })
  }
  async aggregate(collection,pipeline=[],options={},cb=null){
    return new Promise((resolve,reject)=>{
      if (!this.db) reject(new Error("not init database"))
      this.db.collection(collection,(err,coll)=>{
        if (err) throw err
        if (typeof(options)=="function"){
          cb = options
          options = {}
        }
        coll.aggregate(pipeline,options,(err,result)=>{
          if (typeof(cb) == "function"){
            cb(err,result.toArray())
            resolve(result)
          }else if(err){
            throw err
          }else{
            resolve(result.toArray())
          }
        })    
      })
    })
  }
}
class Http{
  async get(urls){
    const promiseArray = urls.map(
      url => this.httpGet(url))
    return Promise.all(promiseArray)
  }
  async httpGet(url,responseType=""){
    return new Promise((resolve,reject)=>{
      const request = new XMLHttpRequest()
      request.onload = ()=>{
        if (this.status === 200){
          resolve(this.response)
        }else{
          reject(new Error(this.statusText))
        }
      }
      request.onerror = ()=>{
        reject(new Error(
          'XMLHttpRequest Error:'+this.statusText
        ))
      }
      request.open('GET',url)
      xhr.responseType=responseType
      request.send()
    })
  }
}
exports.obj2json = function(obj){
  return JSON.parse(JSON.stringify(obj))
}

exports.ecc  = new ECC()  
exports.rsa  = new RSA() 
exports.hashlib = new Hashlib()
exports.bufferlib  = new Bufferlib()
exports.logger  = new Logger()
exports.set     = new Set()
exports.db      = new DB()
exports.http    = new Http()
