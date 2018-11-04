vm=require("vm")
let script=[
  `
    console.log("first start")
    class A extends Contract{
      sayHello(name){
        return "You are wellcome " +name
      }
      f1(x){
        return "bad "+x
      }
      f3(){
        return "first:"+this.index
      }
    }
    aa=new A()
    
    function fun1(x){
      return "fun1("+x+") is called"
    }
    function fun2(x){
      return aa.f3()
    }
    "first end"
  `,
  `
    ct0=getInstance(0)
    console.log("second start",ct0.index)
    class A1 extends A{
      f1(x){
        return this.sayHello(x)
      }
    }
    function f4(){
      return i.index
    }
    bb=new A1(ct0)
    "second end"
  `,
  `
    ct1=getInstance(1)
    console.log("three start",ct1.index)
    fun2()
    a=new A1(ct1)
    a.f3()
    //a.f2("youht")
    //a.f1("ok")
    //fun1("abc")
    //fun2()
    //a.script
    //f4()
  `
] 

class Contract{
  constructor(index,sandbox={}){
    this.index = index
    this.script = script[index]
    this.sandbox = this.setSandbox(sandbox)
  }
  run(){
    console.log("run1",Object.keys(this.sandbox))
    let result=vm.runInContext(script[this.index],vm.createContext(this.sandbox))
    console.log("run2",result)
  }
  setSandbox(sandbox){
    let that = this
    sandbox.console = console
    sandbox.index = that.index
    sandbox.getInstance = (i)=>{
      vm.runInContext(script[i],vm.createContext(this.sandbox))
      return {index:i,script:script[i]}
    }
    sandbox.Contract = class _Contract{
      constructor(arg){
        this.index = (arg)?arg.index:that.index
        this.script = (arg)?arg.script:that.script
      }f1(x){
       return "_contract"
      }
      f2(x){
       return "Root "+x
      }
      f3(x){
       return this.index
      }
    }
    return sandbox  
  }
}

let contract=new Contract(2)
contract.run()