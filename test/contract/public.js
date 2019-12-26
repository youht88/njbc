assets:
{"title":"通用合约1.1.5"}
//通用合约封装
version("1.1.5")
contract = new Contract()
class Cta{
  constructor(appName){
    this.appName = appName
    this.args = null
  }
  init(args){
    if (this.args) throw new Error("合约已经被初始化!")
    this.args = args
  }
  onlyInit(){
    if (!this.args) throw new Error("合约还没有被初始化!")
  }
  onlyOwner(caller){
    if (caller != contract.owner) throw new Error(`[${caller}]必须是创建者[${contract.owner}]才能调用该函数!`)
  }
  sayHello(msg){
     this.onlyInit()
     return `hello ${msg},this is app {${this.appName}}!!!!!`
  }
  showContract(){
    return contract
  }
  async set (data,caller,amount,crypt=false){
     this.onlyInit()
     if (!caller) throw new Error("caller不能为空!")
     if (Array.isArray(this.args.allowAddress)){
        if (!this.args.allowAddress.includes(caller)){
          throw new Error(`[${caller}]不在许可地址列表[${this.args.allowAddress}]中`)
        }
     }
     return contract.set(data,caller,amount,crypt)
  }
  async get(key=null,inAddr=null,list=false){
     this.onlyInit()
     return contract.get(key,inAddr,list)
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
instance = new Cta("test1")
return instance

1、
cta=getInstance('ceb599e2898cc52cf7dfff1a1cb80de98a82c20dd8a0696a0908111c31ec708b')
cta.set({"youht":{name:"youht",age:40,friend:["huangwc","wuyy"]}},"youht",1)
cta.set({"youht":{salary:200,friend:["jinli"]}},"youht",1,true)

2、
return cta.getStock('300096','20181123').then(x=>parseFloat(x[0][2]))

3、
cta=getInstance('e05bfab17ec9f72a2cbfdb99f6989f41dfea011a592a6a34199a813fd01a7be3')
return cta.getStock('300096','20181023','20181123').then(x=>{
  return x.map(y=>y[2])
})

prvkey: 01110100
'3074020101042018e30f143be7ed9c0838444d27d8b7f9d5111521d2c8f88c369e07d1f1dfd357a00706052b8104000aa144034200041273a9411db588c8a5126de6333d95e4a04f32a4bab0e01d48931d4c505d1b71d4f453ae435747ebbbceef2582fd31923e8ab8510d149bbbca6835dc68656db1'
pubkey:
'3056301006072a8648ce3d020106052b8104000a034200041273a9411db588c8a5126de6333d95e4a04f32a4bab0e01d48931d4c505d1b71d4f453ae435747ebbbceef2582fd31923e8ab8510d149bbbca6835dc68656db1'

a:
'49757fb9a884601f9b1e8fc48e0694bf896c6c8d9dc3d8de4a5055c2c20b220d'
b:
'04ae074c361df416dea6ae7fa44c4177034520100e7561d2d5e5664ab435c4f83a350ebf3147fc3c9cd7be84ef8b7be1f5b178ac9ea21990c8f45f9ee930598be8'