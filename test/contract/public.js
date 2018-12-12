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
