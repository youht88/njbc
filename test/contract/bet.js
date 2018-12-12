const contract = new Contract()
class Bet{
  constructor(amount,date,code,value){
    this.amount = amount
    this.date = date
    this.code = code
    this.value = value
  }
  get(key,toAddr,list){
    return contract.get(key,toAddr,list)
  }
  getBalance(){
    return contract.getBalance()
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
        let value = parseFloat(x[0][2])
        return (value>=this.value)
      }catch(error){
        throw error
      }
    })
  }
  declare(address,viewpoint){
    return contract.set({list:[{address,viewpoint}]},address,this.amount)
  }
  resolve(){
    try{
      let winner=[]
      let failer=[]
      let average = 0
      return this.verify().then(verify=>{
        if (verify){
          return contract.get("list").then(list=>{
            list.data.map(item=>{
              if (item.viewpoint){
                winner.push(item.address)
              }else{
                failer.push(item.address)
              }
            })
            if (winner.length>0){
              average = this.amount * failer.length / winner.length
              winner.map(item=>contract.payTo(item,average+this.amount))
            }
            return `winner is ${winner}`
          })
        }else{
          return contract.get("list").then(list=>{
            list.data.map(item=>{
              if (!item.viewpoint){
                winner.push(item.address)
              }else{
                failer.push(item.address)
              }
            })
            if (winner.length>0){
              average = this.amount * failer.length / winner.length
              winner.map(item=>contract.payTo(item,average+this.amount))
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
const bet = new Bet(100,'20181129','600825',6.36)
return bet


//////////////
cta = getInstance('7a206736b13c15c13e755eef35eb80e355035c6a')

return cta.declare("184LtwAcoGs4NvmQUaJX7wJQQJZCE4abjb",false).then(tx1=>{
  return cta.declare("14VkpKLUgXQEGLvWVEsNVyyeeiW6mF4Gzy",true).then(tx2=>{
    return cta.declare("19bTkZweUy2akATXC3cR5H9h9wnYU3wUoj",false).then(tx3=>{
      return [tx1,tx2,tx3]
    })
  })
})

cta.get()
//The result is {"data":{"list":[{"184LtwAcoGs4NvmQUaJX7wJQQJZCE4abjb":true},{"14VkpKLUgXQEGLvWVEsNVyyeeiW6mF4Gzy":false}]},"_timestamp":1543395934616}


return cta.resolve()

