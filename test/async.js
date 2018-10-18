fs=require('fs')
async = require('async')
utils = require('../utils.js')
async function fs1(){
  return new Promise((resolve,reject)=>{
    fs.readFile('../node.js','utf8',(err,data)=>{
      if (err) 
       reject(err)
      resolve(data)
    })
  })
}
async function fs2(){
  return new Promise((resolve,reject)=>{
    fs.readFile('../miner.js','utf8',(err,data)=>{
      if (err) 
        reject(err)
      resolve(data)
    })
  })
}

async function serial(){
  console.log("serial function")
  const data1 = await fs1()
  console.log("serial data1",utils.hashlib.sha256(data1))
  const data2 = await fs2()
  console.log("serial data2",utils.hashlib.sha256(data2))
}

async function parallel(){
  console.log("parallel function")
  const [result1,result2] = await Promise.all([fs1(),fs2()])
  console.log("parallel data1",utils.hashlib.sha256(result1))
  console.log("parallel data2",utils.hashlib.sha256(result2))
}

(async ()=>{
  console.log(new Array(20).join("*"))
  
  await serial()
  await parallel()
  for(var i=0 ;i<5;i++){
    const data = fs1()
    console.log(`node${i}`,utils.hashlib.sha256(data))
  }
  for(var i=0 ;i<5;i++){
    const data = await fs2()
    console.log(`miner${i}`,utils.hashlib.sha256(data))
  }

})()


let peers
let nodes=[]
async function fun(){
  return new Promise((resolve,reject)=>{
    fs.readFile('../peers','utf8',(err,data)=>{
      if (err){
       reject(new Error("err happend"))
      }
      if (data){
        peers = data.replace(/[\r\n]/g,"")
      }else{
        peers = "zw0_nbc.youht.cc:8084"
      }
      nodes=peers.split(',')
      console.log("done.","nodes",nodes)
      resolve({nodes:nodes,peers:peers})
    })
   })
}
(async ()=>{
  console.log(new Array(20).join("*"))
  await fun()
   .then((data)=>console.log("nodes",data.nodes,"peers",data.peers))
   .catch(err=>console.log("err",err))
  console.log("peers",peers,"nodes",nodes)
})()


function f1(args){
  console.log(args)
}
async function sleep(fn,args,timeout){
  return new Promise((resolve,reject)=>{
    setTimeout(()=>resolve(fn(args)),timeout)
  })
}

(async ()=>{
  console.log(new Array(20).join("*"))
  console.time("timeout1")
  await sleep(f1,"hello",2000)
  console.timeEnd("timeout1")
  console.time("timeout2")
  await sleep(f1,"youht",4000)
  console.timeEnd("timeout2")
  console.log("timeout end")
})()

//test class 
class A{
  constructor(name){
    if (name)
      return (async ()=>{
        console.log("resolve",await this.asyncFun(name))
        return this
      })()
  }
  async asyncFun(name){
    return new Promise((resolve,reject)=>{
      setTimeout(()=>{
        console.log("asyncFun",name)
        this.name=name
        resolve('ok')
      },2000,name)    
    })
  }
}
async function classFun(){
  let a= await new A("youht")
  console.log("a.name",a.name)
}
classFun()

a=new A()
a.asyncFun("jinli")
  .then(()=>console.log(a.name))
  
b=new A("youyc")
console.log("bbbb",b.name)

console.log("start...")

