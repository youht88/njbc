const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const vm = require('vm')

class Contract{
  constructor(script,sandbox={}){
    this.status=0
    this.compileError=null
    this.executeError=null
    try{
      this.script=new vm.Script(script)
      this.setSandbox(sandbox)
    }catch(error){
      throw error
    }
  }
  check(){
    let result
    try{
      result=this.script.runInContext(this.sandbox,{timeout:global.contractTimeout})
    }catch(error){
      throw error
    }
    return result
  }
  setSandbox(sandbox){
    sandbox["async"]   = require("async")
    sandbox["setTimeout"] = setTimeout
    sandbox["crypto"]  = require('./utils.js').crypto
    sandbox["hashlib"] = require('./utils.js').hashlib
    sandbox["base64"]  = require('./utils.js').base64

    sandbox["fs"]=require("fs")
    sandbox["getBalance"] = (address)=>{
       if (global.blockchain)
         return global.blockchain.utxo.getBalance(address)
    }
    sandbox["getBlock"] = (indexOrHash)=>{
       if (global.blockchain)
         if (typeof(indexOrHash)=="string"){
           return global.blockchain.findBlockByHash(indexOrHash)
         }else{
           return global.blockchain.findBlockByIndex(indexOrHash)
         }
    }
    sandbox["getLastBlock"] = ()=>{
       if (global.blockchain)
         return global.blockchain.lastblock()
    }
    sandbox["getMaxIndex"] = ()=>{
       if (global.blockchain)
         return global.blockchain.maxindex()
    }
    sandbox["getTransaction"] = (hash)=>{
       if (global.blockchain)
         return global.blockchain.findTransaction(hash)
    }
    sandbox["getContract"] = (hash)=>{
       if (global.blockchain)
         return global.blockchain.findContract(hash)
    }
    sandbox["loop"] = ()=>{
      while (true){
      }
    }
    sandbox["nowE8"]= ()=>new Date(new Date().getTime()+28800000)
    this.sandbox=vm.createContext(sandbox)
  }
}    

exports.Contract = Contract
