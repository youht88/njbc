
const utils = require("../utils.js")
const async = require("async")

async function insert(coll,dict){
  await utils.db.insertOne(coll,dict)
    .then(r=>{
      console.log(4,r.result)})
    .catch(e=>{
      console.log(5,e)})
}

async function fun (){
 await utils.db.init("192.168.31.119:27017/test")
 
 console.log("insert1")
 await utils.db.insertOne("test",{a:1,b:2,c:3})
  .then(r=>{
   console.log(2,r.result)
 }).catch(e=>{
   console.log(3,e)
 })
 
 console.log("insert2")
 await insert("test",{x:"a",y:"b",z:"c"})
 console.log("insertMany")
 await utils.db.insertMany("test",[{name:"youht",age:20},{name:"jinli",age:30}])
 console.log("findOne")
 await utils.db.findOne("test",{x:{$exists:1}},      (e,r)=>{console.log(6.1,r)})
   .then(r=>{
   console.log(6.2,r)    
 })
 console.log("updateOne")
 await utils.db.updateOne("test",{x:'a'},{$set:{name:"xxx"}}).then(r=>{
      console.log(7,r.result)
   })
 await utils.db.updateOne("test",{x:"abc"},{$set:{name:"xyz"}},{upsert:true}).then(r=>{
      console.log(8,r.result)
   })
 console.log("findMany")
/* await utils.db.findMany("test",{name:{$exists:1}},{"projection":{"_id":1,"name":1},"sort":[["_id","descending"]]},(e,r)=>r.then(
           r0=>console.log(9.1,r0)))
     .then(r=>console.log(9.2,r.result))
     .catch(e=>console.log(9.3,e))
*/
 await utils.db.findMany("test",{name:{$exists:1}},{"projection":{"_id":1,"name":1},"sort":[["_id","ascending"]]}).then(
   x=>console.log(9,x)
 )     
 console.log("count")
 await utils.db.count("test",{}).then(r=>{
         console.log(10,`count=${r}`)
       })
       
 console.log("aggregate")
 await utils.db.aggregate("test",[{$match:{age:{$exists:1}}},{$project:{_id:0,age:1}},{$group:{_id:null,count:{$sum:1}}}]).then(r=>{
   console.log(11,r)
 })      

 console.log("exec fun1...")
 await fun1().then(x=>console.log("12,exec fun1",x))
 
 console.log("deleteManay")
 await utils.db.deleteMany("test",{}).then(r=>{
         console.log(13,r.result)
       })
}

async function fun1(){
  return new Promise(async (resolve,reject)=>{
    let pool=[]
    await utils.db.findMany("test",{},{"projection":{_id:0}}).then(docs=>{
      for ( doc of docs){
        pool.push(doc)
      }
    })
    resolve(pool)
  })
}

fun().then(r=>{
        console.log(14.1,"运行结束")
        utils.db.close()
      }).catch(e=>console.log(14.2,e))
     
console.log("0")

process.on('SIGINT', function() {
  console.log('收到 SIGINT 信号。');
  utils.db.close()  
});

