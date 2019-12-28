assets:
{"title":"健康合约2.1"
}
//通用合约封装
version("2.1")
let contract
class Cta{
  constructor(appName){
    this.appName = appName
    this.args = null
  }
  init(cta,args){
    if (this.args) throw new Error("合约已经被初始化!")
    this.args = args
    contract = cta
  }
  onlyInit(){
    if (!contract || !this.args) throw new Error("合约还没有被初始化!")
  }
  onlyOwner(caller){
    if (caller != contract.owner) throw new Error(`[${caller}]必须是创建者[${contract.owner}]才能调用该函数!`)
  }
  onlyId(caller){
    this.onlyInit()
    if (this.args.id!=caller){
      throw new Error(`该合约只能由${this.args.id}调用！`)
    }
  }
  sayHello(msg){
     this.onlyInit()
     return `hello ${msg},this is app {${this.appName}}!!!!!`
  }
  async set (data,caller,amount,crypt=false,ipfs=false){
     this.onlyInit()
     this.onlyId(caller)
     if (!ipfs){
       return contract.set(data,caller,amount,crypt)
     }else{
       return contract.ipfsAdd(data)
                .then(x=>{
                   let data = {}
                   data[caller]={"ipfs":[x[0].hash]}
                   return contract.set(data,caller,amount,crypt)
                })
                .catch(err=>{
                  return err
                })
     }
  }
  async get(key=null,inAddr=null,list=false,ipfs=false){
     this.onlyInit()
     if (!ipfs){
       return contract.get(key,inAddr,list)
     }else{
       let pm = new Promise((resolve,reject)=>{
         contract.get(inAddr+".ipfs",inAddr).then(x=>{
             if (!x.data) {
               resolve(null)
               return
             }
             let pmAll = x.data.map(y=>contract.ipfsCat(y).then(z=>{
               return {"data":JSON.parse(z.toString()),"_timestamp":x._timestamp}
              })) 
             Promise.all(pmAll).then(result=>resolve(result))   
         })
       })
       return pm.then(result=>{
          if (!result){
            return []
          }
          console.log("result,key:",result,key)
          result = result.map(item=>{
            let itemData = item.data
            if (key){
              let keys=key.split(".")
              itemData = keys.reduce(function(xs, x) {
                return (xs && xs[x]) ? xs[x] : null;
              },itemData);
            }
            if (!itemData) return {}
            let itemWrap={"data":itemData,"_timestamp":item._timestamp}
            if (list){
              itemWrap = {list:[itemWrap]}
            }
            return itemWrap
          })
          console.log("map:",result)
          result = result.filter(x=>Object.keys(x).length!=0)
          return result.reduce((x,y)=>{
            return deepmerge(x,y,{arrayMerge:(target,source,options)=>{
                for (let item of source){
                   if (target.indexOf(item)!==-1) continue;
                   target.push(item)
                }
                return target
              }
            })
          })
       })
     }     
  }
  async getBalance(address){
      return contract.getBalance(address)
  }
  async getBalancePaid(address){
     return contract.getBalancePaid(address)
  }
  async payTo(address,amount,assets){
    return contract.payTo(address,amount,assets)
  }
  async getAccount(address){
    return contract.getAccount(address)
  }
  getStock(code,start,end){
    if (!end) end=start
    let url =`http://q.stock.sohu.com/hisHq?code=cn_${code}&start=${start}&end=${end}`
    return ajax(url).then(x=>{
      let res = JSON.parse(x)   
      if (Array.isArray(res)){
        if (res[0].status==0)
           return res[0].hq
        return res
      }
      return res
    })
  }
}
instance = new Cta("health")
return instance

//
//assets:
{"title":"健康合约149obCeuqpq3GiNpZyKwRH32mCGKH8B4Tr",
 "allowAddress":["149obCeuqpq3GiNpZyKwRH32mCGKH8B4Tr"]
}


//youht 部署自己的健康合约
version("1.15")
cta = new Contract()
youht = getInstance('ad4e12499002268c8d379b7b649a35ebe9449f41')
youht.init(cta,{id:'1GwLJBGhDG11T1WPqT28FxiMafLNQVyJpz'})
return youht
//2a38c0b389b691a69e1db3be35102a183a4f7e28

//添加数据
cta = getInstance("2a38c0b389b691a69e1db3be35102a183a4f7e28")
return cta.set({"20191128":{"steps":[{"value":3000,"time":"12:00:00"}],"height":[{"value":1.74,"time":"12:00:00"}]}},"1GwLJBGhDG11T1WPqT28FxiMafLNQVyJpz",0,false,true)
cta = getInstance("2a38c0b389b691a69e1db3be35102a183a4f7e28")
return cta.set({"20191128":{"steps":[{"value":4000,"time":"15:00:00"},{"value":5000,"time":"16:30:00"}],"weight":[{"value":74.6,"time":"15:00:00"}]}},"1GwLJBGhDG11T1WPqT28FxiMafLNQVyJpz",0,true,true)



//
cta = getInstance("2a38c0b389b691a69e1db3be35102a183a4f7e28")
return cta.get()

// jinli 部署自己的健康合约
version("1.15")
cta = new Contract()
jinli = getInstance('ad4e12499002268c8d379b7b649a35ebe9449f41')
jinli.init(cta,{id:'15Tbu8qP22zaiTH1CFvosoEAsUXvqw9YeJ'})
return jinli
//2ffcfc97d77411930ae81fcab3f9b1c258f39cf3


let x={"a":[1,2,3]}  
let y={"a":[4,5,6]}
return deepmerge(x,y,{arrayMerge:
          (target,source,options)=>{
            for (let item of source){
             if (target.indexOf(item)!==-1) continue;
             target.push(item)
            }
            return target
          }
        })

cta = getInstance("589a8398be9e97551446f33be4604f2a70648359")
return cta.get(null,"1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z").then(x=>{
    cid = x.data["1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z"]["ipfs"]
    return cid.map(y=>{
       return y
       return base.ipfsCat(y).then(z=>{
         return "abc"
       })
   })
})

base = new Contract()
cta = getInstance("589a8398be9e97551446f33be4604f2a70648359")
return cta.get(null,"1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z").then(x=>{
    cid = x.data["1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z"]["ipfs"]
    abc = async.map(cid, (arr, cb) => {
        base.ipfsCat(y).then(z=>{
          cb(null,JSON.parse(z.toString())
        })
    }, (err, result) => {
    //当err存在，则执行foo(err)错误处理函数，否则不执行
        err && foo(err);
        console.log(result);
        done();
    });
    console.log("******************************",abc)
    return abc
   })
})

cid = ["QmfQykVDsk6XzaMR3mjPtDn8YBRsmnj2A8T1Q3FWsMZExd","QmXo27eb8DckaGboeheXkewESvw3TCRJ1JtaYshsc5rcWy","QmNTRfmakhWMkw4wkfrcxP3oDvZBXFEGWNctRjBdhRCGnA"]
base = new Contract()
cta = getInstance("589a8398be9e97551446f33be4604f2a70648359")
return cta.get(null,"1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z").then(x=>{
    cid = x.data["1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z"]["ipfs"]
    allP=cid.map(x=>{
      new Promise((resolve,reject)=>{
        base.ipfsCat(x).then(z=>resolve(JSON.parse(z.toString())))
      }
    }
    return Promise.all(allP).then(x=>x)
})

base = new Contract()
cta = getInstance("589a8398be9e97551446f33be4604f2a70648359")
a=new Promise((resolve,reject)=>{
  cta.get(null,"1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z").then(x=>{
    cid = x.data["1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z"]["ipfs"]
    allP=cid.map(x=>{
      new Promise((resolve,reject)=>{
        base.ipfsCat(x).then(z=>resolve(JSON.parse(z.toString())))
      })
    })
    resolve(Promise.all(allP).then(x=>x))
})
a.then(x=>x)

base = new Contract()
cta = getInstance("589a8398be9e97551446f33be4604f2a70648359")
a=new Promise((resolve,reject)=>{
    cta.get(null,"1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z").then(x=>{
      cid = x.data["1Dt9MhUcfyzspoZ3b53N3EHRk2o12g8n8z"]["ipfs"]
      allP=cid.map(x=>{
        new Promise((resolve,reject)=>{
          base.ipfsCat(x).then(z=>resolve(JSON.parse(z.toString())))
        })
      })
      resolve(Promise.all(allP))
  })
})
return a.then(x=>x.then(y=>y))

//正解
base = new Contract()
cta = getInstance('589a8398be9e97551446f33be4604f2a70648359')
pm = new Promise((resolve,reject)=>{
    cta.get("z.ipfs").then(x=>{
           pmAll = x.data.map(y=>base.ipfsCat(y).then(z=>JSON.parse(z.toString()))) 
           Promise.all(pmAll).then(result=>resolve(result))   
    })
})
return pm.then(result=>{
     return deepmerge(result[0],result[1])
})