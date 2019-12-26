// STEP1 创建一个通用的赌约模版，可以认为是一个赌约DAPP
//assets-> {"title":"通用赌约"}
version("1.0.0")
class Bet{
  constructor(){
    this.amount = null
    this.date = null
    this.code = null
    this.value = null
    this.contract = null
  }
  setBet(contract,amount,date,code,value){
    this.contract = contract
    this.amount = amount
    this.date = date
    this.code = code
    this.value = value 
  }
  get(key,toAddr,list){
    return this.contract.get(key,toAddr,list)
  }
  getBalance(){
    return this.contract.getBalance()
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
  getBet(){
    return `我押${this.amount}个币，打赌${this.date}股票代码${this.code}收盘价超过${this.value}元(含等于）！`
  }
  getAmount(){
    return this.amount
  }
  verify(){
    return this.getStock(this.code,this.date).then(x=>{
      try{
        if (!x[0]) throw new Error("股票代码错误，或者合约尚未到期")
        let value = parseFloat(x[0][2])
        return (value>=this.value)
      }catch(error){
        throw error
      }
    })
  }
  declare(address,viewpoint){
    return this.contract.set({list:[{address,viewpoint}]},address,this.amount)
  }
  resolve(){
    try{
      let winner=[]
      let failer=[]
      let average = 0
      return this.verify().then(verify=>{
        if (verify){
          return this.contract.get("list").then(list=>{
            list.data.map(item=>{
              if (item.viewpoint){
                winner.push(item.address)
              }else{
                failer.push(item.address)
              }
            })
            if (winner.length>0){
              average = this.amount * failer.length / winner.length
              winner.map(item=>this.contract.payTo(item,average+this.amount))
            }
            return `winner is ${winner}`
          })
        }else{
          return this.contract.get("list").then(list=>{
            list.data.map(item=>{
              if (!item.viewpoint){
                winner.push(item.address)
              }else{
                failer.push(item.address)
              }
            })
            if (winner.length>0){
              average = this.amount * failer.length / winner.length
              winner.map(item=>this.contract.payTo(item,average+this.amount))
            }
            return `winner is ${winner}`
          })        
        }
      })
    }catch(error){
      return error.msg
    }
  }
}
const bet = new Bet()
return bet

//STEP2 创建一个具体的赌约，这是一个真正的合约
//assets -> {"title":"具体的一个赌约"}
version("1.0.0")
cta = new Contract()
bet = getInstance('0d2e03c05ab68054aaeff4f1a5efcf52a827cd46')
bet.setBet(cta,1.18,"20191115","300096",10.55)
return bet

version("1.0.0")
cta = new Contract()
bet = getInstance('0d2e03c05ab68054aaeff4f1a5efcf52a827cd46')
bet.setBet(cta,1.19,"20191115","300096",10.55)
return bet

//STEP3 应用这个具体赌约，实际上调用这个具体的合约的各项功能
//调用赌约
1、查看赌约
cta = getInstance('57a7ab7b26d60c4795585061ab2b7171affaa66b')
return cta.getBet()

2、批量下注
cta = getInstance('57a7ab7b26d60c4795585061ab2b7171affaa66b')
return cta.declare("184LtwAcoGs4NvmQUaJX7wJQQJZCE4abjb",false).then(tx1=>{
  return cta.declare("14VkpKLUgXQEGLvWVEsNVyyeeiW6mF4Gzy",true).then(tx2=>{
    return cta.declare("19bTkZweUy2akATXC3cR5H9h9wnYU3wUoj",false).then(tx3=>{
      return [tx1,tx2,tx3]
    })
  })
})

cta=getInstance('9e22e2475489f7f6d9f02580a24489f6e88e9756')
return cta.declare('149obCeuqpq3GiNpZyKwRH32mCGKH8B4Tr',true)

cta=getInstance('64d2636d807c6f29eba15c495540242e17653d82')
return cta.declare('149obCeuqpq3GiNpZyKwRH32mCGKH8B4Tr',false)

3、查看赌约情况
cta = getInstance('57a7ab7b26d60c4795585061ab2b7171affaa66b')
return cta.get()
//The result is {"data":{"list":[{"184LtwAcoGs4NvmQUaJX7wJQQJZCE4abjb":true},{"14VkpKLUgXQEGLvWVEsNVyyeeiW6mF4Gzy":false}]},"_timestamp":1543395934616}

4、申请兑现赌约
cta = getInstance('57a7ab7b26d60c4795585061ab2b7171affaa66b')
return cta.resolve()

