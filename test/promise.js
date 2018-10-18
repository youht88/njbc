let isFun1=isFun2=false
async function fun1(t){
  //if (isFun1 || isFun2) return
  return new Promise((resolve,reject)=>{
    if (isFun2){
      console.log("fun2 is running")
      resolve()
    }
    if (isFun1){
      console.log("I am running,fun1")
      resolve()
    }
    isFun1=true
    setTimeout(()=>{
      isFun1=false
      console.log("fun1 end")
      fun2(4000)
      resolve("fun1 end")
    },t)
  })
}

async function fun2(t){
  //if (isFun1 || isFun2) return
  return new Promise((resolve,reject)=>{
    if (isFun1){
      console.log("fun1 is running")
      resolve()
    }
    if (isFun2){
     console.log("I am running,fun2")
     resolve()
    }
    isFun2=true
    setTimeout(()=>{
      isFun2=false
      console.log("fun2 end")
      fun1(2000)
      resolve("fun2 end")
    },t)
  })
}

fun1(2000)

//setInterval(fun1,2000,1000)
//setInterval(fun2,1000,5000)

setTimeout(()=>console.log('ok'),10000)
