assets:
{"allowAddress":[
  "12VcnWGhwApzddbkSpWFp8qSyrQm1hDHff",
  "16RHoZMufkDEj9D5yGnVoK6kb5noUHGa9S"
]}

version("0.1.3")
contract = new Contract()
class Cta{
  constructor(){
      this.deadline=null
  }
  init(deadline){
     if (this.deadline) throw new Error("has been inited.")
     this.deadline = deadline
  }
  async set (data,caller,amount,crypt=false){
     if (!this.deadline) throw new Error("not been inited.")
     if (this.deadline < nowE8(new Date(),'YYYYMMDD')) throw new Error("合约已过期")
     return contract.set(data,caller,amount,crypt)
  }
  async get(key=null,inAddr=null,list=false){
     return contract.get(key,inAddr,list)
  }
  onlyOwner(){
    return contract.onlyOwner()
  }
}
instance = new Cta()
return instance