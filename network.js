const utils=require('./utils.js')
const logger = utils.logger.getLogger()
const async = require('async')

const express = require('express')
const app = express();
const http = require('http');

const querystring = require('querystring');
const url  = require('url')

class Request{
  constructor(entryNode,me){
    this.urlEntryNode=new URL(entryNode)
    this.urlMe = new URL(me)
    this.entryNodes=[]
    this.clientNodes=[]
  }
  async get(path){
    return new Promise((resolve,reject)=>{
      var options = { 
          hostname: this.urlEntryNode.hostname, 
          port: this.urlEntryNode.port, 
          path: path, 
          method: 'GET',
      };
      var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode==200){
            resolve(rawData);
          }else{
            reject("<"+res.statusCode+">"+rawData);
          }
        });
      }); 
         
      req.on('error', function (e) { 
          reject('problem with request: ' + e.message); 
      }); 
         
      req.end();
    })
  }
/*  async broadcast(data){
    logger.debug(`服务端收到广播broadcast,${JSON.stringify(data)}`)
    if (this.socketioClient){
      this.socketioClient.emit('broadcast',data)
    }
    socket.broadcast.emit('broadcast',data)
    this.emitter.emit(data.type,data)
  }
*/
}

var entryNode = process.argv[2]
var me = process.argv[3]
var  request =new Request(entryNode,me)
app.set('port', 4000);

var server = http.Server(app).listen(app.get('port'), function() {
  console.log('start at port:' + server.address().port);
});

app.get("/node/list",function(req,res){
  res.end(JSON.stringify(request.urlEntryNode))
})

