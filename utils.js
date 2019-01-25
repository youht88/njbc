//crypto
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const log4js = require("log4js")
const b58 = require('base-x')('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')

const MongoClient = require("mongodb")

const http = require('http');
const querystring = require('querystring');
const url  = require('url')

// Math constants and functions we need.
const PI = Math.PI;
const SQRT1_2 = Math.SQRT1_2;

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
    const bufferlib = new Bufferlib()
    const ecdh = crypto.createECDH(this.namedCurve)
    prvkey = bufferlib.transfer(prvkey,"base64","hex")
    ecdh.setPrivateKey(prvkey,"hex")
    const pubkey = ecdh.getPublicKey("hex")
    /*组装public key der,转换为base64
    3056【sequence 类型 长度86】
    3010【sequence 类型 长度16】
    0607【OID类型 长度 07】
    2a8648ce3d0201 【 OID value = "1.2.840.10045.2.1"=>{42,134,72,206,61,2,1}】
    0605【OID类型 长度05】
    2b8104000a【OID value = "1.3.132.0.10"=>{43,129,04,00,10}=>{0x 2b 81 04 00 0a}】
    034200【bit string类型，长度66，前导00】
    */
    const pubkey_der="3056301006072a8648ce3d020106052b8104000a034200"+pubkey
    /*组装private key der,转换为base64
    3074【sequence类型，长度116】
    0201【Integer类型，长度01】
    01 【value=1 ，ecprivkeyVer1=1】
    0420【byte类型，长度32】
    ....【私钥】
    a007【a0结构类型，长度07】
    0605【OID类型，长度05】
    2b8104000a【OID value named secp256k1 elliptic curve = 1.3.132.0.10 =>{43,129,04,00,10}=>{0x 2b 81 04 00 10}】
    a144【a1结构类型，长度68】
    034200【bitstring类型，长度66，前导00】
   【0x 04开头的非压缩公钥】
    */
    const prvkey_der="30740201010420"+prvkey+
                     "a00706052b8104000aa144034200"+pubkey
  
    return {"prvkey":bufferlib.transfer(prvkey_der,"hex","base64"),
            "pubkey":bufferlib.transfer(pubkey_der,"hex","base64")}
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
class MySet{
  
  union(a,b){
    let c = new Set([...a, ...b]);
    return [...c];
  }
  difference(a,b){
   let m = new Set([...a])
   let n = new Set([...b])
   let c = new Set([...m].filter(x => !n.has(x)));
   return [...c];
  }
  intersect(a,b){
    let m = new Set([...a])
    let n = new Set([...b])
    let c = new Set([...m].filter(x => n.has(x)));//ES6
    return [...c];
  }
  removeRepeat(a){
    let c = new Set([...a]);
    return [...c];
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
class MyHttp{
  async get(urls){
    const promiseArray = urls.map(
      url => this.httpGet(url))
    return Promise.all(promiseArray)
  }
  async httpGet(url){
    return new Promise((resolve,reject)=>{
      var urlObj=new URL(url)
      var options = { 
          hostname: urlObj.hostname, 
          port: urlObj.port, 
          path: urlObj.pathname, 
          method: 'GET',
      };
      var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode==200){
            resolve(rawData);
          }else{
            reject(res.statusText);
          }
        });
      }); 
         
      req.on('error', function (e) { 
          reject('problem with request: ' + e.message); 
      }); 
         
      req.end();
    })
  }
  async httpPost(url,data){
    return new Promise((resolve,reject)=>{
      var postData = querystring.stringify(data)
      var urlObj=new URL(url)
      var options = { 
          hostname: urlObj.hostname, 
          port: urlObj.port, 
          path: urlObj.pathname, 
          method: 'POST',
      };
      var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode==200){
            resolve(rawData);
          }else{
            reject(res.statusText);
          }
        });
      }); 
         
      req.on('error', function (e) { 
          reject('problem with request: ' + e.message); 
      }); 
      console.log(postData)
      req.write(postData)
      req.end();
    })
  }
}
exports.obj2json = function(obj){
  return JSON.parse(JSON.stringify(obj))
}

class ComplexArray {
  constructor(other, arrayType = Float32Array) {
    if (other instanceof ComplexArray) {
      // Copy constuctor.
      this.ArrayType = other.ArrayType;
      this.real = new this.ArrayType(other.real);
      this.imag = new this.ArrayType(other.imag);
    } else {
      this.ArrayType = arrayType;
      // other can be either an array or a number.
      this.real = new this.ArrayType(other);
      this.imag = new this.ArrayType(this.real.length);
    }

    this.length = this.real.length;
  }
  random(){
    this.map(value=>{
      value.real = Math.random()
      value.imag = Math.random()
    })
  }
  toString() {
    const components = [];

    this.forEach((value, i) => {
      components.push(
        `(${value.real.toFixed(2)}, ${value.imag.toFixed(2)})`
      );
    });

    return `[${components.join(', ')}]`;
  }

  forEach(iterator) {
    const n = this.length;
    // For gc efficiency, re-use a single object in the iterator.
    const value = Object.seal(Object.defineProperties({}, {
      real: {writable: true}, imag: {writable: true},
    }));

    for (let i = 0; i < n; i++) {
      value.real = this.real[i];
      value.imag = this.imag[i];
      iterator(value, i, n);
    }
  }

  // In-place mapper.
  map(mapper) {
    this.forEach((value, i, n) => {
      mapper(value, i, n);
      this.real[i] = value.real;
      this.imag[i] = value.imag;
    });

    return this;
  }

  conjugate() { //求每个复数的共轭复数
    return new ComplexArray(this).map((value) => {
      value.imag *= -1;
    });
  }

  magnitude() { //求每个复数到原点的长度
    const mags = new this.ArrayType(this.length);

    this.forEach((value, i) => {
      mags[i] = Math.sqrt(value.real*value.real + value.imag*value.imag);
    })

    return mags;
  }
}

class myFFT{
  ensureComplexArray(input) {
    return input instanceof ComplexArray && input || new ComplexArray(input);
  }

  fft(input, inverse) {
    input = this.ensureComplexArray(input)
    const n = input.length;
  
    if (n & (n - 1)) {
      return this.FFT_Recursive(input, inverse);
    } else {
      return this.FFT_2_Iterative(input, inverse);
    }
  }
  
  inv_fft(input){
    return this.fft(input,true)
  }
  
  frequencyMap(filterer) {
    return this.fft().map(filterer).inv_fft();
  }

  
  FFT_Recursive(input, inverse) {
    const n = input.length;
  
    if (n === 1) {
      return input;
    }
  
    const output = new ComplexArray(n, input.ArrayType);
  
    // Use the lowest odd factor, so we are able to use FFT_2_Iterative in the
    // recursive transforms optimally.
    const p = this.LowestOddFactor(n);
    const m = n / p;
    const normalisation = 1 / Math.sqrt(p);
    let recursive_result = new ComplexArray(m, input.ArrayType);
  
    // Loops go like O(n Σ p_i), where p_i are the prime factors of n.
    // for a power of a prime, p, this reduces to O(n p log_p n)
    for(let j = 0; j < p; j++) {
      for(let i = 0; i < m; i++) {
        recursive_result.real[i] = input.real[i * p + j];
        recursive_result.imag[i] = input.imag[i * p + j];
      }
      // Don't go deeper unless necessary to save allocs.
      if (m > 1) {
        recursive_result = this.fft(recursive_result, inverse);
      }
  
      const del_f_r = Math.cos(2*PI*j/n);
      const del_f_i = (inverse ? -1 : 1) * Math.sin(2*PI*j/n);
      let f_r = 1;
      let f_i = 0;
  
      for(let i = 0; i < n; i++) {
        const _real = recursive_result.real[i % m];
        const _imag = recursive_result.imag[i % m];
  
        output.real[i] += f_r * _real - f_i * _imag;
        output.imag[i] += f_r * _imag + f_i * _real;
  
        [f_r, f_i] = [
          f_r * del_f_r - f_i * del_f_i,
          f_i = f_r * del_f_i + f_i * del_f_r,
        ];
      }
    }
  
    // Copy back to input to match FFT_2_Iterative in-placeness
    // TODO: faster way of making this in-place?
    for(let i = 0; i < n; i++) {
      input.real[i] = normalisation * output.real[i];
      input.imag[i] = normalisation * output.imag[i];
    }
  
    return input;
  }
  
  FFT_2_Iterative(input, inverse) {
    const n = input.length;
  
    const output = this.BitReverseComplexArray(input);
    const output_r = output.real;
    const output_i = output.imag;
    // Loops go like O(n log n):
    //   width ~ log n; i,j ~ n
    let width = 1;
    while (width < n) {
      const del_f_r = Math.cos(PI/width);
      const del_f_i = (inverse ? -1 : 1) * Math.sin(PI/width);
      for (let i = 0; i < n/(2*width); i++) {
        let f_r = 1;
        let f_i = 0;
        for (let j = 0; j < width; j++) {
          const l_index = 2*i*width + j;
          const r_index = l_index + width;
  
          const left_r = output_r[l_index];
          const left_i = output_i[l_index];
          const right_r = f_r * output_r[r_index] - f_i * output_i[r_index];
          const right_i = f_i * output_r[r_index] + f_r * output_i[r_index];
  
          output_r[l_index] = SQRT1_2 * (left_r + right_r);
          output_i[l_index] = SQRT1_2 * (left_i + right_i);
          output_r[r_index] = SQRT1_2 * (left_r - right_r);
          output_i[r_index] = SQRT1_2 * (left_i - right_i);
  
          [f_r, f_i] = [
            f_r * del_f_r - f_i * del_f_i,
            f_r * del_f_i + f_i * del_f_r,
          ];
        }
      }
      width <<= 1;
    }
  
    return output;
  }
  
  BitReverseIndex(index, n) {
    let bitreversed_index = 0;
  
    while (n > 1) {
      bitreversed_index <<= 1;
      bitreversed_index += index & 1;
      index >>= 1;
      n >>= 1;
    }
    return bitreversed_index;
  }
  
  BitReverseComplexArray(array) {
    const n = array.length;
    const flips = new Set();
  
    for(let i = 0; i < n; i++) {
      const r_i = this.BitReverseIndex(i, n);
  
      if (flips.has(i)) continue;
  
      [array.real[i], array.real[r_i]] = [array.real[r_i], array.real[i]];
      [array.imag[i], array.imag[r_i]] = [array.imag[r_i], array.imag[i]];
  
      flips.add(r_i);
    }
  
    return array;
  }
  
  LowestOddFactor(n) {
    const sqrt_n = Math.sqrt(n);
    let factor = 3;
  
    while(factor <= sqrt_n) {
      if (n % factor === 0) return factor;
      factor += 2;
    }
    return n;
  }
}
class GF{
  constructor(g=3,p=123479){
    this.init(g,p)
    this.gf8={
    }
    //p=2^256 − 2^32 − 2^9 − 2^8 − 2^7 − 2^6 − 2^4 − 1
    this.curve={
      name:"secp256k1",
      a:0n,
      b:7n,
      p:0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
      g:{x:0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
         y:0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n},
      n:0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
      h:1n
    }
   /*
   this.curve={
     name:"test",
     a:4n,
     b:20n,
     p:29n,
     g:{x:13n,y:23n},
     n:37n
   }
   
   this.curve={
     name:"test1",
     a:16546484n,
     b:4548674875n,
     p:15424654874903n,
     g:{x:6478678675n,y:5636379357093n},
     n:null
   }
   */
  }
  curveInit(a,b,p,g,name){
    this.curve.name=name
    this.curve.a=BigInt(a)
    this.curve.b=BigInt(b)
    this.curve.p=BigInt(p)
    this.curve.g={x:BigInt(g.x),y:BigInt(g.y)}
    return this.curve
  }
  init(g,p){
    this.gn=BigInt(g)
    this.pn=BigInt(p)
  }
  E(x){
    let xn=BigInt(x)
    return (this.gn**xn)%this.pn
  }
  verify(sum,...e){
    let en=e.map(x=>BigInt(x))
    let sumn = BigInt(sum)
    let ep=en.reduce((x,y)=>x*y)%this.pn
    return (ep == this.E(sumn))
  }
  isPrime(d){
    let dn = BigInt(d) 
    let i=Math.floor(Math.sqrt(d))
    if (dn==2n || dn==3n || dn==5n) return true
    if (dn%2n==0) return false
    if (dn%6n!=1 && dn%6n!=5) {
      for (let j=3n;j<=9n;i++){
        if (dn%j==0){
          console.log(`${j}*${dn/j}=${dn}`)
          return false
        }
      }
    }
    for (let j=5n;j<=i;j+=6n){
      if (dn%j==0){
        console.log(`${j}*${dn/j}=${dn}`)
        return false
      }
      if (dn%(j+2n)==0){
        console.log(`${j+2n}*${dn/(j+2n)}=${dn}`)
        return false
      }
    }
    return true
  }
  mod(a,p=null){
    let a1,ax,ay
    let pn=this.curve.p
    if (p!=null)
      pn = BigInt(p)
    if (a instanceof Complex){
      ax = a.real>0 ? BigInt(a.real)%pn : pn-BigInt(-a.real)%pn
      ay = a.imag>0 ? BigInt(a.imag)%pn : pn-BigInt(-a.imag)%pn
      return new Complex(ax,ay)
    }
    a1 = a>0 ? BigInt(a)%pn : pn-BigInt(-a)%pn
    return a1
  }
  invmod(a,p=null){
    let a1
    let an = a>0?BigInt(a):BigInt(-a)
    let pn = this.curve.p
    if (p!=null)
      pn = BigInt(p)
    //a1=this.mod(an**(pn-2n),pn)
    a1=this.inv2(an,pn)
    return a<0 ? pn-a1 : a1 
  }
  add(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.add(b),p)
    }else if (b instanceof Complex){
      return this.mod(b.add(a),p)
    }
    return this.mod(BigInt(a)+BigInt(b),p||this.curve.p)
  }
  sub(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.sub(b),p)
    }
    return this.mod(BigInt(a)-BigInt(b),p||this.curve.p)
  }
  mul(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.mul(b),p)
    }else if (b instanceof Complex){
      return this.mod(b.mul(a),p)
    }
    return this.mod(BigInt(a)*BigInt(b),p||this.curve.p)
  }
  div(a,b,p){
    return this.mod(BigInt(a)*this.invmod(b,p),p||this.curve.p)
  }
  subtract(a,b,p){return this.sub(a,b,p)}
  multiply(a,b,p){return this.mul(a,b,p)}
  divide(a,b,p)  {return this.div(a,b,p)}
  
  inv(a,p){//乘法逆元
    let inv=[]
    inv[1] = 1;
    for(let i=2;i<a;i++)
        inv[i]=(p-parseInt(p/i))*inv[p%i]%p;
        
    return inv
  }
  inv1(a,p){
    if(a==1) return 1
    return (p-parseInt(p/a))*(this.inv1(p%a,p))%p
  }
  inv2(a,p){
    a=BigInt(a)
    p=BigInt(p)
    let res=1n,base=a%p;
    let b=p-2n
    while(b)
    {
        if(b&1n)
          res=(base*res)%p;
        base=(base*base)%p;
        b>>=1n;
    }
    return res;
  }
  gcd(a,b){//求最大公约数
    let k=parseInt(a/b);
    let remainder = a%b;
    while (remainder !=0){
      a = b;
      b = remainder
      k = parseInt(a/b)
      remainder = a%b
    }
    return b
  }
  
  curveNav(m,p){
    let x = BigInt(m.x)
    let y = BigInt(this.mod(-m.y,p))
    return {x:x,y:y}  
  }
  curveAdd(m,n,p){
    let lambda,x,y
    m.x=BigInt(m.x)
    m.y=BigInt(m.y)
    n.x=BigInt(n.x)
    n.y=BigInt(n.y)
    let pn=this.curve.p
    if (p!=null) pn=BigInt(p)
    if (m.x==n.x && m.y==n.y)
      //lambda = BigInt(this.mod(this.mod(3n*m.x**2n+this.curve.a,pn)*this.invmod(2n*m.y,pn),pn))
      lambda = this.div(this.add(3n*m.x**2n,this.curve.a,pn),2n*m.y,pn)
    else
      //lambda = BigInt(this.mod(this.mod(n.y - m.y,pn)*this.invmod(n.x - m.x,pn),pn))
      lambda = this.div(this.sub(n.y,m.y,pn),this.sub(n.x,m.x,pn),pn)
    //console.log("lambda:",lambda)
    x=this.mod(lambda**2n - m.x - n.x,pn)
    y=this.mod(lambda*(m.x-x)-m.y,pn)
    
    return {x:x,y:y}
  }
  curveSub(m,n,p){
    return this.curveAdd(m,this.curveNav(n,p))
  }
  curveMul(k,g,p,m1=null){
    let gn=this.curve.g
    if (g!=null) gn=g
    let pn = this.curve.p
    if (p!=null) pn=p
    let sign=1
    k=BigInt(k)
    if (k%2n==0) sign=0
    if (k==1n) return gn
    if (k>3n) {
      //console.log("=====>",k)
      let k0=k/2n
      m1 = this.curveMul(k0,gn,pn,m1)
    }
    if (!m1)
      m1=this.curveAdd(gn,gn,pn)
    else {
      m1=this.curveAdd(m1,m1,pn)
    }
    if (sign!=0)
      m1 = this.curveAdd(m1,gn,pn)
    //console.log(k,sign,m1)
    return m1
  }
  polyAdd(p1,p2){return p1^p2}
  polySub(p1,p2){return this.polyAdd(p1,p2)}
  polyMul(u,v) {
    let p = 0;
    for (let i = 0; i < 8; ++i) {
      if (u & 0x01) {
        p ^= v;
      }
      let flag = (v & 0x80);
      v <<= 1;
      if (flag) {
          v ^= 0x1B;  /* P(x) = x^8 + x^4 + x^3 + x + 1 */
      }
      u >>= 1;
    }
    return p;
  }  
}
class Poly {
  constructor(a){
    this.c=a  
    this.coef=this.c
    this.o=this.c.length - 1
    this.order = this.o
  }
  ensurePoly(p){if (!(p instanceof Poly)) throw new Error("参数必须是Poly对象")}
  add(p){
    this.ensurePoly(p);
    let x= (this.c.length>p.c.length)?this:p
    let y= (this.c.length>p.c.length)?p:this
    return new Poly(x.c.map((v,i)=>v+(y.c[i]?y.c[i]:0)))
  }
  sub(p){
    this.ensurePoly(p);
    let x= (this.c.length>p.c.length)?this:p
    let y= (this.c.length>p.c.length)?p:this
    return new Poly(x.c.map((v,i)=>v-(y.c[i]?y.c[i]:0)))
  }
  mul(p){
    this.ensurePoly(p);
    let c1=this.c
    let c2=p.c
    let T=[]
    c1.map((x,i)=>c2.map((y,j)=>T[i+j]?T[i+j]+=x*y:T.push(x*y)))
    return new Poly(T)
  }
  div(p){
    this.ensurePoly(p);
    let c1=[...this.c] 
    let c2=[...p.c]
    let c1l = c1.length
    let c2l = c2.length
    let r=[]
    let l=[]
    let ta,tb;
    ta=0;
    for(let i=0;i<c1l-c2l+1;i++){
      r[i]=c1[i]/c2[0];
      tb=ta;
      for(let j=0;j<c2l;j++){
        c1[tb]-=r[i]*c2[j];
        tb+=1;
      }
      ta+=1;
    }
    ta=0
    for(let i=0;i<c1.length;i++){
      if (!ta && Math.abs(c1[i])<=1e-05) continue
      l[ta]=c1[i];
      ta+=1
    }
    return {r:new Poly(r),l:new Poly(l)}
  }
  pow(n){
    if (n==0) return new Poly([1])
    let p=this
    for (let i=0;i<=n-2;i++){
      p=p.mul(p)
    }
    return p
  }
  val(a){
    if (Array.isArray(a))
      return a.map(x=>this.c.map((v,i)=>v*x**(this.o-i)).reduce((m,n)=>m+n))
    return this.c.map((v,i)=>v*a**(this.o-i)).reduce((m,n)=>m+n)
  } 
  deriv(){
    let c=this.c
    let p=c.length - 1
    return new Poly(this.c.map((x,i)=>x*(p-i)).slice(0,p))    
  }
  integ(){
   let c=this.c
   let p=c.length - 1
   let c1=this.c.map((x,i)=>x/(p-i+1))
   c1.push(0)
   return new Poly(c1)
  }
  roots(){} 
}

class Complex{
  constructor(r=0,j=0){
    this.real = r
    this.imag = j
  }
  add(c){return new Complex(this.real+(c.real?c.real:c),this.imag+(c.imag?c.imag:0))}
  sub(c){return new Complex(this.real-(c.real?c.real:c),this.imag-(c.imag?c.imag:0))}
  mul(c){
    if (c instanceof Complex){
      return new Complex(this.real*c.real-this.imag*c.imag,
                         this.real*c.imag+this.imag*c.real)
    }
    return new Complex(this.real*c,this.imag*c)
  }
  div(c){
    if (c instanceof Complex){
      let dis=c.real**2+c.imag**2
      return new Complex((this.real*c.real+this.imag*c.imag)/dis,
                         (this.imag*c.real-this.real*c.imag)/dis)
    }
    return new Complex(this.real/c,this.imag/c)
  }
  conjugate() { //求每个复数的共轭复数
    return new Complex(this.real,value.imag * -1);
  }

  magnitude() { //求每个复数到原点的长度
    return Math.sqrt(this.real**2 + this.imag**2);
  }
}

class ArrayBase{
  constructor(data,dtype = Float32Array){
    if (data instanceof ArrayBase){
      this.dtype = data.dtype
      this.data = data.data
    }else{
      this.dtype = dtype
      this.data = this.ensureArray(data)
    }
    this.length = this.data.length
    this.T = this.data
    if (this.dtype == Complex){
      this.real = this.data.map(x=>x.real)
      this.imag = this.data.map(x=>x.imag)
    }else{
      this.real = this.data
      this.imag = new this.dtype(this.real.length)
    }
  }
  ensureArray(data){
    if (this.dtype == Complex){
      if (Array.isArray(data)){
        return data.map(x=>{
          if (x instanceof Complex) return x
          return new Complex(x)})
      }else{
        let c=[]
        for(let i=0;i<data;i++){
          c.push(new Complex())
        }
        return c
      }
    }else {
     return Array.isArray(data) && data || new this.dtype(data)
    }
  }
  // In-place mapper.
  map(mapper) {
    let value = this.data.map((value,i,n)=>mapper(value, i, n));
    this.data = value
    return this;
  }
  add(x){
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.add(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item+(x.data?x.data[idx]:x)),this.dtype)
  }
  subtract(x){
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.sub(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item-(x.data?x.data[idx]:x)),this.dtype)
  }
  multiply(x){
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.mul(x.data?x.data[idx]:x)),Complex)
    }else if (this.dtype == String){
      return new Vector(this.data.map((item,idx)=>Array(x + 1).join(item)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item*(x.data?x.data[idx]:x)))
  }
  divide(x){
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.div(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item/(x.data?x.data[idx]:x)))
  }
  power(x){return new Vector(this.data.map((item,idx)=>item**(x.data?x.data[idx]:x)))}
  mod(x){return new Vector(this.data.map((item,idx)=>item%(x.data?x.data[idx]:x)))}
  
  sub(x){return this.subtract(x)}
  mul(x){return this.multiply(x)}
  div(x){return this.divide(x)}
  
  reciprocal(){return new Vector(this.data.map((item,idx)=>1/item))}
  sign(){return new Vector(this.data.map((item,idx)=>item>=0?1:-1))}

  gt(x){return new Vector(this.data.map((item,idx)=>item>(x.data?x.data[idx]:x)?true:false))}
  gte(x){return new Vector(this.data.map((item,idx)=>item>=(x.data?x.data[idx]:x)?true:false))}
  lt(x){return new Vector(this.data.map((item,idx)=>item<(x.data?x.data[idx]:x)?true:false))}
  lte(x){return new Vector(this.data.map((item,idx)=>item<=(x.data?x.data[idx]:x)?true:false))}
  eq(x){return new Vector(this.data.map((item,idx)=>item==(x.data?x.data[idx]:x)?true:false))}
  ne(x){return new Vector(this.data.map((item,idx)=>item!=(x.data?x.data[idx]:x)?true:false))}
  close(x){
    return new Vector(this.data.map((item,idx)=>{
        let data=(x.data?x.data[idx]:x)
        return Math.abs(item-data)<=(1e-05+1e-08*data)?true:false
      })
    )
  }
 
  sort(){return new Vector([...this.data].sort())}
   
  sum(){return this.data.reduce((a,b)=>a+b)}
  min(){return this.data.reduce((a,b)=>a>b?b:a)}
  argmin(){return this.data.indexOf(this.min())}
  max(){return this.data.reduce((a,b)=>a<b?b:a)}
  argmax(){return this.data.indexOf(this.max())}
  mean(){return this.sum()/this.data.length}
  std(){return Math.sqrt(this.var())}
  var(){
    let mean = this.mean()
    return this.data.map(x=>(x-mean)**2).reduce((x,y)=>x+y)/this.data.length
  }
  ptp(){return this.max()-this.min()}
  median(){
    let length=parseInt(this.data.length/2)
    if (this.data.length%2!=0) return (this.data[length]+this.data[length-1])/2 
    return this.data[length]
  }
  percentile(p){}
  average(a){}  
  
  allclose(x){return this.close(x).all()}
  all(){return this.data.reduce((a,b)=>a&&b)}
  any(){return this.data.reduce((a,b)=>a||b)}
  
  dot(x){
    return this.data.map((item,idx)=>item*(x.data?x.data[idx]:x)).reduce((i,j)=>i+j)
  }
  norm(){
    return Math.sqrt(this.data.map(a=>a*a).reduce((a,b)=>a+b))
  }
  //normalize(){
  //  return this.dot(1/this.norm())
  //}
}
class Vector extends ArrayBase{
  ensureVector(data){}
  reshape(r,c){
    if ((r*c)!=this.data.length) throw new Error("转换长度不符合")
    let matrix=[]
    let T=[]
    for (let j=0;j<c;j++){
      T.push([])
    }
    for (let i=0 ;i<r;i++){
      let row=[]
      for (let j=0;j<c;j++){
        row.push(this.data[i*c+j])
        T[j].push(this.data[i*c+j])
      }
      matrix.push(row)
    }
    return new Matrix(matrix,this.dtype,{T:T})
  }
  value(){return this.data}
  valueT(){return this.T}
  toString(){
    return this.data
  }
  print(){console.log(this.data)}
  __func(fun,args){
    console.log(args,...args)
    return this.data.map(value=>fun(value,...args))
  }
  copy(){return new Vector(this.value(),this.dtype)}
      
  distance(x,y){
    if (!Array.isArray(x) || !Array.isArray(y)){
      throw new Error("有参数不是数组")
    }
    return this.norm(this.ds(x,y))
  }
  cosine(x,y){
    if (!Array.isArray(x) || !Array.isArray(y)){
      throw new Error("有参数不是数组")
    }
    return this.dp(x,y)/(this.norm(x)*this.norm(y))
  }
}
class Matrix{
  //a=[1,2]
  //b=[[1,2],[3,4]]
  //c=[[[1,2],[3,4]],[[5,6],[7,8]]]
  constructor(data,dtype=Float32Array,args={}) {
    this.dtype = dtype
    this.data = data.map(m=>new Vector(m,this.dtype))
    this._row = data.length
    this._col = data[0].length
    this.size = this._row*this._col
    if (args.T){
      this.T = args.T.map(t=>new Vector(t,this.dtype))
    }else{
      let T=[]
      for (let j=0;j<this._col;j++){
        T.push([])
        for (let i=0 ;i<this._row;i++){
          if (data[i] instanceof Vector){
            T[j].push(data[i].data[j])
          }else{
            T[j].push(data[i][j])
          }
        }
      }
      this.T = T.map(t=>new Vector(t,this.dtype))
    }
  }
  reshape(r,c){
    return this.flatten().reshape(r,c)
  }
  ensureSquareMatrix(){
    if (this._row!=this._col) throw new Error("需要方阵才能执行后续操作")
  }
  flatten(){
    return new Vector(this.data.map(x=>x.data).reduce((x,y)=>x.concat(y)),this.dtype)
  }
  value(){return [...this.data.map(item=>[...item.value()])]}
  valueT(){return [...this.T.map(item=>[...item.valueT()])]}
  print(){
   if (this.dtype == Complex){
     let str
     str=this.data.map(item=>JSON.stringify(item.data)).reduce((x,y)=>x+"\n"+y)
     console.log(`=====data:=====\n${str}`)
     str=this.T.map(item=>JSON.stringify(item.data)).reduce((x,y)=>x+"\n"+y)
     console.log(`=======T=======\n${str}`)
   }else{
     let str
     str=this.data.map(item=>item.toString()).reduce((x,y)=>x+"\n"+y)
     console.log(`=====data:=====\n${str}`)
     str=this.T.map(item=>item.toString()).reduce((x,y)=>x+"\n"+y)
     console.log(`=======T=======\n${str}`)
   }
  }
  row(m=0,n=0){
    if (m<0) m = this._row + m
    if (n<0) n = this._row + n
    if (n>this._row) n = this._row
    if (n<m) n=m
    let arr=[]
    for(let i=m ;i<=n;i++){
      if (this.data[i])
        arr.push(this.data[i])
    }
    if (arr.length>0) 
     return new Matrix(arr,this.dtype)
    return null
  }
  col(m=0,n=0){
    if (m<0) m = this._col + m
    if (n<0) n = this._col + n
    if (n>this._col) n = this._col
    if (n<m) n=m
    let arr=[]
    for(let i=m ;i<=n;i++){
      if (this.T[i])
        arr.push(this.T[i])
    }
    if (arr.length>0) 
     return new Matrix(arr,this.dtype).transpose()
    return null
  }

  copy(){return new Matrix(this.value(),this.dtype)}
  
  add(x){return new Matrix(this.data.map((item,idx)=>item.add(x.data?x.data[idx]:x)),this.dtype)}
  subtract(x){return new Matrix(this.data.map((item,idx)=>item.subtract(x.data?x.data[idx]:x)),this.dtype)}
  multiply(x){return new Matrix(this.data.map((item,idx)=>item.multiply(x.data?x.data[idx]:x)),this.dtype)}
  divide(x){return new Matrix(this.data.map((item,idx)=>item.divide(x.data?x.data[idx]:x)),this.dtype)}
  power(x){return new Matrix(this.data.map((item,idx)=>item.power(x.data?x.data[idx]:x)),this.dtype)}
  mod(x){return new Matrix(this.data.map((item,idx)=>item.mod(x.data?x.data[idx]:x)),this.dtype)}
  
  sub(x){return this.subtract(x)}
  mul(x){return this.multiply(x)}
  div(x){return this.divide(x)}
  
  reciprocal(){return new Matrix(this.data.map((item,idx)=>item.reciprocal()),this.dtype)}
  sign(){return new Matrix(this.data.map((item,idx)=>item.sign()),this.dtype)}
  
  gt(x){return new Matrix(this.data.map((item,idx)=>item.gt(x.data?x.data[idx]:x)))}
  gte(x){return new Matrix(this.data.map((item,idx)=>item.gte(x.data?x.data[idx]:x)))}
  lt(x){return new Matrix(this.data.map((item,idx)=>item.lt(x.data?x.data[idx]:x)))}
  lte(x){return new Matrix(this.data.map((item,idx)=>item.lte(x.data?x.data[idx]:x)))}
  eq(x){return new Matrix(this.data.map((item,idx)=>item.eq(x.data?x.data[idx]:x)))}
  ne(x){return new Matrix(this.data.map((item,idx)=>item.ne(x.data?x.data[idx]:x)))}
  close(x){return new Matrix(this.data.map((item,idx)=>item.close(x.data?x.data[idx]:x)))}
  
  sort(axis=null){
    if (axis==null) return new Vector(this.flatten().sort())
    return new Matrix((axis==0?this.T:this.data).map(x=>x.sort()))
  }

  sum(axis=null){
    if (axis==null) return this.flatten().sum()
    return new Vector((axis==0?this.T:this.data).map(x=>x.sum()))
  }
  min(axis=null){
    if (axis==null) return this.flatten().min()
    return new Vector((axis==0?this.T:this.data).map(x=>x.min()))
  }
  argmin(axis=null){
    if (axis==null) return this.flatten().argmin()
    return new Vector((axis==0?this.T:this.data).map(x=>x.argmin()))
  }
  max(axis=null){
    if (axis==null) return this.flatten().max()
    return new Vector((axis==0?this.T:this.data).map(x=>x.max()))
  }
  argmax(axis=null){
    if (axis==null) return this.flatten().argmax()
    return new Vector((axis==0?this.T:this.data).map(x=>x.argmax()))
  }
  mean(axis=null){
    if (axis==null) return this.flatten().mean()
    return new Vector((axis==0?this.T:this.data).map(x=>x.mean()))
  }
  std(axis=null){
    if (axis==null) return this.flatten().std()
    return new Vector((axis==0?this.T:this.data).map(x=>x.std()))
  }
  var(axis=null){
    if (axis==null) return this.flatten().var()
    return new Vector((axis==0?this.T:this.data).map(x=>x.var()))
  }
  ptp(axis=null){
    if (axis==null) return this.flatten().ptp()
    return new Vector((axis==0?this.T:this.data).map(x=>x.ptp()))
  }
  median(axis=null){
    if (axis==null) return this.flatten().median()
    return new Vector((axis==0?this.T:this.data).map(x=>x.median()))
  }
  percentile(p,axis){
    if (axis==null) return this.flatten().percentile(p)
    return new Vector((axis==0?this.T:this.data).map(x=>x.percentile(p)))
  }
  average(a,axis){
    if (axis==null) return this.flatten().average(a)
    return new Vector((axis==0?this.T:this.data).map(x=>x.average(a)))
  }

  norm(axis=null){
    if (axis==null) return this.flatten().norm()
    return new Vector((axis==0?this.T:this.data).map(x=>x.norm()))
  }
  
  allclose(x){return this.close(x).all()}
  all(axis=null){
    if (axis==null) return this.flatten().all()
    return new Vector((axis==0?this.T:this.data).map(x=>x.all()))
  }
  any(axis=null){
    if (axis==null) return this.flatten().any()
    return new Vector((axis==0?this.T:this.data).map(x=>x.any()))
  }
  
  transpose(){
    return new Matrix(this.T,this.dtype,{T:this.data})
  }
  vstack(a){
    if (a.data.length!=this.data.length) throw new Error("矩阵列数不符合要求")
    let data=[...this.data]
    a.data.map(x=>data.push(x))
    return new Matrix(data,this.dtype)
  }
  hstack(a){
    if (a.T.length!=this.T.length) throw new Error("矩阵行数不符合要求")
    return new Matrix(this.data.map((x,i)=>x.data.concat(a.data[i].data)),this.dtype)
  }
  vsplit(m,n){return a.vsplit(m,n)}
  hsplit(m,n){return a.hsplit(m,n)}

  dot(a){
    let b
    if (this._col==a._row){
      return new Matrix(this.data.map(x=>a.T.map(y=>y.dot(x))))
    }else if (this._row==a._col){
      return new Matrix(a.data.map(x=>this.T.map(y=>y.dot(x))))
    }else if (this._col!=a._row && (a._row==1 && a._col==this._col)){
      b = a.transpose()
      return new Matrix(this.data.map(x=>b.T.map(y=>y.dot(x))))
    }else if (this._row!=a._col && (a._col==1 && a._row==this._row)){
      b = this.transpose()
      return new Matrix(b.data.map(x=>a.T.map(y=>y.dot(x))))
    }else{
      throw new Error("矩阵相乘行列不一致")
    }
    //return a.T.map(x=>{
    //  return this.data.map(y=>y.dot(x))
    //})
  }
  lu(){
    let data = this.value()
    let row = this._row
    let col = this._col
    let s = (row < col)?row:col
    for (let k=0;k<s;k++){
      let x=1/data[k][k]
      for (let i=k+1;i<row;i++){
        data[i][k] = data[i][k] * x        
      }
      for (let i=k+1;i<row;i++){
        for (let j=k+1;j<col;j++){
          data[i][j] = data[i][j] - data[i][k]*data[k][j]
        }
      }
    }
    return new Matrix(data)
  }
  det(permute,lu=true){
    this.ensureSquareMatrix()
    if (lu) {  //lu分块分解快速计算det
      let x=1
      let m=this.lu()
      for (let i=0;i<m._row;i++){
        x=x*m.data[i].data[i]
      }    
      return x    
    }
    
    let data=this.value()
    switch (this._row){
      case 2:
        return data[0][0]*data[1][1] - data[0][1]*data[1][0]
      case 3:
        return data[0][0]*data[1][1]*data[2][2] +
               data[1][0]*data[2][1]*data[0][2] +
               data[2][0]*data[0][1]*data[1][2] -
               data[0][2]*data[1][1]*data[2][0] -
               data[1][2]*data[2][1]*data[0][0] -
               data[2][2]*data[0][1]*data[1][0]
      default:
        if (!permute){
          let argN=[]
          for(let i=0;i<this._row;i++){
            argN.push(i)
          }
          permute = np.permute(argN)
        }
        return permute.map(x=>{
          let invert = np.invertCount(x)
          return x.split("").map((y,i)=>data[i][y])
                            .reduce((x,y)=>x*y)*(-1)**invert
        }).reduce((x,y)=>x+y)
    }
  }
  adjoint(){
    this.ensureSquareMatrix()
    let data=this.value()
    let arr=[]
    let det=[]
    let permute=[]
    switch (this._row){
      case 2:
        arr[0]=data[1][1]*(-1)**(1+1)
        arr[1]=data[0][1]*(-1)**(0+1)
        arr[2]=data[1][0]*(-1)**(1+0)
        arr[3]=data[0][0]*(-1)**(0+0)                                                 
        return np.array(arr).reshape(2,2)
      default:
        let temp=[]
        for(let i=0;i<this._row-1;i++){temp.push(i)}
        permute = np.permute(temp)
        for(let i=0;i<this._row;i++){
          let m = [...data]
          m.splice(i,1)
          for(let j=0;j<this._col;j++){
            let n = m.map(y=>{
              let yy=[...y]
              yy.splice(j,1);return yy
            })
           det.push(new Matrix(n).det(permute)*(-1)**(i+j))
           //console.log(i,j,n,det)
          }
        }
        return np.array(det).reshape(this._row,this._row).transpose()
    }
  }
  inv(){
    let det = this.det()
    if (det==0) throw new Error("矩阵det=0,该矩阵不存在可逆矩阵")
    return this.adjoint().divide(det)
  }
  solve(b){
    return this.inv().dot(b).value()
  }
}
  
class Numpy{
  Vector(a,dtype){
    return new Vector(a,dtype)
  }
  Matrix(a,dtype){
    let ndim = this.ndim(a)
    if (ndim==1) 
      return new Matrix([a],dtype)
    return new Matrix(a,dtype)
  }
  ndim(a){
    if (a instanceof Vector) return 1
    if (a instanceof Matrix) return 2
    if (typeof a =="number") return 1
    if (!Array.isArray(a)) return 0
    let dim=0
    let b=[...a]
    while (Array.isArray(b)){
      dim++
      b=b[0]
    }
    return dim
  }
  arange(start,end,step,dtype){
    if (typeof end=="function"){
      dtype = end
      end = null
      step = null
    }
    if (!end) {
      end = start
      start = 0
    }
    if (!step) {
      step = 1
    }
    let arr=[]
    for (let i=start;i<end;i+=step){
      arr.push(i)
    }
    return this.array(arr,dtype)
  }
  linspace(start,end,num,dtype){
    if (typeof end == "function"){
      dtype = end
      num = start
      start = 0
      end = num
    }
    let step = (end - start ) / num
    let arr=[]
    for (let i=0;i<num;i++){
      arr.push(start)
      start +=step
    }
    return this.array(arr,dtype)
  }
  mat(str,dtype){
    let data=str.split(";")
    let arr = data.map(x=>x.replace(/\s+/g,",").split(",").map(x=>parseFloat(x)))
    return this.array(arr,dtype)
  }
  __reset(value,dtype,shape=1,...args){
    let size=shape
    let arr=[]
    let r,c=0
    if (typeof shape!="number"){
      r=shape[0]
      c=shape[1]||1
      size = r*c
    }
    for (let i=0;i<size;i++){
      if (typeof value=="function"){
        if (dtype==Complex){
          arr.push(new Complex(value(i,args),value(i,args)))
        }else {
          arr.push(value(i,args))
        }
      }else{
        if (dtype==Complex){
          arr.push(new Complex(value))
        }else{
          arr.push(value)
        }
      }
    }
    if (size==shape){
      return this.array(arr,dtype)
    }else{
      return this.array(arr,dtype).reshape(r,c)
    }
  }
  zeros(shape=1,dtype){
    return this.__reset(0,dtype,shape)
  }
  ones(shape=1,dtype){
    return this.__reset(1,dtype,shape)
  }
  eye(number,dtype){//对角矩阵
    return this.__reset((i,args)=>{
        let n=args[0]
        return (i%n==parseInt(i/n))?1:0
      },dtype,new Array(number,number),number)
  }
  diag(array,dtype){//自定义对角阵
    let len=array.length
    return this.__reset((i,args)=>{
        let n=args[0].length
        return (i%n==parseInt(i/n))?args[0][i%n]:0
      },dtype,new Array(len,len),array)
  }
  random(shape,dtype){//随机矩阵
    return this.__reset((i,args)=>{
        return Math.random()
      },dtype,shape)
  }
    
  array(data,dtype){
    dtype = dtype || Float32Array
    let ndim = this.ndim(data)
    if (ndim==1) { 
      return new Vector(data,dtype)
    }else if (ndim==2){
      return new Matrix(data,dtype)
    }else{
      throw new Error("不支持的数据维度")
    }
  }
  size(object){
    if (Array.isArray(object)) return object.length
    if (object instanceof Vector) return object.length
    if (object instanceof Matrix) return object.size
  }
  shape(object){
    if (Array.isArray(object)) return object.length
    if (object instanceof Vector) return [object.length]
    if (object instanceof Matrix) return [object._row,object._col]
  }
  
  invertCount(str){
    let a = str.split("")
    let c=0
    while(a.length>1){
      let b=a.splice(0,1)[0]
      c+=a.map(x=>b>x?1:0).reduce((x,y)=>x+y)
    }
    return c
  }
  permute(arr){
    let data=[]
    function inner(arr,s){
      let a=[...arr]
      a.map(x=>{
        if (a.length>1) return inner(a.filter(y=>y!=x),s+x)
        data.push(s+a[0])
      })
    }
    inner(arr,"")
    //console.log("permute:",arr.length,data.length)
    return data
 }

  __func(fun,object,...args){
    if (object instanceof Matrix)
      return new Matrix(object.data.map(a=>a.__func(fun,args)))
    return new Vector(object.__func(fun,args))
  }
  sin(object){return this.__func(Math.sin,object)}
  cos(object){return this.__func(Math.cos,object)}
  tan(object){return this.__func(Math.tan,object)}
  log(object){return this.__func(Math.log,object)}
  log2(object){return this.__func(Math.log2,object)}
  log10(object){return this.__func(Math.log10,object)}
  exp(object){return this.__func(Math.exp,object)}
  sqrt(object){return this.__func(Math.sqrt,object)}
  around(object,n){return this.__func((data,n)=>{
      let a=10**n
      return Math.round(data*a)/a
    },object,n)}
  floor(object){return this.__func(Math.floor,object)}
  ceil(object){return this.__func(Math.ceil,object)}
  
  ensureValid(a,b){
    if (!(a instanceof Matrix || a instanceof Vector)) throw new Error("对象不符合要求")
    if (typeof(b)!="number"){
      if (this.shape(a).toString()!=this.shape(b).toString()) throw new Error("对象形状不一致")
      }
  }
  ensureMatrix(...a){
    a.map(x=>{
      if (!x instanceof Matrix) throw new Error("对象要求是Matrix")
    })
  }
  ensurePoly(...a){
    a.map(x=>{
      if (!x instanceof Poly) throw new Error("对象要求是Poly")
    })
  }
  add(a,b){this.ensureValid(a,b);return a.add(b)}  
  subtract(a,b){this.ensureValid(a,b);return a.subtract(b)}
  multiply(a,b){this.ensureValid(a,b);return a.multiply(b)}
  divide(a,b){this.ensureValid(a,b);return a.divide(b)}
  power(a,b){this.ensureValid(a,b);return a.power(b)}
  mod(a,b){this.ensrueValid(a,b);return a.mod(b)}
  
  sub(a,b){return this.sub(a,b)}
  mul(a,b){return this.mul(a,b)}
  div(a,b){return this.div(a,b)}
  
  gt(a,b){this.ensureValid(a,b); return a.gt(b)}
  gte(a,b){this.ensureValid(a,b);return a.gte(b)}
  lt(a,b){this.ensureValid(a,b); return a.lt(b)}
  lte(a,b){this.ensureValid(a,b);return a.lte(b)}
  eq(a,b){this.ensureValid(a,b); return a.eq(b)}
  ne(a,b){this.ensureValid(a,b); return a.ne(b)}
  close(a,b){this.ensureValid(a,b); return a.close(b)}
  
  reciprocal(a){return a.reciprocal()}
  sign(a){return a.sign()}
  
  copy(a){return a.copy()}
  
  transpose(a){this.ensureMatrix(a);return a.transpose()}
  vstack(a,b){this.ensureMatrix(a,b);return a.vstack(b)}
  hstack(a,b){this.ensureMatrix(a,b);return a.hstack(b)}
  vsplit(a,m,n){return a.vsplit(m,n)}
  hsplit(a,m,n){return a.hsplit(m,n)}
  
  nonzero(){}
  where(){}
  extract(){}
  
  sort(x,axis){return x.sort(axis)}
  
  sum(x,axis){return x.sum(axis)}
  min(x,axis){return x.min(axis)}
  argmin(x,axis){return x.argmin(axis)}
  max(x,axis){return x.max(axis)}
  argmax(x,axis){return x.argmax(axis)}
  mean(x,axis){return x.mean(axis)}
  std(x,axis){return x.std(axis)}
  var(x,axis){return x.var(axis)}
  ptp(x,axis){return x.ptp(axis)}
  median(x,axis){return x.median(axis)}
  percentile(x,p,axis){return x.percentile(p,axis)}
  average(x,a,axis){return x.average(a,axis)}

  norm(x,axis){return x.norm(axis)}
  
  allclose(a,b){this.ensureValid(a,b);return a.allclose(b)}
  all(x,axis){return x.all(axis)}
  any(x,axis){return x.any(axis)}
  
  dot(a,b){return a.dot(b)}
  det(a){this.ensureMatrix(a);return a.det()}
  inv(a){this.ensureMatrix(a);return a.inv()}
  solve(a,b){this.ensureMatrix(a);return a.solve(b)}
  
  poly1d(a){return new Poly(a)}
  polyadd(p1,p2){this.ensurePoly(p1,p2);return p1.add(p2)}
  polysub(p1,p2){this.ensurePoly(p1,p2);return p1.sub(p2)}
  polymul(p1,p2){this.ensurePoly(p1,p2);return p1.mul(p2)}
  polydiv(p1,p2){this.ensurePoly(p1,p2);return p1.div(p2)}
  polyval(p,a){this.ensurePoly(p);return p.val(a)}
  deriv(p){this.ensurePoly(p);return p.deriv()}
  integ(p){this.ensurePoly(p);return p.integ()}
  roots(p){this.ensurePoly(p);return p.roots()}
}

exports.ecc  = new ECC()  
exports.rsa  = new RSA() 
exports.hashlib = new Hashlib()
exports.bufferlib  = new Bufferlib()
exports.logger  = new Logger()
exports.set     = new MySet()
exports.db      = new DB()
exports.http    = new MyHttp()
exports.gf      = new GF()
exports.fft     = new myFFT()
exports.np      = new Numpy()
exports.ComplexArray = ComplexArray
exports.Complex = Complex
exports.Poly    = Poly
exports.Vector  = Vector
exports.Matrix = Matrix