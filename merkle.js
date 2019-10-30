const hashlib = require("./utils.js").hashlib

class Leaf{
  constructor(){
    this.value = null
    this.left = null
    this.right = null
  }
}
class Tree{
  constructor(hashFun="sha256",hashNode=true){
    hashFun = hashFun.toLowerCase()
    if (["sha256","sha512","md5","ripemd160"].indexOf(hashFun)>=0){
      this.hashFun = hashlib[hashFun]
    }else{
      this.hashFun = hashlib["sha256"]
    }
    this.hashNode = hashNode
    this.root = null
    this.levels=[]
  }
  addNode(left,right,data){
    const hashFun = this.hashFun
    let node = new Leaf()
    if (left==null && right==null){
      if (this.hash){
        node.value = hashFun(data)
      }else{
        node.value = data
      }
    }else{ 
      if (right.value==null){
        node.value = left.value
        node.left = left
      }else{
        node.left = left
        node.right = right
        node.value = hashFun(left.value+right.value)
      }
    }
    return node          
  }
  makeTree(data){
    let nodes = []
    if (data.length%2 != 0){
      data.push(data[data.length - 1])
    }
    for (let item of data){
      let node = this.addNode(null,null,item)
      nodes.push(node)
    }
    this.levels.push(nodes)
    while (nodes.length!=1){
      let newLevel = []
      for (let j=0 ; j < nodes.length;j+=2){
        let node
        if (j+1==nodes.length){ 
          node = this.addNode(nodes[j],new Leaf())
        }else{
          node = this.addNode(nodes[j],nodes[j+1])
        }
        newLevel.push(node)
      }
      nodes = newLevel
      this.levels.push(nodes)
    }
    this.root = nodes[0]
    return this.root
  } 
  getProof(index_target){
    let index
    if (typeof (index_target)=="string"){
      index = this.getIndex(index_targetH)
    }else{
      index = index_targetHash
    }
    if (!this.levels){
      return null
    }else if (index==null || index > this.levels[0].length-1 || index < 0){
      return null
    }else{
      let proof = []
      for (let x=0;x<this.levels.length;x++){
        let level_len = this.levels[x].length
        if ((index == level_len - 1) && (level_len % 2 == 1)){
          //skip if this is an odd end node
          index = Math.floor(index / 2)
          continue
        }
        let isRight = index % 2
        let siblingIndex = (isRight)? index - 1: index + 1
        let siblingPos =   (isRight) ? "left" : "right"
        let siblingValue = this.levels[x][siblingIndex].value
        let temp={}
        temp[siblingPos]=siblingValue
        proof.push(temp)
        index = Math.floor(index / 2)
      }
      return proof
    }
  }
  getIndex(str){
    if 
    let index=this.levels[0].map(x=>x.value).indexOf(hash)
    if(index==-1){
      return null
    }
    return index
  }
  validProof(proof, targetHash, merkleRoot){
    let hashFun = this.hashFun
    if (proof==null || proof.length == 0){
      return (targetHash == merkleRoot)
    }else{
      let proofHash = targetHash
      let sibling
      for (let p of proof){
        if (p['left']){
          //the sibling is a left node
          sibling = p['left']
          proofHash = hashFun(sibling + proofHash)
        }else{
          // the sibling is a right node
          sibling = p['right']
          proofHash = hashFun(proofHash + sibling)
        }
      }
      return proofHash == merkleRoot
    }
  }
}

console.log(process.argv)
if (process.argv[1]=="/njbc/merkle.js"){
  let t = new Tree("md5",true)
  let hashFun = t.hashFun
  t.makeTree(["123"])
  console.log("****","merkleRoot","****")
  console.log(t.root.value)
  //print("root:",t.root.value,
  //      "root.left:",t.root.left.value,
  //      "root.right:",t.root.right.value)
  console.log("****","merkleTree","****")
  for (let i=0 ;i<t.levels.length;i++){
    console.log(`level${i}:${t.levels[i].map(j=>j.value)}`)
  }
  let proof
  for (let index=0 ;index<t.levels[0].length;index++){
    console.log("****",`proof path of index ${index}`,"****")
    proof = t.getProof(index)
    proof.map(i=>{console.log(i)})
    console.log("****",`validProof of index${index}`,"****")
    console.log(t.validProof(proof,t.levels[0][index].value,t.root.value))
  }  

  let search="123"
  let value=hashFun(search)  
  let index = t.getIndex(value)
  console.log(`search ${search},getIndex:${index}`)
  proof = t.getProof(index)
  
  console.log("*****","validProof of ",search,"*****")
  console.log(`hash:${value} \n index:${index} \n proof path:${JSON.stringify(proof)} \ntotal levels:${t.levels.length}`)
  console.log(t.validProof(proof,value,t.root.value))
}