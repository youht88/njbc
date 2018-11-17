const Block = require("./block.js").Block

process.on("message",(blockDict)=>{
  let diffcult = parseInt(blockDict.diffcult)
  let newBlock = new Block(blockDict)
  const preHeaderStr = newBlock.preHeaderString()
  newBlock.updateHash(preHeaderStr)
  while (newBlock.hash.slice(0,diffcult)!= Array(diffcult+1).join('0')){
    //if not genesis and blockchain had updated by other node's block then stop
    newBlock.nonce += 1
    newBlock.updateHash(preHeaderStr)
  }
  process.send(newBlock)
  process.exit(0)
})

