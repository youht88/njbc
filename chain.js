const deepmerge = require("deepmerge")
const fs=require('fs')
const async = require("async")
const utils = require("./utils.js")
const logger = utils.logger.getLogger()
const TXout = require("./transaction.js").TXout
const Block = require("./block.js").Block
const Wallet = require("./wallet.js").Wallet

class UTXO{
  constructor(name){
    /* sample struct like this 
       {3a75be...:[{"index":0,"txout":TXout1},{"index":1,"txout":TXout2}],
        m09qf3...:[{"index":0,"txout":TXout3}]}
    */
    this.utxoSet={}
    this.name = name
  }
  reset(blockchain){
    let utxoSet={}
    let spendInputs=[]
    let block = blockchain.lastblock()
    while (block){
      let [...data] = block.data
      //import!! 倒序检查block内的交易
      data.reverse() 
      for (let TX of data){
        let unspendOutputs=[]
        for (let idx=0;idx<TX.outs.length;idx++){ 
          let txout = TX.outs[idx]
          let notFind=true
          for (let item of spendInputs){
            if (TX.hash==item["hash"] && idx==item["index"]){
                notFind=false
                break
            }
          }
          if (notFind){
            unspendOutputs.push({
                      "index":idx,
                      "txout":new TXout({"amount":txout.amount,
                                     "outAddr":txout.outAddr,
                                     "signNum":txout.signNum,
                                     "script":txout.script,
                                     "lockTime":txout.lockTime
                                     })
                      })
          }
        }
        if (!TX.isCoinbase()){
          for (let idx=0;idx<TX.ins.length;idx++){
            let txin = TX.ins[idx]
            spendInputs.push({"hash":txin.prevHash,"index":txin.index})
          }
        }
        if (unspendOutputs.length!=0){
          utxoSet[TX.hash]=unspendOutputs
        }
      }
      block = blockchain.findBlockByHash(block.prevHash)
    }
    this.utxoSet = utxoSet
    this.save()
    logger.debug("utxo summary:",this.getSummary())
    return utxoSet
  }
  update(block){
    let [...data] = block.data
    let {...utxoSet} = this.utxoSet
    for (let TX of data){
      if (!this.updateWithTX(TX,utxoSet))
        return false
    }
    //maybe mem leek,check later
    this.utxoSet = utxoSet 
    logger.debug("utxo summary:",this.getSummary())
    return true
  }
  updateWithTX(TX,utxoSet=null){
    if (!utxoSet)
      utxoSet=this.utxoSet
    //ins
    if (!TX.isCoinbase()){  
      for (let idx=0;idx<TX.ins.length;idx++){
        let txin = TX.ins[idx]
        let outs=utxoSet[txin.prevHash]
        if (!outs){
          logger.fatal("1.double spend")
          return false
        }
        let findIndex = false
        let [...newouts] = outs
        for (let out of outs) {
          if (out["index"] == txin.index){
            findIndex=true
            //check out canbeUnlock?
            try{
              if (!out["txout"].canbeUnlockWith(txin.inAddr)){
                logger.error("0.script locked",`txin:${txin.prevHash}-${txin.index}`,txin.inAddr,out["txout"].outAddr)
                return false
              }
            }catch(e){
               logger.fatal("意外错误?",e)
               return false
            }
            //no problem
            newouts.remove(out)
          }
        }
        if (!findIndex){
          //not find prevHash-index point
          logger.fatal("2.double spend")
          return false
        }
        if (newouts.length==0){ //该键值全部已全部删除
          try{
            delete utxoSet[txin.prevHash]
          }catch(e){
            logger.fatal("3.double spend")
            return false
          }
        }else{
          utxoSet[txin.prevHash]=newouts
        }
      }
    }
    //outs
    let unspendOutputs=[]
    for (let idx=0;idx<TX.outs.length;idx++){
      let txout = TX.outs[idx]
      unspendOutputs.push({
                    "index":idx,
                    "txout":new TXout({"amount":txout.amount,
                                   "outAddr":txout.outAddr,
                                   "signNum":txout.signNum,
                                   "script":txout.script,
                                   "lockTime":txout.lockTime
                                   })
                        })
    }
    if (unspendOutputs.length!=0){
      utxoSet[TX.hash]=unspendOutputs
    }
    return true
  }
  updateAfterRemove(prevTXs,block){
    let [...data]=block.data
    //import!! 倒序检查block内的交易
    data.reverse() 
    for (let TX of data){
      this.updateWithTXAfterRemove(prevTXs,TX)
    }
  }
  updateWithTXAfterRemove(prevTXs,TX){
    let {...utxoSet}=this.utxoSet
    //outs
    let outputs=utxoSet[TX.hash]
    let [...newoutputs] = outputs
    for (let idx=0;idx<TX.outs.length;idx++){
      let txout = TX.outs[idx]
      for (let output of outputs){
        if (output["index"]==idx){
          //del outputs[idx1]
          newoutputs.remove(output)
          break
        }
      }
    }
    if (newoutputs.length==0){
      delete utxoSet[TX.hash]        
    }else{
      utxoSet[TX.hash]=newoutputs
    }
    //ins
    if (!TX.isCoinbase()){
      for (let idx =0;idx < TX.ins.length;idx++){
        let txin = TX.ins[idx]
        let outs=utxoSet[txin.prevHash]
        if (!outs) outs=[]
        let prevTX=prevTXs[txin.prevHash]
        let prevOuts = prevTX.outs
        outs.push({
            "index":txin.index,
            "txout":new TXout({
                "amount" : prevTX.outs[txin.index].amount,
                "outAddr": prevTX.outs[txin.index].outAddr,
                "signNum": prevTX.outs[txin.index].signNum,
                "script" : prevTX.outs[txin.index].script,
                "lockTime":prevTX.outs[txin.index].lockTime
                })
            })
        utxoSet[txin.prevHash] = outs
      }
    }
    this.utxoSet = utxoSet
    return utxoSet
  }
  
  findUTXO(address){
    const utxoSet = this.utxoSet
    let findUtxoSet={}
    for (let uhash in utxoSet) {
      let outs = utxoSet[uhash]
      let unspendOutputs=[]
      for (let out of outs){
        if (out["txout"].canbeUnlockWith(address)){
          unspendOutputs.push({"index":out["index"],"txout":out["txout"]})
        }
      }
      if (unspendOutputs.length!=0){
        findUtxoSet[uhash]=unspendOutputs
      }
    }
    return findUtxoSet
  }

  findSpendableOutputs(address,amount){
    let acc=0
    let unspend = {}
    const utxoSet = this.findUTXO(address)
    for (let uhash in utxoSet){
      let outs = utxoSet[uhash]
      for (let out of outs){
        acc = acc + out["txout"].amount
        unspend[uhash]={"index":out["index"],
                        "amount":out["txout"].amount,
                        "signNum":out["txout"].signNum}
        if (acc >=amount)
          break
      }
      if (acc >= amount)
        break
    }
    return {"acc":acc,"unspend":unspend}
  }
  getBalance(address){
    let total=0
    const utxoSet=this.findUTXO(address)
    for (let uhash in utxoSet){
      let outs = utxoSet[uhash]
      for (let out of outs){
        total = total + out.txout.amount
      }
    }
    return total
  }
  getSummary(){
    let total=0,txs=0
    let outs
    for (let txHash in this.utxoSet){
      txs +=1
      outs = this.utxoSet[txHash]
      for (let out of outs){
        total += out["txout"].amount
      }
    }
    return {"txs":txs,"total":total}
  }  
  async save(){
    await global.db.deleteMany("utxo",{})
    let docs=[]
    for (let doc in this.utxoSet){
      docs.push({"txHash":doc,"outs":this.utxoSet[doc]})
    }
    global.db.insertMany("utxo",docs)
      .then(()=>logger.info("utxo had been saved"))
      .catch((e)=>logger.error("utxo save error",e))
  }
}

class Chain{
  constructor(blocks){
    this.blocks = blocks
    this.utxo = new UTXO('main')
    global.blockchain = this
  }
  isValid(){
    const blocks = this.blocks.slice(1)
    logger.info("verifing blockchain...",blocks.length)
    for (var index=1 ;index < blocks.length;index ++){
      const curBlock = blocks[index]
      const prevBlock = blocks[index - 1]
      if (prevBlock.index+1 != curBlock.index){
        logger.error("index error",prevBlock.index,curBlock.index)
        return false
      }
      if (!curBlock.isValid()){
        //checks the hash
        logger.error(`curBlock ${index}-${curBlock.nonce}  false`)
        return false
      }
      if (prevBlock.hash != curBlock.prevHash){
        logger.error("block ",curBlock.index," hash error",prevBlock.hash,curBlock.prevHash)
        return false
      }
    }
    return true
  }
  save(){
    for (var i ; i<this.blocks.length;i++){
      this.blocks[i].save()
    }
    return true
  }
  lastblock(){
    if (this.blocks.length==0) return null
    return this.blocks[this.blocks.length - 1]
  }
  maxindex(){
    if (this.blocks.length==0) return -1
    return this.blocks[this.blocks.length - 1].index
  }
  addBlock(newBlock){
    let doutxo
    if (newBlock.index >= 1){
      if (newBlock.index > this.blocks.length){
        logger.warn(`add block but the new block ${newBlock.index}-${newBlock.nonce} has error index.`)
        return false  
      }
      if (newBlock.prevHash != this.blocks[newBlock.index - 1].hash){
        logger.warn(`add block but new block ${newBlock.index}-${newBlock.nonce} has error prevHash.`)
        return false
      }
      this.blocks.push(newBlock)
    }else if (newBlock.index==0){
      this.blocks.push(newBlock)
    }
    if (newBlock.index==0) 
      doutxo = this.utxo.reset(this)
    else 
      doutxo = this.utxo.update(newBlock)
    if (!doutxo){
      this.blocks.pop()
      return false
    }   
    return true
  }
  //removeBlock
  async popBlock(){
    const block = this.blocks.pop()
    await global.db.deleteOne("blockchain",{"index":block.index})
    logger.warn(`remove block ${block.index}-${block.nonce} from chain`)
    const prevTXs=this.findPrevTransactions(block)
    this.utxo.updateAfterRemove(prevTXs,block)
  }
  getRangeBlocks(fromIndex,toIndex){
    const maxindex = this.maxindex()
    fromIndex=parseInt(fromIndex)
    toIndex=parseInt(toIndex)
    if (toIndex>maxindex) toIndex=maxindex
    if (fromIndex<0 || fromIndex>maxindex) return []
    if (toIndex<fromIndex  || toIndex>maxindex) return []
    const blocks = this.blocks.slice(fromIndex,toIndex + 1)
    return blocks
  }
  findBlockByIndex(index){
    if (index<0) return false
    if (this.blocks.length >= index + 1) return this.blocks[index]
    return false
  }
  findBlockByHash(uhash){
    for (let b of this.blocks){
      if (b.hash == uhash){
        return b
      }
    }
    return false
  }
  findThingsByCond({from=-1,direct=-1,maxtimes=null},cond){
    if (!cond) return 
    let block,index
    let times=0,result={}
    let maxindex=this.blocks.length - 1
    if (from==-1) {
      from = maxindex
    }
    index = from
    while (index>=0 && index<=maxindex){
      block = this.blocks[index] 
      let data=block.data
      for (let TX of data){
        if (!cond(block,TX)) continue;
        times++
        if (maxtimes && times >= maxtimes) {
          break 
        }
      }
      if (maxtimes && times >= maxtimes) {
        break 
      }
      index += direct
    }
  }
  findContract(contractHash){
    let result=null
    if (!contractHash){
      result = []
      this.findThingsByCond({},(block,TX)=>{
        if (TX.outs[0].contractHash.length!=0){
          result.push({
            contractHash:TX.outs[0].contractHash,
            blockIndex:block.index,
            blockHash:block.hash,
            blockNonce:block.nonce,
            txHash:TX.hash,
            contractAddr:TX.outs[0].outAddr,
            script:TX.outs[0].script,
            assets:TX.outs[0].assets,
            owner :TX.ins[0].inAddr
          })
          return true
        } 
        return false
      })
    }else{
      this.findThingsByCond({maxtimes:1},(block,TX)=>{
        if (TX.outs[0].contractHash==contractHash){
          result =  {
            blockIndex:block.index,
            blockHash:block.hash,
            blockNonce:block.nonce,
            txHash:TX.hash,
            contractAddr:TX.outs[0].outAddr,
            script:TX.outs[0].script,
            assets:TX.outs[0].assets,
            owner :TX.ins[0].inAddr
          }
          return true
        }
        return false
      })
    }
    return result
  }
  findTransaction(uhash){
    let result={}
    this.findThingsByCond({maxtimes:1},(block,TX)=>{
      if (TX.hash==uhash){
        result =  TX 
        return true
      }
      return false
    })
    return result
  }
  findTransactionBlock(uhash){
    let result={}
    this.findThingsByCond({maxtimes:1},(block,TX)=>{
      if (TX.hash==uhash){
        result =  block 
        return true
      }
      return false
    })
    return result
  }
  findPrevTransactions(block){
    let transactions={}
    for (let TX of block.data){
      //忽略coinbase
      if (TX.isCoinbase()) continue
      for (let ins of TX.ins){
        let transaction = this.findTransaction(ins.prevHash)
        if (transaction)
          transactions[transaction.hash]=transaction
      }
    }
    return transactions
  }

  findOutput(txHash,index){
    let block=this.lastblock()
    let bindex=block.index
    while (bindex >= 0){
      const TXs = block.data
      for (let tx of TXs){
        if (tx.hash == txHash){
          try{
            return tx.outs[index]
          }catch(e){
            logger.error("!!",txHash,index,tx.hash)
            return null
          }
        }
      }
      bindex = bindex -1
      block = this.findBlockByIndex(bindex)   
    }
    return null   
  }
  async findBalanceFromContract({contractHash,outAddr}){
    const contract = this.findContract(contractHash)
    if (!contract) return 0
    if (outAddr){
      if (!Wallet.isAddress(outAddr)){
        let wTo = await new Wallet(outAddr)
        outAddr = wTo.address
      }
    }
    return this.findBalanceTo({
        from:contract.blockIndex,
        direct:1,
        inAddr:contract.contractAddr,
        outAddr:outAddr
      })
  }
  findBalanceTo({from=-1,direct,inAddr=null,outAddr=null}){
    //if (!outAddr) throw new Error("输出地址不能为空")
    let amount = 0
    this.findThingsByCond({from:from,direct:direct},(block,tx)=>{
      if (tx.isCoinbase()) return false
      if ((!inAddr || tx.ins[0].inAddr == inAddr) && (!outAddr || tx.outs[0].outAddr == outAddr)){
        amount += tx.outs[0].amount
        return true
      }
      return false      
    })
    console.log("total amount",amount)
    return amount
  }
  async findContractAssets({contractHash,key=null,inAddr=null,list=false}){
    const contract = this.findContract(contractHash)
    if (!contract) return {}
    let assets = await this.findAssets({
         key:key,
         from:contract.blockIndex,
         outAddr:contract.contractAddr,
         inAddr :inAddr,
         list   :list
      })
    return assets
  }
  async findAssets({key=null,from=0,outAddr=null,inAddr=null,list=false}){
    //正序合并所有inAddr(如无inAddr则表示不限定)输出给outAddr的assets数据资源
    console.log("...",outAddr,inAddr)
    let account
    if (inAddr){
      account = await new Wallet(inAddr).catch(error=>{return error})
      inAddr = account.address
    }
    //if (!outAddr) throw new Error("输出地址不能为空")
    let assets = {}
    let newAssets
    this.findThingsByCond({from:from,direct:1},async (block,tx)=>{
      if (tx.isCoinbase()) return false
      if ((!outAddr || tx.outs[0].outAddr == outAddr) && 
          (!inAddr || tx.ins[0].inAddr == inAddr)){
        if (typeof tx.outs[0].assets == "string") { //加密
          if (inAddr){
            try{
              newAssets = JSON.parse(utils.ecc.deCipher(tx.outs[0].assets,account.key.prvkey[0]))
            }catch(err){
              newAssets = {encrypted:[tx.outs[0].assets]}
            }
          }else{
            newAssets = {encrypted:[tx.outs[0].assets]}
          }
        }else{
          newAssets = tx.outs[0].assets
        }

        if (key){
          let keys=key.split(".")
          newAssets = keys.reduce(function(xs, x) {
            return (xs && xs[x]) ? xs[x] : null;
          },newAssets);
        }

        if (!newAssets) return true
        
        newAssets={data:newAssets,_timestamp:tx.timestamp}

        
        if (list){
          newAssets = {list:[newAssets]}
        }
        
        console.log("****",newAssets)

        assets = deepmerge(assets,newAssets,{arrayMerge:
          (target,source,options)=>{
            for (let item of source){
             if (target.indexOf(item)!==-1) continue;
             target.push(item)
            }
            return target
          }
        })
        
        return true
      }
      return false
    })
    console.log("total assets",Object.keys(assets))
    return assets
  }
  
  async moveBlockToPool(index){
    console.log("moveBlockToPool",index,this.maxindex())
    if (index!=this.maxindex())
      throw new Error(`can't move BlockToPool,index=${index}`)
    const blockDict = await global.db.findOne("blockchain",{"index":index},{"project":{"_id":0}})
    const block = new Block(blockDict)
    await this.popBlock(block)
    await block.saveToPool()
  }

  getSPV(){
    let blockSPV=[]
    for (let block of this.blocks){
      const item = {"txCount":block.data.length,
              "diffcult": block.diffcult, 
              "hash":block.hash, 
              "index": block.index, 
              "merkleRoot":block.merkleRoot,  
              "nonce": block.nonce, 
              "prev_hash":block.prevHash,  
              "timestamp": block.timestamp}
      blockSPV.push(item)
    }
    return blockSPV        
  }

}

module.exports.Chain = Chain
module.exports.UTXO  = UTXO