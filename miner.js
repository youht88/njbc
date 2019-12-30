const EventEmitter = require("events")
const util=require('util')
const express = require('express')
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const ioServer = require('socket.io')(http);
const ioClient = require('socket.io-client');
const _ = require("underscore")
const path = require('path')
const fs  = require('fs')
const async = require('async')
const utils = require('./utils.js')

const Node = require('./node.js').Node
const Wallet = require('./wallet.js').Wallet
const Contract = require('./contract.js').Contract
const Transaction = require('./transaction.js').Transaction

//define logger
const logger = utils.logger.getLogger()
logger.trace(__footprint,"trace color is blue")
logger.debug(__footprint,"debug color is cyan")
logger.info(__footprint,"info color is green")
logger.warn(__footprint,"warn color is yellow")
logger.error(__footprint,"error color is red")
logger.fatal(__footprint,"fatal color is magenta")

//!!!import code to find error stack when unhandled Promise rejection found
process.on("unhandledRejection",(error,p)=>{
  logger.fatal("unhandledRejection",error.stack,p)
})
process.on('uncaughtException', (err) => {
    console.error('Asynchronous error caught.', err);
})
//handle commander config & args
const program = require('commander')
program
  .version('0.1.0','-v ,--version')
  .usage('[options] <file ...>')
  .option('-e, --entryNode <s>','indicate which node to entry,e.g. ip|host:port ')
  .option('--me <s>','indicate who am I,e.g. ip|host:port')
  .option('--httpServer <s>','default httpServer is 0.0.0.0:4000')
  .option('--ipfsServer <s>','default ipfsServer is localhost:5001')
  .option('--db <s>','db connect,ip:port/db')
  .option('--display <s>','display  of node')
  .option('--syncNode','sync node')
  .option('--full','full sync')
  .option('--debug','if debug mode ')
  .option('--logging <s>','logging level',/^(trace|debug|info|warn|error|fatal)$/i)
  .parse(process.argv);

const args = {
  "entryNode"  : program.entryNode,
  "me"         : program.me,
  "httpServer" : program.httpServer,
  "ipfsServer" : program.ipfsServer,
  "db"         : program.db,
  "display"    : program.display,
  "syncNode"   : program.syncNode,
  "full"       : program.full,
  "debug"      : program.debug,
  "logging"    : program.logging,
}

function syncConfigFile(args){
  let config
  try{
    config = fs.readFileSync("config.json","utf8")
  }catch(e){
    fs.writeFileSync("config.json")
  }
  if (config){
    config=JSON.parse(config)
  }else{
    config = {}
  }
  if (args.me)
    config.me=args.me
  args.me = config.me
  
  if (args.entryNode)
    config.entryNode=args.entryNode
  args.entryNode = config.entryNode
  
  if (args.httpServer)
    config.httpServer=args.httpServer
  args.httpServer = config.httpServer
  
  if (args.ipfsServer)
    config.ipfsServer=args.ipfsServer
  args.ipfsServer = config.ipfsServer
  
  if (args.db)
    config.db=args.db
  args.db = config.db
  
  if (args.logging)
    config.logging=args.logging
  args.logging = config.logging
  
  if (args.alias)
    config.alias=args.alias
  args.alias = config.alias
  
  if (args.full)
    config.full=args.full
  args.full = config.full

  if (args.debug)
    config.debug=args.debug
  args.debug = config.debug
  
  if (args.syncNode)
    config.syncNode=args.syncNode
  args.syncNode = config.syncNode
    
  console.log(args)
  if (!(args.me && args.entryNode && 
        args.db && args.ipfsServer))
    throw Error("you must define me,entryNode,db,ipfsServer arguments")               
  
  fs.writeFileSync("config.json",JSON.stringify(config,null,space=4))
  return config
}
//syncConfigFile
const config = syncConfigFile(args)    

//set global 
global.REWARD = 2.0
global.BLOCK_PER_HOUR = 3*60  //每小时出块数限制
global.ADJUST_DIFF=100   //每多少块调整一次难度
global.ZERO_DIFF = 1*4
global.NUM_FORK = 6
global.TRANSACTION_TO_BLOCK = 0
global.SYNC_BLOCKCHAIN = 10*1000*60  //多少毫秒同步blockchain
global.CHECK_NODE =  1000*60 //多少毫秒检查节点连接情况
global.contractTimeout = 5000
global.emitter = new EventEmitter()

let node
const start= async ()=>{
  //make node 
  node = new Node({
    "config":config,
    "httpServer":args.httpServer,
    "entryNode":args.entryNode,
    "ipfsServer":args.ipfsServer,
    "me":args.me,
    "db":args.db,
    "display":args.display,
    "ioServer":ioServer,
    "ioClient":ioClient
  })
  //连接ipfs
  await node.ipfsConnect()
  console.log(node.ipfs)
  node.initIpfs()

  node.initEvents()

  //链接数据库
  logger.debug("dbConnect...")
  await node.dbConnect()
  //创建钱包  
  const mywallet = new Wallet()
  await mywallet.chooseByName(args.me)
    .catch(async e=>{
      logger.error(`尚没有钱包，准备创建${args.me}的密钥钱包`)
      mywallet.create(args.me)
        .then(()=>logger.info("钱包创建成功"))
        .catch(e=>console.log("error2",e))
    })
  node.wallet = mywallet
  logger.debug("mywallet.address",mywallet.address)
  //导入本地区块链
  await node.syncLocalChain()
  logger.debug(`localchain has ${node.blockchain.maxindex()} blocks`)
  //链接网络
  logger.debug("socketioConnect...")
  await node.socketioConnect()
  if (args.entryNode==args.me)
    node.emitter.emit("start")
}
start()
  .then(()=>console.log("node started."))
  .catch(e=>console.log(e))

//允许跨域
var allowCrossDomain = function (req, res, next) {
 res.header('Access-Control-Allow-Origin', '*');//自定义中间件，设置跨域需要的响应头。
 next();
};
app.use(allowCrossDomain);//运用跨域的中间件

//express router
app.use(express.static(path.join(__dirname,"/static/dist")))
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());


app.get('/debug',function(req,res){
  config.debug=true
  res.end('set debug mode ')
})
app.get('/nodebug',function(req,res){
  config.debug=false
  res.end('set no debug mode')
})
app.get('/', function(req, res){
  console.log("hello")
  res.send("hello")
});

app.get('/react',function(req,res){
  res.sendFile(path.join(__dirname, 'static/dist/index.html'));
})

app.get('/bootstrap',function(req,res,next){
  console.log("blotstrap")
  res.sendFile(path.join(__dirname, 'templates/bootstrap.html'));
  next()
})
app.get('/bootstrap/test',function(req,res){
  let json = {"a":1,"b":2,"c":{c1:"x",c2:"y"}}
  res.send(`<pre>${JSON.stringify(json,null,4)}</pre>`)
})

app.get('/crypto/newAddress',function(req,res){
  //crypto
  const ecc = utils.ecc
  const key = ecc.generateKeys()
  const address = Wallet.address(key.pubkey)
  const keystore = {address:address,pubkey:key.pubkey,prvkey:key.prvkey}
  res.json(keystore)
})
app.post('/crypto/sign',function(req,res){
  //crypto
  const ecc = utils.ecc
  const prvkey = req.body.prvkey
  const data = req.body.data
  let sign = ecc.sign(data,prvkey)
  let reg1=new RegExp("\\+","g")
  let reg2=new RegExp("/","g")
  sign = sign.replace(reg1,"*")
  sign = sign.replace(reg2,"-")
  logger.warn(sign)
  res.end(sign,'utf8')
})
app.post('/crypto/verify',function(req,res){
  //crypto
  const ecc = utils.ecc
  const pubkey = req.body.pubkey
  const data = req.body.data
  const sign = req.body.sign
  const verify = ecc.verify(data,sign,pubkey)
  logger.warn(verify)
  res.end(verify)
})

app.get('/socket/getClientInfo',function(req,res){
  //console.log(node.ioServer.sockets.connected)
  //for (let i in node.ioServer.sockets.connected){
  //  console.log("clientId:",i,"rooms:",node.ioServer.sockets.connected[i].rooms)
  //}
  node.ioServer.clients((error,clients)=>{
    if (error) throw error
    console.log(clients)
  })
  res.send('ok')
})

app.get('/socket/disconnect',function(req,res){
  console.log(node.ioServer)
  for (let i=0;i< node.ioServer.sockets.connected.length;i++){
    node.ioServer.sockets.disconnect()
  }
  res.send('ok')
})

app.get('/socket/broadcast/:data',function(req,res){
  if (node.socketioClient){
    node.socketioClient.emit("broadcast",req.params.data)
  }
  node.ioServer.sockets.emit("broadcast",req.params.data)
  res.send('ok')
})
app.get('/socket/broadcastUp/:data',function(req,res){
  if (node.socketioClient){
    node.socketioClient.emit("broadcastUp",req.params.data)
  }
  res.send('ok')
})
app.get('/socket/broadcastDown/:data',function(req,res){
  node.ioServer.sockets.emit("broadcastDown",req.params.data)
  res.send('ok')
})

app.get('/socket/join/:room',function(req,res){
  if (node.socketioClient){
    node.socketioClient.emit(req.params.room,{})
  }
  res.send('ok')
})

app.get('/socket/emit/:room/:event/:data',function(req,res){
  let room = req.params.room
  let event = req.params.event
  let data = req.params.data
  console.log('/socket/emit/:room/:event/:data',room,event,data)
  node.ioServer.to(room).emit(event,data)
  res.send('ok')
})

app.get('/socket/emit/:event/:data',function(req,res){
  console.log('/socket/emit/:event/:data')
  if (node.socketioClient)
    node.socketioClient.emit(req.params.event,req.params.data)
  res.send('ok')
})
app.get('/socket/emitSync/:event/:data',function(req,res){
  console.log('/socket/emitSync/:event/:data')
  if (node.socketioClient)
    node.socketioClient.emit(req.params.event,req.params.data,(data)=>{
      console.log("getServerResponseByAck",data)
      res.send(data)
    })
  //res.send('ok')
})

////////////////node interface ////////////
app.get('/node/info',function(req,res){
  const info = node.getNodeInfo()
  if (config.debug)
    res.send(`<pre>${JSON.stringify(info,null,4)}</pre>`)
  else 
    res.send(info)
})

//////////////////blockchain interface ///////////////
app.use('/blockchain',function(req,res,next){
  console.log("blockchain interface")
  next()
})

app.get('/blockchain/maxindex', function(req,res){
  const maxindex = node.blockchain.maxindex()
  res.send(maxindex.toString())
})

app.get('/blockchain/lastblock', function(req,res){
  const block = node.blockchain.lastblock()
  if (config.debug)
    res.send(`<pre>${JSON.stringify(block,null,4)}</pre>`)
  else 
    res.send(block)
})

app.get('/blockchain',function(req,res){
  const blocks = node.blockchain.blocks
  if (config.debug)
    res.send(`<pre>${JSON.stringify(blocks,null,4)}</pre>`)
  else 
    res.send(blocks)
})

app.get('/blockchain/spv', function(req,res){
  const blockSPV = node.blockchain.getSPV()
  if (config.debug)
    res.send(`<pre>${JSON.stringify(blockSPV,null,4)}</pre>`)
  else
    res.send(blockSPV)
})

app.get('/blockchain/index/:blockIndex/',function(req,res,next){
  const blockIndex = parseInt(req.params.blockIndex)
  const block = node.blockchain.findBlockByIndex(blockIndex)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(block,null,4)}</pre>`)
  else
    res.send(block)
})

app.get('/blockchain/hash/:blockHash/',function(req,res,next){
  const block = node.blockchain.findBlockByHash(req.params.blockHash)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(block,null,4)}</pre>`)
  else
    res.send(block)
})

app.get('/blockchain/:fromIndex/:toIndex',function(req,res,next){
  const fromIndex = parseInt(req.params.fromIndex)
  const toIndex   = parseInt(req.params.toIndex)
  const blocks = node.blockchain.getRangeBlocks(fromIndex,toIndex)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(blocks,null,4)}</pre>`)
  else
    res.send(blocks)
})
///////////////utxo interface/////////////////
app.get('/utxo/main/:address/',function(req,res){
  const utxo = node.blockchain.utxo.findUTXO(req.params.address)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(utxo,null,4)}</pre>`)
  else
    res.send(utxo)
})
app.get('/utxo/trade/:address/',function(req,res){
  const utxo = node.tradeUTXO.findUTXO(req.params.address)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(utxo,null,4)}</pre>`)
  else
    res.send(utxo)
})
app.get('/utxo/isolate/:address/',function(req,res){
  const utxo = node.isolateUTXO.findUTXO(req.params.address)
  if (config.debug)
    res.send(`<pre>${JSON.stringify(utxo,null,4)}</pre>`)
  else
    res.send(utxo)
})
app.get('/utxo/reset/',function(req,res){
  const utxoSet = node.resetUTXO()
  return res.send(`<pre>${JSON.stringify(utxoSet,null,4)}</pre>`)
})
app.get('/utxo/get/main',function(req,res){
  const utxoSet = node.blockchain.utxo.utxoSet
  const utxoSummary = node.blockchain.utxo.getSummary()
  const json = {"summary":utxoSummary,"utxoSet":utxoSet}
  if (config.debug)
    res.send(`<pre>${JSON.stringify(json,null,4)}</pre>`)
  else
    res.send(json)
})
app.get('/utxo/get/isolate',function(req,res){
  const utxoSet = node.isolateUTXO.utxoSet
  const utxoSummary = node.isolateUTXO.getSummary()
  const json = {"summary":utxoSummary,"utxoSet":utxoSet}
  if (config.debug)
    res.send(`<pre>${JSON.stringify(json,null,4)}</pre>`)
  else
    res.send(json)
})
app.get('/utxo/get/trade',function(req,res){
  const utxoSet = node.tradeUTXO.utxoSet
  const utxoSummary = node.tradeUTXO.getSummary()
  const json = {"summary":utxoSummary,"utxoSet":utxoSet}
  if (config.debug)
    res.send(`<pre>${JSON.stringify(json,null,4)}</pre>`)
  else
    res.send(json)
})

//////////wallet interface ////////////////
app.get('/wallet/all',async function(req,res){
  const accounts = await Wallet.getAll()
  if (config.debug)
    res.send(`</pre>${JSON.stringify(accounts,null,4)}</pre>`)
  else
    res.send(accounts)
})

app.get('/wallet/me',function(req,res){
  const balance = node.blockchain.utxo.getBalance(node.wallet.address)
  const json = {"address":node.wallet.address,
              "pubkey":node.wallet.pubkey,
              "balance":balance}
  if (config.debug)
    res.send(`</pre>${JSON.stringify(json,null,4)}</pre>`)
  else
    res.send(json)
})

app.get('/wallet/:address',async (req,res)=>{
  let address = req.params.address
  if (!Wallet.isAddress(address)){
    let  wallet = await new Wallet(address).catch(e=>res.end(e.stack))
    address = wallet.address
  }
  const balance = node.blockchain.utxo.getBalance(address)
  const json = {"address":address,"balance":balance}
  if (config.debug)
    res.send(`</pre>${JSON.stringify(json,null,4)}</pre>`)
  else
    res.send(json)
})

app.get('/wallet/getAddress/:name',async function(req,res){
  let name = req.params.name
  if (name =='me'){
    name=node.me
  }
  try{
    wallet = await new Wallet(name)
    res.send(wallet.address)
  }catch(e){
    res.send(name)
  }
})

app.get('/wallet/create/:name',async (req,res,next)=>{
  const name = req.params.name
  let wallet
  if (name=='me'){
    wallet = await new Wallet(node.me)
  }else{
    wallet = new Wallet()
    await wallet.create(name)
  }
  let balance = node.blockchain.utxo.getBalance(wallet.address)
  let response= {"name":name,
          "address":wallet.address,
          "pubkey":wallet.key.pubkey[0],
          "prvkey":wallet.key.prvkey[0]
         }
  logger.warn("wallet/create",response)
  if (config.debug)
    res.send(`</pre>${JSON.stringify(response,null,4)}</pre>`)
  else
    res.json(response)
})

app.post('/wallet/create/:name/:num',async (req,res,next)=>{
  const sentence = req.body.sentence
  const name = req.params.name
  const num  = parseInt(req.params.num)
  if (!num) num=1
  const keys = utils.ecc.genKeys(sentence,num)
  let wallet = new Wallet()
  let response = []
  let i=0
  for (let key of keys){
    let n=name+i.toString()
    i++
    wallet = await wallet.create(n,key.prvkey,key.pubkey)
    response.push({
        address:wallet.address,
        prvkey:wallet.key.prvkey[0],
        pubkey:wallet.key.pubkey[0]})
  }
  res.json(response)
})
////////////// trade interface /////////////
app.post('/trade',function(req,res,next){
  const script = req.body.script
  let assets = req.body.assets
  if (assets){
    try{
      assets = JSON.parse(assets)
    }catch(e){
      res.json({"errCode":3,"errText":"数据格式必须是数字或合法的JSON对象","result":null})  
      return 
    }
  }
  const nameFrom = req.body.inAddr
  const nameTo   = req.body.outAddr
  const amount   = parseFloat(req.body.amount)
  const lockTime = parseInt(req.body.lockTime)

  node.tradeTest({nameFrom,nameTo,amount,script,assets,lockTime})
    .then(data=>{
        //res.send(`<pre>${JSON.stringify(data,null,4)}</pre>`)
        res.json({errCode:0,errText:'',result:data})
      })
    .catch(error=>{
       res.json({errCode:4,errText:error.stack,result:null})
      })
})

app.get('/trade/:nameFrom/:nameTo/:amount',function(req,res,next){
  const nameFrom = req.params.nameFrom
  const nameTo   = req.params.nameTo
  const amount   = parseFloat(req.params.amount)
  const lockTime = 0
  node.tradeTest({nameFrom,nameTo,amount,lockTime})
    .then(data=>{
        res.send(`<pre>${JSON.stringify(data,null,4)}</pre>`)
      })
    .catch(error=>{
      console.log(error.stack)
      res.end(error.stack)
      })
})

app.post('/trade/preNewTransaction',function(req,res,next){
  const inAddr = req.body.inAddr
  let outAddr = req.body.outAddr
  outAddr = outAddr.split(',')
  let amount   = req.body.amount
  amount = amount.split(',').map(x=>parseFloat(x))
  if (amount.length==1) amount=amount[0]
  const script   = req.body.script
  let   assets   = req.body.assets
  const lockTime = parseInt(req.body.lockTime)
  const signNum = 1
  const utxo  = node.tradeUTXO
  let result
  try{
    if (typeof assets == "string"){
      assets = JSON.parse(utils.bufferlib.b64decode(assets))
    }
    console.log("preNewTransaction",assets)
    result = Transaction.preNewTransaction({inAddr,outAddr,amount,utxo,script,assets,signNum,lockTime})
    res.json({errCode:0,errText:'',result:result})
  }catch(error){
    res.json({errCode:4,errText:error.stack,result:null})   
  }
})

app.post('/trade/newRawTransaction',async function(req,res,next){
  try{
    let raw = req.body.raw
    //if is base64
    if (typeof raw == "string"){
      raw=JSON.parse(utils.bufferlib.b64decode(raw))
    }
    //当数组个数为1的时候苹果捷径系统自动设置非数组形式，所以在这里判断将rawIns变为数组
    //sign签名应为捷径的原因，做响应的转换(*,+)(-,/)
    if (!Array.isArray(raw.rawIns))  
      raw.rawIns = [raw.rawIns]
      let reg1=new RegExp("\\*","g")
      let reg2=new RegExp("-","g")
      for (let rawIn of raw.rawIns){
        rawIn.sign = rawIn.sign.replace(reg1,"+")
        rawIn.sign = rawIn.sign.replace(reg2,"/")
      }
    if (!Array.isArray(raw.rawOuts))  
      raw.rawOuts = [raw.rawOuts]
    
    const utxo  = node.tradeUTXO
    let result
    
    let newTX = await Transaction.newRawTransaction(raw,utxo)
    if (!newTX) return
    let newTXdict=utils.obj2json(newTX)
    node.emitter.emit("transacted",newTXdict)
    // use socket to broadcast instead of http
    logger.info(`broadcast transaction ${newTX.hash}`)
    node.broadcast(newTXdict,"newTransaction")
    
    logger.info("transaction广播完成")
    res.json({errCode:0,errText:'',result:newTXdict})
  }catch(error){
    res.json({errCode:4,errText:error.stack,result:null})   
  }
})

////////// transaction interface/////////////////
app.get('/transaction/txpool',async function(req,res){
  const txs = await Transaction.getTxPool()
  global.db.findMany("transaction",{}).then((txs)=>{
    if (config.debug)
      res.send(`<pre>${JSON.stringify(txs,null,4)}</pre>`)
    else 
      res.json(txs)
  })
})

app.get('/transaction/:hash',function(req,res){
  const hash = req.params.hash
  const transaction = node.blockchain.findTransaction(hash)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(transaction,null,4)}</pre>`)
  else 
    res.send(transaction)
})

app.get('/transactionBlock/:hash',function(req,res){
  const hash = req.params.hash
  const transaction = node.blockchain.findTransactionBlock(hash)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(transaction,null,4)}</pre>`)
  else 
    res.send(transaction)
})

////////////  contract interface ///////////////
app.get('/contract/all',function(req,res){
  const contracts = node.blockchain.findContract()
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(contracts,null,4)}</pre>`)
  else 
    res.send(contracts)
})

app.get('/contract/:hash',function(req,res){
  const hash = req.params.hash
  const contract = node.blockchain.findContract(hash)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(contract,null,4)}</pre>`)
  else 
    res.send(contract)
})

app.get('/contract/title/:keyword',function(req,res){
  const keyword = req.params.keyword
  const contract = node.blockchain.findContractByKey(keyword)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(contract,null,4)}</pre>`)
  else 
    res.send(contract)
})

app.post('/contract/deploy',async function(req,res){
  const script = req.body.script
  const assets = req.body.assets
  logger.warn(assets)
  const owner  = req.body.owner
  const amount = req.body.amount
  const contract = new Contract({script,assets})
  let result = await contract.deploy({owner,amount})
  res.send(result)
})

/////////////// aggregate //////////////////////
app.get('/aggregate/account_pie',async function(req,res){
  let result 
  //await node.blockchain.utxo.save()
  result = await global.db.aggregate("utxo",[{$unwind:"$outs"},{$project:{"outAddr":"$outs.txout.outAddr","amount":"$outs.txout.amount"}},{$group:{"_id":"$outAddr","sum":{$sum:"$amount"}}},{$project:{"_id":0,name:{$substr:["$_id",0,6]},value:"$sum"}}])  
  console.log("account_pie",result)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(result,null,4)}</pre>`)
  else 
    res.send(result)
})
app.get('/aggregate/blocks_per_hour_bar',async function(req,res){
  let result 
  result = await global.db.aggregate("blockchain",[{$group:{_id:{$floor:{$divide:["$timestamp",3600*1000]}},value:{"$sum":1},value1:{"$sum":"$nonce"}}},{$sort:{_id:1}}])
  console.log("block_per_hour_bar",result)
  if (config.debug) 
    res.send(`<pre>${JSON.stringify(result,null,4)}</pre>`)
  else 
    res.send(result)
})
//////////others interface ////////////////
app.get('/getEntryNode/entryNodes',function(req,res){
  node.getEntryNodes().then(data=>{
    res.send(data)
  })
})

app.get('/mine',function(req,res){
  //mine
  node.mine((err,newBlock)=>{
    if(err) return res.send(err.message)
    if (config.debug)
      res.send(`<pre>${JSON.stringify(newBlock,null,4)}</pre>`)
    else 
      res.send(newBlock)      
  })
})

app.get('/socket/getARpcData/:event',function(req,res){
  console.log(req.params.event)
  let promiseArray = node.getARpcData(req.params.event,{})
  console.log(promiseArray)
  Promise.all(promiseArray)
    .then(result=>{
      console.log(result)
      res.end('ok')
    })
})

app.get('/syncOverallChain',function(req,res){
  node.syncOverallChain()
    .then(nodeInfo=>{
      logger.fatal("syncOverallChain:",nodeInfo)
      res.end("ok")
    })
    .catch(error=>{
      logger.fatal("syncOverallChain:",error)
      res.end("error")
    })
})

//script
app.post('/run/script',async function(req,res){
  const script = req.body.script || ""
  const inAddr = req.body.inAddr || ""
  console.log("???????????",script,inAddr)
  let contract
  try{
    contract = new Contract({inAddr,script})
  }catch(error){
    res.json({"errCode":1,"errText":error.stack,"result":false})
    return
  }
  try{
    let result = await contract.run()
    res.json({"errCode":0,"errText":'',"result":result})
  }catch(error){
    res.json({"errCode":2,"errText":error.stack,"result":false})
  }
  
})

app.get("/emitter/:event/:msg",function(req,res){
  global.emitter.emit(req.params.event,req.params.msg)
  res.end(`have send [${req.params.event}] with message [${req.params.msg}].`)
})


app.get("*",function(req,res){
  res.status(404)
  res.send("找不到网页")
})

app.set('port', process.env.PORT || 4000);

var server = http.listen(app.get('port'), function() {
  console.log('start at port:' + server.address().port);
});

