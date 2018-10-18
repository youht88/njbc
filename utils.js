//crypto
const crypto = require("crypto")
const RSA = require("node-rsa")
const fs = require("fs")
const path = require("path")
const log4js = require("log4js");

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
  genRSAKey(prvfile="private.pem",pubfile="public.pem"){
    try{
      const key=new RSA({b: 1024});
      const prvkey = key.exportKey("pkcs8-private")
      const pubkey = key.exportKey("pkcs8-public")
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
      
  encrypt(message,pubkey=null,pubfile=null){
    let encrypted=null
    try{
      if (pubkey){
        const key=new RSA(pubkey)
        if (key.isPublic()){
          encrypted = key.encrypt(message, 'base64')
        }
        return encrypted
      }else if (pubfile){
        const pubkey = fs.readFileSync(pubfile,"utf8")
        const key=new RSA(pubkey,'pkcs8-public')
        if (key.isPublic()){
          encrypted = key.encrypt(message, 'base64')
        }
        return encrypted
      }else{
        return null
      }
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }
  decrypt(encrypted,prvkey=null,prvfile=null){
    let decrypted=null
    try{
      if (prvkey){
        const key = new RSA(prvkey)
        if (key.isPrivate()){
          decrypted = key.decrypt(encrypted, 'utf8');
        }
        return decrypted  
      }else if (prvfile){
        const prvkey = fs.readFileSync(prvfile,"utf8")
        const key = new RSA(prvkey,'pkcs8-private')
        if (key.isPrivate()){
          decrypted = key.decrypt(encrypted, 'utf8');
        }
        return decrypted  
      }else{
        return null
      }
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }
  sign(message,prvkey=null,prvfile=null){
    let signature=null
    try{
      if (prvkey){
        const key = new RSA(prvkey)
        if (key.isPrivate()){
          signature = key.sign(message,"base64");
        }
        return signature  
      }else if (prvfile){
        const prvkey = fs.readFileSync(prvfile,"utf8")
        const key = new RSA(prvkey)
        if (key.isPrivate()){
          signature = key.sign(message,"base64");
        }
        return signature  
      }else{
        return null
      }
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }
  verify(message,signature,pubkey=null,pubfile=null){
    let verify=null
    try{
      if (pubkey){
        const key = new RSA(pubkey)
        if (key.isPublic()){
          verify = key.verify(message,signature,"utf8","base64");
        }
        return verify  
      }else if (pubfile){
        const pubkey = fs.readFileSync(pubfile,"utf8")
        const key = new RSA(pubkey)
        if (key.isPublic()){
          verify = key.verify(message,signature,"utf8","base64");
        }
        return verify  
      }else{
        return null
      }
    }catch(e){
      console.log(`error ${e.name} with ${e.message}`)
      return null
    }
  }  
}
    
class Hashlib{
  sha256(data){
    const hash = crypto.createHash("sha256")
    hash.update(JSON.stringify(data))
    return hash.digest("hex")
  }
  md5(data){
    const hash = crypto.createHash("md5")
    hash.update(JSON.stringify(data))
    return hash.digest("hex")
  }
}
class Base64{
  encode(data){
    return new Buffer(data).toString('base64')
  }
  decode(data){
    return new Buffer(data,'base64').toString()
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

exports.crypto  = new Crypto()
exports.hashlib = new Hashlib()
exports.base64  = new Base64()
exports.logger  = new Logger()
exports.set     = new Set()
exports.db      = new DB()
exports.http    = new Http()
