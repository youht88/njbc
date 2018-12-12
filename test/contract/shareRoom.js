version("^0.1.5")

class ShareRoom extends Contract{
  async registerRoom(args={}){
    if (!this.isDeployed) throw new Error("合约尚未部署")
    //chech args
    let data={}
    let id=hashlib.md5(args)
    data[id]={}
    let tx
    data[id].place  = args.place||"软件园二期观日路18-502"
    data[id].area   = args.area ||"200m2"
    data[id].price  = args.price || 200
    if (!this.get(id))
      this.set(data)
        .then((tx)=>console.log(tx))
        .catch((error)=>{
           callback(error.stack)
        })
  }
  getRoom(id=null){
    if (id)
      return this.get(id)
    else 
      return this.get()
  }
}

//registerRoom调用
version("^0.1.5")
cta=getInstance("f17940687b5a737edbcfff25b0a551e33e681a6162e49569ed13c50f8d099a1b")
sr = new ShareRoom(cta)
sr.registerRoom()
  .then((tx)=>console.log(tx))
  .catch((error)=>{throw error})

version("^0.1.5")
cta=getInstance("f17940687b5a737edbcfff25b0a551e33e681a6162e49569ed13c50f8d099a1b")
sr = new ShareRoom(cta)
sr.registerRoom({place:"图书馆",area:"800平方米",price:1000})
  .then((tx)=>console.log(tx))
  .catch((error)=>{throw error})

//getRoom调用
version("^0.1.5")
cta=getInstance("f17940687b5a737edbcfff25b0a551e33e681a6162e49569ed13c50f8d099a1b")
sr = new ShareRoom(cta)
sr.getRoom()

//定义storage
version("^0.1.5")
class Storage extends Contract{
  async setData(data={}){
    if (!this.isDeployed) throw new Error("合约尚未部署")
    this.set(data)
      .then((tx)=>console.log(tx))
      .catch((error)=>{
         callback(error.stack)
      })
  }
  getData(id=null){
    if (id)
      return this.get(id)
    else 
      return this.get()
  }
}
//set data
version("*")
cta=getInstance("e84a1f463a62415c432bb8d7e51c3083d2de1a2817ca05299f70a11f4d9d9732")
storage=new Storage(cta)
storage.setData({name:"游海涛",age:43})
storage.setData({address:["瑞景新村"],tel:{work:"2517003",private:"13906056442"}})
storage.setData({age:40,tel:{work:"0592-2517003",public:"012345678"}})
storage.setData({address:["大洲国际龙郡"]})
//get conbin data
version("*")
cta=getInstance("e84a1f463a62415c432bb8d7e51c3083d2de1a2817ca05299f70a11f4d9d9732")
storage=new Storage(cta)
storage.get()