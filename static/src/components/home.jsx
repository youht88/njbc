import React from 'react';
import {Table,Form, Input, Button,Divider,Tag,Icon,message,notification,Alert } from 'antd';
import {Link} from 'react-router-dom';
import moment from 'moment';

import TxForm from './txForm.jsx';
import MyEcharts from './echarts.jsx';


const FormItem = Form.Item;
const Search = Input.Search;
const {TextArea} = Input

function handleAjax(method,url,path,data,cb=null){
  return new Promise((resolve,reject)=>{
    if (typeof data=="function")
      cb = data
    $.ajax({
      type: method,    // 请求方式
      data:data,
      url: `http://${url}/${path}`,
      success: (res, status, jqXHR)=> {
        if (cb){
          cb(res)
          resolve()
        }else
          return resolve(res)
      },
      error: (res,status,error)=>{
        // 控制台查看响应文本，排查错误
        message.error(`http://${url}/${path}错误，请输入正确的地址`);
        reject(new Error("error"))
      }
    })
  })
}  

class BlockList extends React.Component{
  constructor(props) {
    super(props);
    const columns = [{
      title: '高度',
      dataIndex: 'index',
      key: 'index',
    },{
      title: 'Hash',
      dataIndex: 'hash',
      key: 'hash',
      render: text => <Link to={`/block/${text}`}>{text.substr(0,6)+'...'}</Link>,
    },{
      title: '交易数',
      dataIndex: 'txCnt',
      key: 'txCnt',
    },{
      title: '金额',
      dataIndex: 'txAmount',
      key: 'txAmount',
    },{
      title: '矿工',
      dataIndex: 'miner',
      key: 'miner',
      render: text => <Link to={`/wallet/${text}`}><Tag color={'#'+new Buffer(text,"base64").toString("hex").substr(0,6)}>{text.substr(0,6)+'...'}</Tag></Link>,
    },{
      title: <Icon type="clock-circle" style={{ fontSize: 16, color: '#08c' }} />,
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: text => <Tag color="#2a4">{moment(text,"x").fromNow()}</Tag>,
    }];
    this.state={columns}
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.maxindex>=0){
      let from,to
      to=nextProps.maxindex
      from = (to - 9)>=0 ? (to-9) : 0 
      console.log(from.toString()+","+to.toString())
      this.handleAjax(`blockchain/${from}/${to}`,
        (value)=>{
          this.setState({blocks:value})
          this.handleData(value)        
        })
    }
  }
  handleAjax(path,cb){
    $.ajax({
      type: 'GET',    // 请求方式
      url: `http://${this.props.url}/${path}`,
      success: (res, status, jqXHR)=> {
        cb(res)
      },
      error: (res,status,error)=>{
        notification.error(
          {message:"出现错误",
           description:`http://${this.props.url}/${path}错误,请输入正确的地址`
          });
      }
    })
  }
  
  handleData(value){
    let data=[]
    for(var i=value.length-1;i>=0;i--){
      //txAmount
      let txAmount=0
      for(var j=0;j<value[i].data.length;j++){
        const outs=value[i].data[j].outs
        //for(var k=0;k<outs.length;k++){
        //  txAmount += outs[k].amount
        //}
        txAmount += outs[0].amount
      }
      //miner
      const miner = value[i].data[0].outs[0].outAddr
      data.push({
        "key":value[i].index,
        "index":value[i].index,
        "hash" :value[i].hash,
        "txCnt":value[i].data.length,
        "txAmount":txAmount,
        "miner":miner,
        "timestamp":value[i].timestamp
      })
    }
    this.setState({data})
  }
  render(){
    const {data,columns} = this.state
    return(
      <div>
        <Divider orientation="left"><h1>最近的十条交易</h1></Divider>
        <h2><Link to='/blockchain'>更多...</Link></h2>
        <Table dataSource={data} columns={columns}/>
      </div>
    )
  }
}
class TradeForm extends React.Component{
  constructor(props) {
    super(props);
    this.state={data:undefined,errText:null}
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleAjax = this.handleAjax.bind(this)
  }
  componentDidMount() {
  }
  handleAjax(path,data,cb){
    $.ajax({
      type: 'POST',    // 请求方式
      data:data,
      url: `http://${this.props.url}/${path}`,
      success: (res, status, jqXHR)=> {
        cb(res)
      },
      error: (res,status,error)=>{
        // 控制台查看响应文本，排查错误
        message.error(`http://${this.props.url}/${path}错误，请输入正确的地址`);
      }
    })
  }  
  handleCheck(e){
    e.preventDefault();
    this.props.form.validateFields((err,values)=>{
      if(err){
        message.error("新交易表单输入错误！")
        return false
      }
      if (!values.outAddr && !values.script) {
        message.error("输出地址和合约脚本不能同时为空！")
        return false
      }if (values.outAddr && values.script) {
        message.error("不能同时定义输出地址和合约脚本！")
        return false
      }if (values.assets){
        try{
          JSON.parse(values.assets)
        }catch(error){
          this.setState({errText:"数据必须是数字或合法的json对象"})
          return false
        }
      }
      if (values.script){
        this.handleAjax('run/script',{inAddr:values.inAddr,script:values.script},
           (data)=>{
              if (data.errCode==0){
                this.setState({errText:`The result is \n${JSON.stringify(data.result)}`})
                message.success("Check right.")
              }else
                this.setState({errText:data.errText})                
           }
        )
      }else{
        this.setState({errText:""})
        message.success("check right.")
      }
    })
  }
  handleSubmit(e){
    e.preventDefault();
    this.props.form.validateFields((err,values)=>{
      if(err){
        message.error("新交易表单输入错误！")
        return
      }
      //message.warn(`trade/${values.inAddr}/${values.outAddr}/${values.amount}`)
      this.setState({data:null})
      this.handleAjax("trade",{
            inAddr:values.inAddr,
            outAddr:values.outAddr,
            amount:values.amount,
            script:values.script,
            assets:values.assets},
        (value)=>{
           if (typeof(value)=="object"){
             if (value.errCode==0)
               this.setState({errText:'',data:value.result})
             else
               this.setState({errText:value.errText,data:null})
           }  
           else {
             //not have enough money
             this.setState({data:null})
             message.error(value)
           }
        }
      )
    });
        
  }
  render(){
    const { getFieldDecorator} = this.props.form;
    return(
     <div>
      <Divider orientation="left"><h1>发起新的交易</h1></Divider>
      <div>
        <Form>
          <FormItem
            label="钱包地址"
          >
            {getFieldDecorator('inAddr', {
            rules: [
              {required: true, message: 'Please input inAddr'}],
          })(
            <Input placeholder="input inAddr" />
          )}
          </FormItem>
          <FormItem
            label="转入地址"
          >
            {getFieldDecorator('outAddr', {
              rules: [
               {required: false, message: 'Please input outAddr' }],
            })(
              <Input placeholder="input outAddr" />
            )}
          </FormItem>
          <FormItem
            label="金额"
          >
            {getFieldDecorator('amount', {
              rules: [
               {required: true, message: 'Please input amount' }],
            })(
              <Input placeholder="input amount" />
            )}
          </FormItem>
          <FormItem
            label="数据"
          >
            {getFieldDecorator('assets', {
              rules: [
               {required: false, message: 'Please input assets' }],
            })(
              <TextArea rows={10} placeholder="input data assets" style={{color:"yellow",fontWeight:"bold",backgroundColor:'blue'}} />
            )}
          </FormItem>
          <FormItem
            label="合约"
          >
            {getFieldDecorator('script', {
              rules: [
               {required: false, message: 'Please input script' }],
            })(
              <TextArea rows={10} placeholder="input script" style={{color:"lime",fontWeight:"bold",backgroundColor:'black'}} />
            )}
          </FormItem>
          <FormItem >
            <Button type="primary" onClick={this.handleCheck.bind(this)} style={{margin:10}}>检查+执行</Button>
            <Button type="primary" onClick={this.handleSubmit} style={{margin:10}}>提交+部署</Button>
          </FormItem>
        </Form>
      </div>
      {this.state.errText ? <Alert type="error" message={<div style={{overflow:"auto"}}>{this.state.errText}</div>}></Alert> :null}
      {this.state.data ? <TxForm data={this.state.data} idx={0}/> : null}
     </div>
    );
   }
}
const WrappedTradeForm = Form.create()(TradeForm)

class OneSearch extends React.Component{
  constructor(props) {
    super(props);
  }
  render(){
    const { getFieldDecorator} = this.props.form;
    return(
     <div>
       <Divider orientation="left"><h1>统一检索</h1></Divider>
       <div>
        <Form layout="inline">
          <FormItem
            label="地址"
          >
            {getFieldDecorator('inAddr', {
            rules: [
              {required: true, message: 'Please a Hash'}],
          })(
            <Input placeholder="input Any Hash" style={{width:"300px"}}/>
          )}
          </FormItem>
          <FormItem >
            <Button type="primary" onClick={this.handleSubmit}>检索</Button>
          </FormItem>
        </Form>
       </div>
     </div>
    )
  }
}
const WrappedOneSearch = Form.create()(OneSearch)

class GraphForm extends React.Component{
  constructor(props) {
    super(props);
    /* the key mast be name,value 
    const data1 = [
            {name: "JavaScript",value:2},
            {name: "Java",value:1},
            {name: "HTML/CSS",value:3}
          ]
    const data2 = [
            {name: "JavaScript",value:3},
            {name: "Java",value:2},
            {name: "HTML/CSS",value:1}
          ]
    */
    this.series1={
            type:"line",
            markPoint:
             {data:[{type:"max",name:"最大值"}]}
          }
    this.state={data1:[],data2:[]}

  }
  componentDidMount(){
    Promise.all([
      handleAjax("get",this.props.url,"aggregate/account_pie"),
      handleAjax("get",this.props.url,"aggregate/blocks_per_hour_bar")
    ]).then((result)=>{
           this.setState({data1:result[0],data2:result[1]})
         })
      .catch((error)=>alert("error"))
    
  }
  render(){
    const size={width:"600px",height:"400px"}
    return(
     <div>
      <Divider orientation="left"><h1>趋势与图表</h1></Divider>
      <MyEcharts type={"pie"} title={"账户金额"} data={this.state.data1} size={size}/>
      <MyEcharts type={"line"} title={"每小时出块"} data={this.state.data2} size={size}/>
     </div>
    )
  }
}

export default class Home extends React.Component{
  constructor(props) {
    super(props);
    const port=location.port=='7777'?4000:location.port
    this.state ={url:document.domain + ':' + port}
    this.handleAjax = this.handleAjax.bind(this)
  }
  handleAjax(url,path,cb){
    $.ajax({
      type: 'get',    // 请求方式
      url: `http://${url}/${path}`,
      success: (res, status, jqXHR)=> {
        cb(res)
      },
      error: (res,status,error)=>{
        // 控制台查看响应文本，排查错误
        message.error(`http://${url}/${path}错误，请输入正确的地址`);
      }
    })
  }  
  componentDidMount() {
    this.handleAjax(this.state.url,'blockchain/maxindex',
      (value)=>{
        this.setState({maxindex:value})
        notification.success(
          {message:"信息",
           description:`目前区块高度${value}`
           });
      })
  }
    render(){
      const {url,maxindex} = this.state
      return(
         <div>
           <BlockList maxindex={maxindex} url={url}/>
           <WrappedTradeForm url={url}/>
           <WrappedOneSearch url={url}/>
           <GraphForm url={url}/> 
         </div>
       )
     }
}
