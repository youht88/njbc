const Block = require("./block.js").Block

process.on("message",(blockDict)=>{
  let diffcult = parseInt(blockDict.diffcult)
  let length = Math.floor(diffcult / 4 )
  let mod = diffcult % 4
  let newBlock = new Block(blockDict)
  const preHeaderStr = newBlock.preHeaderString()
  newBlock.updateHash(preHeaderStr)
  while (parseInt(newBlock.hash.slice(0,length+1),16) >= 2**(4-mod)){
    //if not genesis and blockchain had updated by other node's block then stop
    newBlock.nonce += 1
    newBlock.updateHash(preHeaderStr)
  }
  process.send(newBlock)
  process.exit(0)
})

