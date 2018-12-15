const EventEmitter = require("events")
const MongoClient = require('mongodb').MongoClient;
const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const Chain = require('./chain.js').Chain
const UTXO  = require('./chain.js').UTXO
const Block = require('./block.js').Block
const Transaction = require('./transaction.js').Transaction
const Wallet = require('./wallet.js').Wallet

const {fork,exec} = require('child_process')

//const util = require('util')
class Node{
  constructor(args){
    this.emitter    = new EventEmitter()
    this.config     = args.config
    this.httpServer = args.httpServer
    this.me         = args.me
    this.entryNode  = args.entryNode
    this.entryKad   = args.entryKad
    this.db         = args.db
    this.display    = args.display
    this.peers      = args.peers
    this.diffcult   = global.ZERO_DIFF
    this.diffcultIndex = 0
    this.nodes      = []
    this.entryNodes = []
    this.clientNodesId = []
    this.dbclient   = {}
    this.ioServer   = args.ioServer
    this.ioClient   = args.ioClient
    this.wallet     = null
    this.socketioClient = null
    this.blockSyncing = false
    this.mining       = false
    this.miningPid    = null
    this.isolateUTXO={}
    this.isolatePool=[]
    this.tradeUTXO = {}
    this.isolateBlockPool = []
    this.tradeUTXO = new UTXO("trade")
    this.isolateUTXO = new UTXO("isolate")
        
    //kadhost,kadport = self.entryKad.split(':')
    //self.dht = DHT("0.0.0.0",int(kadport),boot_host=kadhost,boot_port=int(kadport))
    //this.dbConnect = this.dbConnect.bind(this)
    try{
      let peers = fs.readFileSync('peers','utf8')
      if (peers){
        this.peers = peers.replace(/[\r\n]/g,"")
      }else{
        this.peers = this.me
      }
    }catch(error){
      this.peers=this.me
    }
    this.nodes=this.peers.split(',')
    
    this.checkNode = this.checkNode.bind(this)
    
    this.process=[this.blockProcess,this.minerProcess]
  }
  
  initEvents(){
    this.emitter.on("test",()=>console.log(1234))
    this.emitter.on("mined",(blockDict)=>{
      logger.debug("mined",`${blockDict.index}-${blockDict.nonce}`)
      this.mined(blockDict)
    })
    this.emitter.on("transacted",(TXdict)=>{
      logger.debug("transacted",TXdict.hash)
      this.transacted(TXdict)
    })
    this.emitter.on("newBlock",(data)=>{
      logger.debug("newBlock",`${data.value.index}-${data.value.nonce}`)
      this.mined(data.value)
    })

    this.emitter.on("registeNode",(data)=>{
      logger.debug("registeNode",`${data.value}`)
      this.registeNode(data.value)
    })

    this.emitter.on("newTransaction",(data)=>{
      logger.debug("newTransaction",data.value.hash)
      this.transacted(data.value)
    })

    global.emitter.on("deployContract",(data={})=>{
      logger.warn(data.owner)
      logger.warn(data.amount)
      logger.warn(data.assets)
      logger.warn(data.script)
      logger.warn(data.signNum)
      this.tradeTest({
             nameFrom:data.owner,
             nameTo  :"",
             amount  :data.amount,
             script  :data.script,
             assets  :data.assets,
             signNum :data.signNum,
             lockTime : data.lockTime})
        .then((tx)=>logger.warn("合约部署已提交",tx.hash))
        .catch((error)=>{throw error})
    })
    global.emitter.on("trade",(data={},cb)=>{
      this.tradeTest({
            nameFrom:data.from,
            nameTo  :data.to,
            amount  :data.amount,
            script  :"",
            assets  :data.assets,
            signNum :data.signNum,
            loctTime : data.lockTime})
        .then((tx)=>{
            logger.warn("新支付交易已提交",tx.hash)
            if (cb){
              cb(null,tx.hash)
            }
          })
        .catch((error)=>{
            if (cb){
              cb(error,null)
            }
            throw error
          })
    })
    global.emitter.on("setAssets",(data={},cb)=>{
      this.tradeTest({
            nameFrom:data.from,
            nameTo  :data.to,
            amount  :data.amount,
            script  :"",
            assets  :data.assets,
            signNum :data.signNum,
            loctTime : data.lockTime})
        .then((tx)=>{
            logger.warn("新资源交易已提交",tx.hash)
            if (cb){
              cb(null,tx.hash)
            }
          })
        .catch((error)=>{
            if (cb){
              cb(error,null)
            }
            throw error
          })
    })
    global.emitter.on("payTo",(data={},cb)=>{
      this.tradeTest({
           nameFrom:data.contractAddr,
           nameTo  :data.to,
           amount  :data.amount,
           script  :"",
           assets  :data.assets,
           signNum :data.signNum,
           lockTime : data.lockTime})
        .then((tx)=>{
          logger.warn("新支付交易已提交",tx.hash)
          if (cb) cb(null,tx.hash)
        })
        .catch((error)=>{
          if (cb)
            cb(error)
          else
            throw error
        })
    })
    
    this.emitter.once("start",async ()=>{
      //syncNode
      if (this.config.syncNode){
        logger.debug("syncNode...")
        this.syncNode()
      }
      //genesis block ,only first node first time to use 
      if (this.blockchain.blocks.length==0){
        //get zero block from entryNode
        const promiseArray = this.getERpcData("getBlocks",{start:0,end:0})
        const results = await Promise.all(promiseArray)
        let genesisBlock
        if (results.length){
          genesisBlock=new Block(results[0].data[0])
          if (genesisBlock.isValid()){
            genesisBlock.save()
          }else{
            throw Error("error on import genesisBlock")
          }
        }else{
          console.log("创建genesisBlock")
          const coinbase=Transaction.newCoinbase(this.wallet.address)
          genesisBlock = await this.genesisBlock(coinbase)
        }
        
        this.blockchain.addBlock(genesisBlock)
        this.diffcult = genesisBlock.diffcult
        this.diffcultIndex = 0
        global.diffcult = this.diffcult
        global.diffcultIndex = this.diffcultIndex
      }
      
      //const nodeInfo = await this.getARpcNodeInfo()
      //logger.fatal("RoundRpcinfo:",JSON.stringify(nodeInfo))
      
      
      //sync blockchain
      logger.warn("start1","this.syncOverallChain")
      //await
      await this.syncOverallChain(this.config.full).then(bestIndex=>{
        logger.fatal("bestIndex:",bestIndex,"blockchain:",this.blockchain.maxindex())
      }).catch(err=>{console.log(err.stack)})
      
      logger.warn("start2","resetUTXO")      
      
      
      //sync utxo
      this.resetUTXO()
      
      setInterval(()=>{
        logger.error("start syncOverallChain...")
        this.syncOverallChain(false)
          .then(bestIndex=>{
        logger.fatal("bestIndex:",bestIndex,"blockchain:",this.blockchain.maxindex())})
          .catch(err=>{console.log(err.stack)})
      },global.SYNC_BLOCKCHAIN)
      
      logger.warn("start3","blockProcess")         
      this.blockProcess()
      logger.warn("start4","minerProcess")
      this.minerProcess()
     })
  }
  
  adjustDiffcult(endIndex){
    if ( endIndex%global.ADJUST_DIFF != 0) return
    let startIndex=endIndex - global.ADJUST_DIFF + 1
    let sTime = this.blockchain.findBlockByIndex(startIndex).timestamp
    let eTime =   this.blockchain.findBlockByIndex(endIndex).timestamp
    let block_per_hour = Math.round(global.ADJUST_DIFF/((eTime - sTime)/3600000))
    let oldDiffcult = this.diffcult
    if (block_per_hour > global.BLOCK_PER_HOUR*1.1){//速度太快，增加难度
      this.diffcult++  
    }else if (block_per_hour < global.BLOCK_PER_HOUR*0.9){ //速度太慢，减少难度
      this.diffcult--
      if (this.diffcult<global.ZERO_DIFF) this.diffcult=ZERO_DIFF
    }
    this.diffcultIndex = endIndex+1
    global.diffcultIndex = this.diffcultIndex
    global.diffcult = this.diffcult
    let msg=`index:${startIndex}-${endIndex},每小时出块:${block_per_hour},难度值由${oldDiffcult}调整为${this.diffcult}`
    logger.warn(msg)
    fs.appendFileSync("msg.txt",msg+"\n")
  }
  
  async blockProcess(){
    try{
      let promiseArray
      let start,end
      let results
      let maxindex = this.blockchain.maxindex()
      let blocksDict = await global.db.findMany("blockpool",{"index":maxindex+1},{"projection":{_id:0}})
      if (blocksDict.length!=0){
        let done = await this.blockPoolSync(blocksDict)
          .catch((error)=>{logger.error(error.stack)})
        logger.warn("blockprocess",done)
        if (!done){
          start = (maxindex - global.NUM_FORK >1)?maxindex - global.NUM_FORK:1
          end = maxindex + 1
          promiseArray = this.getARpcData("getBlocks",{start,end})
          results = await Promise.all(promiseArray)
          logger.warn("blockprocess",start,end,results)
          if (results.length<=0) 
            return setTimeout(this.blockProcess.bind(this),100)
          for (let result of results){
            for (let blockDict of result.data){
              const block = new Block(blockDict)
              if (block.isValid())
                block.saveToPool()
            }
          }
        }
      }else{
        let endBlock = await global.db.findOne("blockpool",{"index":{"$gte":maxindex+1}},{"projection":{_id:0},"sort":["index","ascending"]})
        if (!endBlock) {
          return setTimeout(this.blockProcess.bind(this),100)
        }
        if (maxindex+1 > endBlock.index -1 ) {
          return setTimeout(this.blockProcess.bind(this),100)
        } 
        console.log("want block",maxindex+1,endBlock.index - 1)
        start = maxindex+1
        end   = endBlock.index - 1
        promiseArray = this.getARpcData("getBlocks",{start,end})
        results = await Promise.all(promiseArray)
        
        console.log("get block...",results)
        if (results.length<=0) 
          return setTimeout(this.blockProcess.bind(this),100)
        for (let result of results){
          for (let blockDict of result.data){
            const block = new Block(blockDict)
            if (block.isValid())
              block.saveToPool()
          }
        }
      }
      setTimeout(this.blockProcess.bind(this),100)
    }catch(error){
      logger.fatal("blockProcess",error.stack)
      setTimeout(this.blockProcess.bind(this),100)
    }
  }
  
  async minerProcess(){
    try{
      let timestamp = new Date().getTime()
      const txPoolCount = await global.db.count("transaction",{$or:[{lockTime:0},{lockTime:{$lte:timestamp}}]})
      if (txPoolCount < global.TRANSACTION_TO_BLOCK) {
        return
      }
      //mine
      await this.mine()
        .then((data)=>{
            if (typeof data == "string"){
              logger.warn("minerProcess:",data)
            }else {
              logger.warn("minerProcess:",`${data.index}-${data.nonce}`) 
            }
          })
        .catch((error)=>{logger.error(error.stack)})
      return setTimeout(this.minerProcess.bind(this),0)
    }catch(error){
      logger.fatal("minerProcess",error.stack)
      setTimeout(this.minerProcess,bind(this),0)
    }
  }

  async dbConnect(){
    await utils.db.init(this.db)
    global.db = utils.db
    this.clearTransaction()
  }
  
  isValid(token){
    //return true
    return (token=="youht")
  }

  async socketioConnect(){
    //socketioClient
    if (this.entryNode && this.entryNode != this.me)
     await this.defineInterface(this.entryNode)
    //socketioServer
    await this.makeServer()
    //checkNode
    if (this.entryNode != this.me)
      this.checkNode()
  }
  async makeServer(){
    this.ioServer.use((socket,next) =>{
      let token = socket.handshake.query.token
      console.log(`认证客户端${socket.id},token=${token}`)
      if (this.isValid(token)){
        return next()
      }
      return next(new Error('认证错误'))
    })

    this.ioServer.on('connection', (socket)=>{
      logger.debug(`客户端${socket.id}已链接`);
      this.clientNodesId.push(socket.id)
      socket.join(socket.id,function(){
        console.log("in room",socket.id)
      })
      
      socket.on('error',(error)=>{
        console.log(error)
      })
      
      socket.on('disconnect', (reason)=>{
        logger.debug(`客户端${socket.id}已断开,原因是${reason}`);
        this.clientNodesId.remove(socket.id)
      });
          
      socket.on('error', (error)=>{
          logger.debug('error:',error);
      });
        
      socket.on('room1',(data)=>{
          socket.join('room1',(error)=>{
            if (error) throw error
            let rooms = Object.keys(socket.rooms)
            console.log(rooms)
            socket.to('room1').emit("test",`hello ${socket.id}`)
          })
      })
        
      socket.on('room2',(data)=>{
          socket.join('room2')
      })
  
      socket.on('test', (data,cb)=>{
          logger.debug(`服务端接收到${data}`);
          socket.emit('testResponse', data.toUpperCase());
          if (cb)
            //cb(`${data}`)
         cb({index:this.blockchain.lastblock().index,nonce:this.blockchain.lastblock().nonce})
      });
      
      socket.on('testResponse', (data)=>{
          logger.debug(`服务端接收到testResponse事件,${data}`);
      });
        
      socket.on('broadcast',(data)=>{
        logger.debug(`服务端收到广播broadcast,${JSON.stringify(data)}`)
        if (this.socketioClient){
          this.socketioClient.emit('broadcast',data)
        }
        socket.broadcast.emit('broadcast',data)
        this.emitter.emit(data.type,data)
      })
      
      socket.on('broadcastUp',(data)=>{
        logger.debug(`服务端收到广播broadcastUp,${JSON.stringify(data)}`)
        if (this.socketioClient){
          this.socketioClient.emit('broadcastUp',data)
        }
        this.emitter.emit(data.type,data)
      })
      
      socket.on('getNodes',(data,cb)=>{
        let nodes = this.nodes
        cb(nodes)
      })

      socket.on('getEntryNodes',(data,cb)=>{
        let entryNodes = this.entryNodes
        cb(entryNodes)
      })
      
      socket.on('getNodeInfo',(args,cb)=>{
        const nodeInfo = this.getNodeInfo()
        if (cb)
          cb(nodeInfo)
        else 
          socket.emit("getNodeInfoResponse",nodeInfo)
      })
      socket.on('getBlocks',(args,cb)=>{
        cb(this.getBlocks(args))
      })

    })
  }
  async defineInterface(peer){
    this.socketioClient = this.ioClient("http://"+peer,{'reconnectionAttempts':20,query:{'token':'youht'}})
    this.socketioClient.on('connect_error',(error)=>{
      logger.debug(`客户端${this.socketioClient.id}发生链接错误${error}`)
      this.socketioClient.disconnect()
    })
    this.socketioClient.on('connect_timeout',()=>{
      logger.debug(`客户端${this.socketioClient.id}发生超时错误`)
    })
    
    this.socketioClient.on('connect',()=>{
      this.entryNode = peer
      this.getEntryNodes()
        .then((data)=>{
          this.entryNodes = utils.set.union(data,[this.entryNode])
          logger.info("entryNode,entryNodes,me",this.entryNode,this.entryNodes,this.me)
          if (this.entryNodes.indexOf(this.me)!=-1){
            logger.fatal("error loop network")
            this.socketioClient.disconnect()
          }else if (this.entryNodes.length>=4){
            logger.fatal("error too deep network")
            this.socketioClient.disconnect()
          }else{
            let [...entryNodes] = this.entryNodes
            entryNodes.push(this.me)
            this.ioServer.sockets.emit('flushEntryNodes',entryNodes)
            this.config.entryNode = this.entryNode
            fs.writeFileSync("config.json",JSON.stringify(this.config,null,space=4))
          }
        })
      
      logger.debug(`客户端${this.socketioClient.id}已链接到${this.entryNode}`)
      this.emitter.emit("start")
      
      this.socketioClient.on('error',(error)=>{
        logger.debug(`客户端${this.socketioClient.id}发生错误${error}`)
        this.socketioClient.disconnect()
      })
      
      this.socketioClient.on('disconnect',(reason)=>{
        logger.debug(`客户端${this.socketioClient.id}已从${this.entryNode}断开,reason:${reason}`)
      })
    
      this.socketioClient.on('reconnect',(attemp)=>{
        logger.debug(`客户端${this.socketioClient.id}重连上${this.entryNode}重试${attemp}次`)
      })
    
      this.socketioClient.on('reconnect_attempt',(attemp)=>{
        logger.debug(`客户端${this.socketioClient.id}重连接${this.entryNode}第${attemp}次`)
      })
    
      this.socketioClient.on('reconnect_error',(error)=>{
        logger.debug(`客户端${this.socketioClient.id}重连${this.entryNode}错误${error}`)
        //this.socketioClient.disconnect()
      })
    
      this.socketioClient.on('reconnect_failed',()=>{
        logger.debug(`客户端${this.socketioClient.id}重连${this.entryNode}失败`)
        //this.socketioClient.disconnect()
      })
    
      this.socketioClient.on('test',(data,cb)=>{
        logger.debug(`客户端${this.socketioClient.id}在事件test上接收到${data}`)
        if (cb){
          cb({index:this.blockchain.lastblock().index,nonce:this.blockchain.lastblock().nonce})
        }
        this.socketioClient.emit("testResponse","okok")
      })
      
      this.socketioClient.on('getNodeInfo',(args,cb)=>{
        cb(this.getNodeInfo())
      })
   
      this.socketioClient.on('getBlocks',(args,cb)=>{
        cb(this.getBlocks(args))
      })
  
      this.socketioClient.on('testResponse',(data)=>{
        logger.debug(`客户端${this.socketioClient.id}在事件testResponse上接收到${data}`)
      })
      
      this.socketioClient.on('broadcast',(data)=>{
        logger.debug(`客户端${this.socketioClient.id}接收到广播broadcast,${JSON.stringify(data)}`)
        this.ioServer.sockets.emit('broadcast',data)
        this.emitter.emit(data.type,data)
      })
      this.socketioClient.on('broadcastDown',(data)=>{
        logger.debug(`客户端${this.socketioClient.id}接收到广播broadcastDown,${JSON.stringify(data)}`)
        this.ioServer.sockets.emit('broadcastDown',data)
        this.emitter.emit(data.type,data)
      })
      this.socketioClient.on('flushEntryNodes',(entryNodes)=>{
        [...this.entryNodes] = entryNodes
        console.log("flushEntryNodes",this.entryNodes)
        entryNodes.push(this.me)
        this.ioServer.sockets.emit('flushEntryNodes',entryNodes)
      })
    }) //on connect
  }
  
  getARpcData(event,args={}){
    //通过特定消息（event）得到节点周围（around）的特定data
    //返回promise数组
    let promiseArray=[]
    if (this.socketioClient){
      console.log("getARpcData","EntryNode")
      promiseArray.push(new Promise((resolve)=>{
        this.socketioClient.emit(event,args,(data)=>{
          resolve({_type:"entryNode",_id:"",data:data})
        })  
      }))
    }
    for (let id in this.ioServer.sockets.sockets){
      console.log("getARpcData",id)
      promiseArray.push(new Promise((resolve)=>{
        this.ioServer.sockets.connected[id].emit(event,args,(data)=>{
          resolve({_type:"clientNode",_id:id,data:data})
        })
      }))
    }
    return promiseArray
  }
  getERpcData(event,args={}){
    //通过特定消息（event）得到entry节点（entryNode）的特定data
    //返回promise数组
    let promiseArray=[]
    if (this.socketioClient){
      promiseArray.push(new Promise((resolve)=>{
        this.socketioClient.emit(event,args,(data)=>{
          resolve({_type:"entryNode",_id:"",data:data})
        })  
      }))
    }
    return promiseArray
  }
  getCRpcData(event,args={}){
    //通过特定消息（event）得到所有client节点（clientNodes）的特定data
    //返回promise数组
    for (let id in this.ioServer.sockets.sockets){
      promiseArray.push(new Promise((resolve)=>{
        this.ioServer.sockets.connected[id].emit(event,args,(data)=>{
          resolve({_type:"clientNode",_id:id,data:data})
        })
      }))
    }
    return promiseArray
  }
  
  async checkNode(){
    const that = this
    setInterval(()=>{
      logger.error("start checkNode...")
      if (that.socketioClient && that.socketioClient.connected)
        return
      let node = that.nodes.shift()
      that.nodes.push(node)
      //console.log(that.nodes,node)
      if (node != that.me) 
        that.defineInterface(node)
    },global.CHECK_NODE)
  }
  registeNode(peers){
    this.nodes = utils.set.union(this.nodes,peers)
    this.peers = this.nodes.join(',')
    fs.writeFile("peers",this.peers,(err)=>{
      if (err) throw err
    })
  }

  syncNode(){
    if (this.socketioClient){
      this.socketioClient.emit("getNodes",{},this.registeNode.bind(this))
    }
    this.broadcast(this.me,"registeNode")
  }
  
  
  async getEntryNodes(){
    return new Promise((resolve,reject)=>{
      if (this.socketioClient){
        this.socketioClient.emit("getEntryNodes",{},(data)=>{
          resolve(data)
        })
      }else{
        resolve()
      }
    })
  }
  async getARpcNodeInfo(){
    let promiseArray = this.getARpcData("getNodeInfo",{})
    console.log("getARpcNodeInfo",promiseArray)
    let result = await Promise.all(promiseArray)
    console.log("getARpcNodeInfo","done")
    return result       
  }
  getNodeInfo(){
    let peers=[]
    for (let peer of this.nodes){
      peers.push({"peer":peer,"isAlive":true})
    }
    let nodeInfo={
      "peers":peers,
      "me":this.me,
      "name":this.name,
      "entryNode":this.entryNode,
      "entryNodes":this.entryNodes,
      "clientNodesId":this.clientNodesId,
      "wallet.address":this.wallet.address,
      "wallet.balance":this.blockchain.utxo.getBalance(this.wallet.address),
      "node.isMining": this.mining, //node.eMining.isSet(),
      "node.miningPid": this.miningPid,
      "node.isBlockSyncing":this.blockSyncing, //node.eBlockSyncing.isSet(),
      "diffcult":this.diffcult,
      "blockchain.maxindex":this.blockchain.maxindex(),
      "blockchain.maxindex.nonce":this.blockchain.blocks[this.blockchain.maxindex()].nonce    
    }

    return nodeInfo
  }
  getBlocks(args){
    const {start,end} = args
    const blocks = this.blockchain.getRangeBlocks(start,end)
    return blocks
  }
  async clearTransaction(){
    utils.db.deleteMany("transaction",{},(err,result)=>{
        if (err) throw err
      })
  }
  async syncLocalChain(){
    const localChain = new Chain([])
    this.blockchain = localChain
    await global.db.findMany("blockchain",{},{"project":{"_id":0},"sort":["index","ascending"]}).then(blocks=>{
      for (let idx=0;idx<blocks.length;idx++){
        let localBlock=new Block(blocks[idx])
        localChain.addBlock(localBlock)
        if (idx==0){
          this.diffcult = localBlock.diffcult
          this.diffcultIndex = 0
          fs.writeFileSync("msg.txt",`start ${localBlock.index}-${localBlock.nonce},diffcult:${this.diffcult}\n`)
        }else{
          this.adjustDiffcult(idx)
        }
      }
    }) 
    //默认不检查本地blockchain，节省时间
    //if (!localChain.isValid()) throw new Error("本地chain不合法，重新下载正确的chain")
    return localChain
  }
  async syncOverallChain(full=false){
    let fromIndex,toIndex
    let bestNodes=[]
    
    fromIndex =full?0:this.blockchain.maxindex() - global.NUM_FORK + 1 
    if (fromIndex < 0) fromIndex=0

    logger.debug("step1:get around node info")
    const nodesInfo = await this.getARpcNodeInfo()
    if (nodesInfo.length==0)  return "unknown"
    logger.debug("step1.11111",nodesInfo)
    //确定具有最长链的节点组
    toIndex = fromIndex + 1 
    let otherIndex=0
    nodesInfo.map(info=>{
      let maxindex = info.data["blockchain.maxindex"]
      if ( maxindex == toIndex){
        bestNodes.push(info)
      }else if (maxindex>toIndex){
        toIndex = maxindex
        bestNodes=[info]
      }else{
        if (maxindex>otherIndex)
          otherIndex = maxindex
      }        
    })
    if (bestNodes.length==0) return otherIndex 
    logger.debug("step2.22222")
    //开始分配下载
    let range = toIndex - fromIndex + 1
    let count = bestNodes.length
    let promiseArray=[]
    //console.log("syncOverallChain","count",count,"range",range,"fromIndex",fromIndex,"toIndex",toIndex)
    for(let idx=0;idx<count;idx++){
      let end=Math.ceil(range * (idx+1) / count) - 1 + fromIndex
      let start =Math.ceil( range * idx / count) +1 - 1 + fromIndex
      logger.debug(`step2:put range block ${start}-${end} into blockPool from ${bestNodes[idx]._id}`)
      if (bestNodes[idx]._type=="entryNode"){
        if (this.socketioClient){
          promiseArray.push(new Promise((resolve)=>{
            this.socketioClient.emit("getBlocks",{start,end},(data)=>{
              for (let blockDict of data){
                const block = new Block(blockDict)
                if (block.isValid())
                  block.saveToPool()
              }
              resolve({_type:"entryNode",_id:"",data:data})
            })  
          }))
        }
      }else{
        promiseArray.push(new Promise((resolve)=>{
          this.ioServer.sockets.connected[bestNodes[idx]._id].emit("getBlocks",{start,end},(data)=>{
              for(let blockDict of data){
                const block = new Block(blockDict)
                if (block.isValid())
                  block.saveToPool()
              }
              resolve({_type:"clientNode",_id:bestNodes[idx]._id,data:data})
          })
        }))
      }
    }
    const result = await Promise.all(promiseArray).then(()=>console.log("完成同步"))
    logger.debug("step3:wait blockPoolSync to build a bestChain")
    return toIndex
  }
  async syncToBlockPool(fromIndex,toIndex){
    return new Promise((resolve,reject)=>{
      if (!toIndex) toIndex=fromIndex
      this.getRpcRangeBlocks(fromIndex,toIndex)
        .then(blocks=>{
          console.log("syncToBlockPool",blocks.length)
          blocks.map((blockJson)=>{
             const block = new Block(blockJson)
             if (block.isValid()) 
               block.saveToPool()
          })
          resolve()
        })
        .catch(e=>logger.error(e))    
    })
  }
  async txPoolSync(){
    return new Promise(async (resolve,reject)=>{
      let txPool=[]
      let now = new Date().getTime()
      await global.db.findMany("transaction",{$or:[{lockTime:0},{lockTime:{$lte:now}}]},{"projection":{"_id":0},"sort":[["timestamp","ascending"]]}).then(docs=>{
          for (let tx of docs){
            txPool.push(Transaction.parseTransaction(tx))
          }
        }) 
      resolve(txPool)
    })
  }
  async txPoolRemove(block){
    //remove transactions from txPool
    if (block){
      try{
        for (let TX of block.data){
          console.log("txPoolRemove",TX instanceof Transaction)
          if (TX.isCoinbase()){
            continue
          }
          await global.db.deleteOne("transaction",{"hash":TX.hash})
        }
      }catch(err){
        logger.fatal(block,err)
        throw err
      }
    }
  }
  async resolveFork(linkBlocks,forkLevels={},resolve=false){
    try{
      let block = linkBlocks[linkBlocks.length - 1]
      let index = block.index - 1
      if (index==-1) {
        return false 
      }
      if (!forkLevels[index])
        forkLevels[index] = await utils.db.findMany("blockpool",{"index":index},{"_id":0})
      if (forkLevels[index].length==0) return false
      for (let forkBlock of forkLevels[index]){
        if (block.prevHash != forkBlock.hash) continue
        linkBlocks.push(new Block(forkBlock))
        if (forkBlock.index==0 || forkBlock.prevHash == this.blockchain.blocks[forkBlock.index-1].hash) {
          return true
        }
        await this.resolveFork(linkBlocks).then(result=>{
          resolve = result
        })
        if (resolve) {
          //console.log("resolveFork",linkBlocks.length)
          return true 
        }
        linkBlocks.pop()
       }
       return false
     }catch(error){
       throw error
     }
  }  
  async blockPoolSync(blocksDict){
    this.blockSyncing = true
    for (let blockDict of blocksDict){
      let block = new Block(blockDict)
      let linkBlocks = [block]
      if (!block.isValid()) continue
      if (block.prevHash != this.blockchain.lastblock().hash){
        let resolve = await this.resolveFork(linkBlocks)  
        logger.warn("blockPoolSync",resolve,linkBlocks.map(block=>{return `${block.index}-${block.nonce}`}))
        if (!resolve) continue
      }  
      //将linkBlocks联入blockchain
      for (let i=1;i<linkBlocks.length;i++){
        await this.blockchain.moveBlockToPool(linkBlocks[i].index)
        logger.info(`已经从主链删除区块:${linkBlocks[i].index}`)
      }
      for (let i=linkBlocks.length - 1;i>=0;i--){
        let linkBlock = linkBlocks[i]
        if (!this.blockchain.addBlock(linkBlock)) break
        const {...tradeUTXO} = this.blockchain.utxo.utxoSet 
        this.tradeUTXO.utxoSet = tradeUTXO
        const {...isolateUTXO} = this.blockchain.utxo.utxoSet 
        this.isolateUTXO.utxoSet = isolateUTXO
        await this.txPoolRemove(linkBlock)
        await linkBlock.save()
        await linkBlock.removeFromPool()
        logger.info(`已经增加区块:${linkBlock.index}-${linkBlock.nonce}到主链`)
        this.adjustDiffcult(linkBlock.index)
        
        if (this.miningPid){
          logger.warn(`will kill findNonce pid:${this.miningPid}`)
          exec(`kill ${this.miningPid}`)
          this.miningPid=null
          this.mining=false 
        }        
        this.blockSyncing = false
        return true
      }
    }
    this.blockSyncing = false
    return false
  }
  async blockPoolSync_old(blocksDict){
    let maxindex = this.blockchain.maxindex()
    let block,doutxo
    logger.info(`is BlockSyning ${maxindex+1} from pool`)
    try{
      for (let blockDict of blocksDict){
        let block = new Block(blockDict)
        if (block.isValid()){
          logger.debug(`syncblock0.current maxindex ${this.blockchain.maxindex()}`)
          if (!this.blockchain.addBlock(block)){
            continue
          }
          if (block.index==0){
            doutxo = this.resetUTXO()
          }else{
            doutxo = this.updateUTXO(block)
          }
          const utxoSummary = JSON.stringify(this.blockchain.utxo.getSummary())
          logger.debug(`syncblock1.after update utxo ${utxoSummary},and this fun is ${doutxo}`)
          if (doutxo){
            logger.debug(`syncblock2. txPoolRemove ${block.index}`)
            this.txPoolRemove(block)
            logger.debug("syncblock3.block.save")
            block.save()
            logger.debug(`syncblock4.remove pool block ${block.index}`)
            block.removeFromPool()
            logger.debug(`syncblock5.current maxindex ${this.blockchain.maxindex()}`)
            logger.warn(`end blocksync ${block.index}-${block.nonce}`)
            logger.debug(`syncblock6.move isolateBlock of this level to blockpool`)
            const f=function(isolateBlockPool){
              for (let block of isolateBlockPool){
                block.saveToPool()
              }
            }
            f(this.isolateBlockPool)
            this.isolateBlockPool=[]
            return 
          }else{
            this.blockchain.blocks.pop() //del added block just moment
            continue 
          }
        }else{
          console.log("can't be here???")
        }
      }
      //resolveFork
      block = this.blockchain.lastblock()
      this.isolateBlockPool.push(block)
      await this.blockchain.popBlock()              
    }catch(err){
      logger.fatal(err)
    }
  }

  resetUTXO(){
    this.blockchain.utxo.reset(this.blockchain)
    //定义tradeUTXO,避免与blockchain的UTXO互相影响，更新trade时会更新tradeUTXO，以保证多次交易。更新block时使用blockchain下的UTXO
    logger.fatal("resetUTXO!!!")
    this.tradeUTXO = new UTXO("trade")
    const {...tradeUTXO} = this.blockchain.utxo.utxoSet 
    this.tradeUTXO.utxoSet = tradeUTXO
    this.isolateUTXO = new UTXO("isolate")
    const {...isolateUTXO} = this.blockchain.utxo.utxoSet 
    this.isolateUTXO.utxoSet = isolateUTXO
    return this.blockchain.utxo.utxoSet
  }
  updateUTXO(block){
    logger.fatal("updateUTXO!!!")
    if (this.blockchain.utxo.update(block)){
      const {...tradeUTXO} = this.blockchain.utxo.utxoSet
      this.tradeUTXO.utxoSet = tradeUTXO
      const {...isolateUTXO} = this.blockchain.utxo.utxoSet 
      this.isolateUTXO.utxoSet = isolateUTXO
      return true
    }else{
      return false
    }
  }
  async tradeTest({nameFrom,nameTo,amount,script="",assets={},lockTime=0}){
    let wFrom,wTo
    let inAddr,outAddr
    let inPrvkey,inPubkey,outPubkey
    let signNum
    wFrom = await new Wallet(nameFrom=='me'?this.me:nameFrom)
    if (!script && !nameTo) throw new Error("转入账户与合约脚本不能同时为空")
    if (script && nameTo) throw new Error("转入账户与合约脚本不能同时定义")
    if (nameTo){
      //定义了外部转入账户
      if (Wallet.isAddress(nameTo)){
        outAddr = nameTo
      }else{
        wTo   = await new Wallet(nameTo  =='me'?this.me:nameTo)
        outAddr = wTo.address
      }
      inAddr  = wFrom.address
      inPrvkey=wFrom.key.prvkey
      inPubkey=wFrom.key.pubkey
      signNum = 1 
    }else{
      //定义一个合约账户，并定义一个多重签名账户，从而完成合约部署
      inAddr = wFrom.address
      let contractName = utils.hashlib.md5(inAddr,script,new Date().getTime())
      wTo   =  new Wallet()
      await wTo.chooseByName(contractName)
          .catch(async e=>{
            logger.error(`尚没有钱包，准备创建${contractName}的合约账户`)
            let key=utils.ecc.generateKeys()
            console.log("key",key)
            console.log("wFrom",wFrom.key)
            let [...pubkey] = wFrom.key.pubkey
            pubkey.push(key.pubkey)
            let [...prvkey] = wFrom.key.prvkey
            prvkey.push(key.prvkey)
            console.log(prvkey,pubkey)
            wTo.create(contractName,prvkey,pubkey)
              .then(()=>logger.info("合约账户创建成功"))
              .catch(e=>console.log("error2",e))
          })
      inPrvkey=wFrom.key.prvkey
      inPubkey=wFrom.key.pubkey
      outAddr = wTo.address
      signNum = 2
    }
    if (wFrom.key.prvkey){
      let txDict = await this.trade({
        inPrvkey,inPubkey,inAddr,outAddr,amount,script,assets,signNum,lockTime}).catch(error=>{
          throw error
        })
      return txDict
    }else{
      throw new Error(`${nameFrom} have not private key on this node`)
    }
  }

  async trade({inPrvkey,inPubkey,inAddr,outAddr,amount,script="",assets={},signNum,lockTime=0}){
    const newTX= await Transaction.newTransaction({
           inPrvkey:inPrvkey,
           inPubkey:inPubkey,
           inAddr:inAddr,
           outAddr:outAddr,
           amount:amount,
           utxo:this.tradeUTXO,
           script:script,
           assets:assets,
           signNum:signNum,
           lockTime:lockTime}).catch(error=>{throw error})
    if (!newTX) return
    let newTXdict=utils.obj2json(newTX)
    this.emitter.emit("transacted",newTXdict)
    // use socket to broadcast instead of http
    logger.info(`broadcast transaction ${newTX.hash}`)
    this.broadcast(newTXdict,"newTransaction")
    
    logger.info("transaction广播完成")
    return newTXdict
  }
  
  async genesisBlock(coinbase){
    return new Promise(async (resolve,reject)=>{
      let newBlock=await this.findNonce(
        {"index":0,
        "prev_hash":"0",
        "data":[coinbase],
        "diffcult":global.ZERO_DIFF,
        "lockTime":0,
        "timestamp":new Date().getTime()
        }
      )
      newBlock.save()
        .then(()=>resolve(newBlock))
        .catch(e=>reject (e))
    })
  }
  
  async mine(cb){
    this.mining = true
    //sync transaction from txPool
    let txPool = [] 
    let fee=0,inamt=0,outamt=0
    let value = []
    await this.txPoolSync().then((txs)=>{
      for(let tx of txs){
        txPool.push(tx)
        //处理交易费
        let inAmount=0,outAmount=0
        for (let txIn of tx.ins){
          let prevTx = this.blockchain.findTransaction(txIn.prevHash)
          inAmount += prevTx.outs[txIn.index].amount
        }
        for (let txOut of tx.outs){
          outAmount += txOut.amount
        }
        value.push({inAmount,outAmount})
        fee +=  inAmount - outAmount
        inamt += inAmount
        outamt += outAmount       
      }
    })
    logger.warn("mine","fee,inamt,outamt",fee,inamt,outamt)
    let coinbase = Transaction.newCoinbase(this.wallet.address,fee)
    txPool.unshift(coinbase)
    
    let prevBlock = this.blockchain.lastblock()
    
    //mine a block with a valid nonce
    const blockDict = { 
       index    :prevBlock.index + 1, 
       timestamp:new Date().getTime(),
       data     :txPool,
       prevHash :prevBlock.hash,
       diffcult :this.diffcult,
       nonce    :0
      }
    logger.warn(`is mining block ${blockDict.index},diffcult:${blockDict.diffcult}`)
    const newBlock = await this.findNonce(blockDict)
    if (!newBlock){
      this.mining=false
      return "other miner mined"
    }
    logger.info(`[end] mine ${newBlock.index}-${newBlock.nonce}`)
    //remove transaction from txPool
    await this.txPoolRemove(newBlock) 
    
    const newBlockDict = utils.obj2json(newBlock)

    this.mining=false

    //push to blockPool
    this.emitter.emit("mined",newBlockDict)
    //broadcast newBlock
    logger.info(`broadcast block ${newBlock.index}-${newBlock.nonce}`)
    this.broadcast(newBlockDict,"newBlock")
      
    logger.info("mine广播完成")
    
    //以下由blockPoolSync处理
    //newBlock.save()
    //self.blockchain.add_block(newBlock)
    //self.updateUTXO(newBlock)
    
    if (cb)
      return cb(null,newBlock)
    return newBlock
  }
  async findNonce(blockDict){
    return new Promise((resolve,reject)=>{
      console.time("mine")
      const p = fork('./findNonce.js')
      this.miningPid = p.pid
      p.on('message',function(data){
        let newBlock = new Block(data)
        console.timeEnd("mine")
        logger.info(`block ${newBlock.index} mined. Nonce: ${newBlock.nonce} , hash: ${newBlock.hash}`)
        return resolve(newBlock) 
      })
      p.on('exit',()=>{
        return resolve(null)
      })
      p.send(blockDict)
    })    
  }
  async mined(blockDict){
    return new Promise(async (resolve,reject)=>{
      //validate possible_block
      const block = new Block(blockDict)
      logger.info(`recieve block index ${block.index}-${block.nonce}`)
      if (!block.isValid()) 
        return resolve(false)
      //save to blockpool
      await block.saveToPool()
      //await global.db.updateOne("blockpool",{"hash":block.hash},{"$set":utils.obj2json(block)},{"upsert":true})
      return resolve(true)
    })
  }
  async transacted(txDict){
    return new Promise(async (resolve,reject)=>{
      //validate possible_block
      const TX = Transaction.parseTransaction(txDict)
      logger.info(`recieve transaction ${TX.hash}`)
      if (TX.isValid()){
        let {...utxoSet} = this.isolateUTXO.utxoSet
        //log.critical("1",utxoSet)
        if (this.isolateUTXO.updateWithTX(TX,utxoSet)){
          this.isolateUTXO.utxoSet = utxoSet
          //save to file to transaction pool
          await global.db.updateOne("transaction",{"hash":TX.hash},{"$set":utils.obj2json(TX)},{"upsert":true})
          //handle isolatePool
          let [...isolatePool] = this.isolatePool 
          for (let isolateTX of isolatePool){
            if (this.isolateUTXO.updateWithTX(isolateTX,utxoSet)){
              this.isolatePool.remove(isolateTX)
              //save to file to transaction pool
              await global.db.updateOne("transaction",{"hash":isolateTX.hash},{"$set":utils.obj2json(isolateTX)},{"upsert":true})
            }else{
              let {...utxoSet} = this.isolateUTXO.utxoSet
            }
          }
        }else{
          this.isolatePool.push(TX)
        }
        resolve(true)
      }else{
        //ditch it
        logger.warn("transaction is not valid,hash is:",TX.hash)
        resolve(false)
      }
    })
  }
  broadcast(data,type){
    let message = {"type":type,"value":data}
    if (this.socketioClient){
      this.socketioClient.emit("broadcast",message)
    }
    this.ioServer.emit("broadcast",message)
  }
  
}

//module.exports = Node
exports.Node = Node