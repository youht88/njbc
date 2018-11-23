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
console.log("miner.js3",typeof Wallet,typeof Transaction)

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
  .option('--entryKad <s>','entry node of kad,ip:port')
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
  "entryKad"   : program.entryKad,
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
  
  if (args.entryKad)
    config.entryKad=args.entryKad
  args.entryKad = config.entryKad
  
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
  if (!(args.me && args.entryNode && args.entryKad && 
        args.db && args.httpServer ))
    throw Error("you must define me,entryNode,entryKad,db,httpServer arguments")               
  
  fs.writeFileSync("config.json",JSON.stringify(config,null,space=4))
  return config
}
//syncConfigFile
const config = syncConfigFile(args)    

//set global 
global.REWARD = 2.0
global.BLOCK_PER_HOUR = 3*60  //每小时出块数限制
global.ADJUST_DIFF=100   //每多少块调整一次难度
global.ZERO_DIFF = 3
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
    "entryKad":args.entryKad,
    "me":args.me,
    "db":args.db,
    "display":args.display,
    "ioServer":ioServer,
    "ioClient":ioClient
  })
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
app.get('/crypto',function(req,res){
  //hashlib
  const hashlib = utils.hashlib
  console.log(hashlib.hash256({"b":2.00,"a":1.0}))
  console.log(hashlib.md5({"b":2.00,"a":1.0}))
  
  //crypto
  const rsa = utils.rsa
  const key = rsa.generateKeys()
  encrypted = rsa.encrypt("abcd",key.pubkey)
  console.log("encrypted",encrypted)
  decrypted = rsa.decrypt(encrypted,key.prvkey)
  console.log("decrypted",decrypted)
  
  sign = rsa.sign({"a":1,"b":2},key.prvkey)
  console.log("sign",sign)
  verify = rsa.verify({"a":1,"b":2.0},sign,key.pubkey)
  console.log("verify",verify)
  res.send('ok')
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
  const address = req.params.address
  let  wallet = await new Wallet(address).catch(e=>res.end(e.stack))
  const balance = node.blockchain.utxo.getBalance(wallet.address)
  const json = {"address":wallet.address,"pubkey":wallet.pubkey,"blance":balance}
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
  wallet = await new Wallet(name)
  res.send(wallet.address)
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
          "pubkey":wallet.pubkey,
          "balance":balance}
  res.send(`</pre>${JSON.stringify(response,null,4)}</pre>`)
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
  node.tradeTest(nameFrom,nameTo,amount,script,assets)
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
  node.tradeTest(nameFrom,nameTo,amount)
    .then(data=>{
        res.send(`<pre>${JSON.stringify(data,null,4)}</pre>`)
      })
    .catch(error=>{
      console.log(error.stack)
      res.end(error.message)
      })
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
  const t1=Transaction.newCoinbase(node.wallet.key.pubkey,node.wallet.address)
  const coinbase=JSON.parse(JSON.stringify(t1))
  //mine
  node.mine(coinbase,(err,newBlock)=>{
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
  let contract
  try{
    contract = new Contract({inAddr,script})
  }catch(error){
    res.json({"errCode":1,"errText":error.stack,"result":false})
    return
  }
  /*
  try{
    let p = await contract.run()
    if (p && typeof p.then == "function"){
      await p.then((result)=>res.json({"errCode":0,"errText":'',"result":result}))
       .catch((error)=>res.json({"errCdde":1,"errText":error.stack,"result":false}))
    }else{
      res.json({"errCode":0,"errText":'',"result":p})
    }
    return
  }catch(error){
    res.json({"errCode":2,"errText":error.stack,"result":false})
    return
  }
  */
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