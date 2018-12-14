//通用合约封装
class Cta{
  constructor(){
      this.contract = new Contract()
  }
  sayHello(msg){
     return `hello ${msg}!!!!!`
  }
  async set (data,caller,amount,crypt=false){
     return this.contract.set(data,caller,amount,crypt)
  }
  async get(key=null,inAddr=null,list=false){
     return this.contract.get(key,inAddr,list)
  }
  async getBalance(address){
      return this.contract.getBalance(address)
  }
  async getBalancePaid(address){
     return this.contract.getBalancePaid(address)
  }
  async payTo(address,amount,assets){
    return this.contract.payTo(address,amount,assets)
  }
  async getAccount(address){
    return this.contract.getAccount(address)
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
instance = new Cta()
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