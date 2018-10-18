const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()

class Contract{
  constructor(script,sandbox={}){
    this.status=0
    this.compileError=None
    this.executeError=None
    this.script=script
    this.setSandbox()
  }
  check(){
    //return {"errCode":0,"result":true}
    return true
  /*
    try:
      bin=compile(self.script,'','exec')
    except Exception as e:
      return {"errCode":2,"errText":repr(e)}
    try:
      exec(bin,{},self.sandbox)
      result=self.sandbox["main"](self.sandbox)
    except Exception as e:
      return {"errCode":3,"errText":repr(e)}
    return {"errCode":0,"result":"True" if result else "False"}
  */
  }
  setSandbox(){
    let sandbox={}
    sandbox["blockchain"]=global.blockchain
    sandbox["node"] = global.getnode
    sandbox["dt"]=this.dt()
    sandbox["http"]=this.http
    this.sandbox=sandbox
  }
  dt(){
    //tz=pytz.timezone('Asia/Shanghai')
    //dt=datetime.datetime.now(tz).strftime('%Y%m%d%H%M%S')
    return null
  }
  http(url,params={},timeout=3){
    //res = requests.get(url,params=params,timeout=timeout)
    return null
  }
}    

exports.Contract = Contract
