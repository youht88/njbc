fs=require('fs')

class GF{
  constructor(g=3,p=123479){
    this.init(g,p)
    this.gf8={
    }
    //p=2^256 − 2^32 − 2^9 − 2^8 − 2^7 − 2^6 − 2^4 − 1
    this.curve={
      name:"secp256k1",
      a:0n,
      b:7n,
      p:0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
      g:{x:0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
         y:0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n},
      n:0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
      h:1n
    }
   /*
   this.curve={
     name:"test",
     a:4n,
     b:20n,
     p:29n,
     g:{x:13n,y:23n},
     n:37n
   }
   
   this.curve={
     name:"test1",
     a:16546484n,
     b:4548674875n,
     p:15424654874903n,
     g:{x:6478678675n,y:5636379357093n},
     n:null
   }
   */
  }
  curveInit(a,b,p,g,name){
    this.curve.name=name
    this.curve.a=BigInt(a)
    this.curve.b=BigInt(b)
    this.curve.p=BigInt(p)
    this.curve.g={x:BigInt(g.x),y:BigInt(g.y)}
    return this.curve
  }
  init(g,p){
    this.gn=BigInt(g)
    this.pn=BigInt(p)
  }
  E(x){
    let xn=BigInt(x)
    return (this.gn**xn)%this.pn
  }
  verify(sum,...e){
    let en=e.map(x=>BigInt(x))
    let sumn = BigInt(sum)
    let ep=en.reduce((x,y)=>x*y)%this.pn
    return (ep == this.E(sumn))
  }
  isPrime(d){
    let dn = BigInt(d) 
    let i=Math.floor(Math.sqrt(d))
    if (dn==2n || dn==3n || dn==5n) return true
    if (dn%2n==0) return false
    if (dn%6n!=1 && dn%6n!=5) {
      for (let j=3n;j<=9n;i++){
        if (dn%j==0){
          console.log(`${j}*${dn/j}=${dn}`)
          return false
        }
      }
    }
    for (let j=5n;j<=i;j+=6n){
      if (dn%j==0){
        console.log(`${j}*${dn/j}=${dn}`)
        return false
      }
      if (dn%(j+2n)==0){
        console.log(`${j+2n}*${dn/(j+2n)}=${dn}`)
        return false
      }
    }
    return true
  }
  mod(a,p=null){
    let a1,ax,ay
    let pn=this.curve.p
    if (p!=null)
      pn = BigInt(p)
    if (a instanceof Complex){
      ax = a.real>0 ? BigInt(a.real)%pn : pn-BigInt(-a.real)%pn
      ay = a.imag>0 ? BigInt(a.imag)%pn : pn-BigInt(-a.imag)%pn
      return new Complex(ax,ay)
    }
    a1 = a>0 ? BigInt(a)%pn : pn-BigInt(-a)%pn
    return a1
  }
  invmod(a,p=null){
    let a1
    let an = a>0?BigInt(a):BigInt(-a)
    let pn = this.curve.p
    if (p!=null)
      pn = BigInt(p)
    //a1=this.mod(an**(pn-2n),pn)
    a1=this.inv2(an,pn)
    return a<0 ? pn-a1 : a1 
  }
  add(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.add(b),p)
    }else if (b instanceof Complex){
      return this.mod(b.add(a),p)
    }
    return this.mod(BigInt(a)+BigInt(b),p||this.curve.p)
  }
  sub(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.sub(b),p)
    }
    return this.mod(BigInt(a)-BigInt(b),p||this.curve.p)
  }
  mul(a,b,p){
    if (a instanceof Complex){
      return this.mod(a.mul(b),p)
    }else if (b instanceof Complex){
      return this.mod(b.mul(a),p)
    }
    return this.mod(BigInt(a)*BigInt(b),p||this.curve.p)
  }
  div(a,b,p){
    return this.mod(BigInt(a)*this.invmod(b,p),p||this.curve.p)
  }
  subtract(a,b,p){return this.sub(a,b,p)}
  multiply(a,b,p){return this.mul(a,b,p)}
  divide(a,b,p)  {return this.div(a,b,p)}
  
  inv(a,p){//乘法逆元
    let inv=[]
    inv[1] = 1;
    for(let i=2;i<a;i++)
        inv[i]=(p-parseInt(p/i))*inv[p%i]%p;
        
    return inv
  }
  inv1(a,p){
    if(a==1) return 1
    return (p-parseInt(p/a))*(this.inv1(p%a,p))%p
  }
  inv2(a,p){
    a=BigInt(a)
    p=BigInt(p)
    let res=1n,base=a%p;
    let b=p-2n
    while(b)
    {
        if(b&1n)
          res=(base*res)%p;
        base=(base*base)%p;
        b>>=1n;
    }
    return res;
  }
  gcd(a,b){//求最大公约数
    let k=parseInt(a/b);
    let remainder = a%b;
    while (remainder !=0){
      a = b;
      b = remainder
      k = parseInt(a/b)
      remainder = a%b
    }
    return b
  }
  lcm(a,b){//求最小公倍数
    //Finds the least common multiple of a and b
  }
  curveNav(m,p){
    let x = BigInt(m.x)
    let y = BigInt(this.mod(-m.y,p))
    return {x:x,y:y}  
  }
  curveAdd(m,n,p){
    let lambda,x,y
    m.x=BigInt(m.x)
    m.y=BigInt(m.y)
    n.x=BigInt(n.x)
    n.y=BigInt(n.y)
    let pn=this.curve.p
    if (p!=null) pn=BigInt(p)
    if (m.x==n.x && m.y==n.y)
      //lambda = BigInt(this.mod(this.mod(3n*m.x**2n+this.curve.a,pn)*this.invmod(2n*m.y,pn),pn))
      lambda = this.div(this.add(3n*m.x**2n,this.curve.a,pn),2n*m.y,pn)
    else
      //lambda = BigInt(this.mod(this.mod(n.y - m.y,pn)*this.invmod(n.x - m.x,pn),pn))
      lambda = this.div(this.sub(n.y,m.y,pn),this.sub(n.x,m.x,pn),pn)
    //console.log("lambda:",lambda)
    x=this.mod(lambda**2n - m.x - n.x,pn)
    y=this.mod(lambda*(m.x-x)-m.y,pn)
    
    return {x:x,y:y}
  }
  curveSub(m,n,p){
    return this.curveAdd(m,this.curveNav(n,p))
  }
  curveMul(k,g,p,m1=null){
    let gn=this.curve.g
    if (g!=null) gn=g
    let pn = this.curve.p
    if (p!=null) pn=p
    let sign=1
    k=BigInt(k)
    if (k%2n==0) sign=0
    if (k==1n) return gn
    if (k>3n) {
      //console.log("=====>",k)
      let k0=k/2n
      m1 = this.curveMul(k0,gn,pn,m1)
    }
    if (!m1)
      m1=this.curveAdd(gn,gn,pn)
    else {
      m1=this.curveAdd(m1,m1,pn)
    }
    if (sign!=0)
      m1 = this.curveAdd(m1,gn,pn)
    //console.log(k,sign,m1)
    return m1
  }
  polyAdd(p1,p2){return p1^p2}
  polySub(p1,p2){return this.polyAdd(p1,p2)}
  polyMul(u,v) {
    let p = 0;
    for (let i = 0; i < 8; ++i) {
      if (u & 0x01) {
        p ^= v;
      }
      let flag = (v & 0x80);
      v <<= 1;
      if (flag) {
          v ^= 0x1B;  /* P(x) = x^8 + x^4 + x^3 + x + 1 */
      }
      u >>= 1;
    }
    return p;
  }
}
class circuitR1CS{
  constructor(){
    this.gates = []
    this.vars = set()
  }
  
}
/*
class CircuitGenerator:

    def __init__(self):
        self.gates = []
        self.vars = set()

    def _new_var(self, var):
        if var in self.vars:
            raise Exception("'{}' is already set!".format(var))
        self.vars.add(var)

    def mov(self, result, a):
        l = {'1': a} if type(a) is int else {a: 1}
        r = {'1': 1}
        o = {result: 1}
        self._new_var(result)
        self.gates.append((l, r, o))

    def mul(self, result, a, b):
        l = {'1': a} if type(a) is int else {a: 1}
        r = {'1': b} if type(b) is int else {b: 1}
        o = {result: 1}
        self._new_var(result)
        self.gates.append((l, r, o))

    def inv(self, result, a):
        l = {result: 1}
        r = {'1': a} if type(a) is int else {a: 1}
        o = {'1': 1}
        self._new_var(result)
        self.gates.append((l, r, o))

    def neg(self, result, a):
        self.mul(result, '-1', a)

    def add(self, result, a, b):
        if type(a) is int and type(b) is int:
            self.mov(result, a + b)
            return
        if a == b:
            self.mul(result, a, 2)
            return
        l = {'1': a} if type(a) is int else {a: 1}
        l.update({'1': b} if type(b) is int else {b: 1})
        r = {'1': 1}
        o = {result: 1}
        self._new_var(result)
        self.gates.append((l,r,o))

    def compile(self):
        syms = set()
        for gate in self.gates:
            for part in gate:
                syms.update(part.keys())
        syms = {sym: i for i,sym in enumerate(list(syms))}
        LRO = [[[0] * len(syms) for i in range(len(self.gates))] for i in range(3)]
        for i, gate in enumerate(self.gates):
            for j in range(3):
                for k,v in gate[j].items():
                    LRO[j][i][syms[k]] = v
                LRO[j][i] = Vector(LRO[j][i])
        return R1CSCircuit(syms, LRO[0], LRO[1], LRO[2])
*/
class Poly {
  constructor(a,dtype=Float32Array){
    this.c=a  
    this.coef=this.c
    this.o=this.c.length - 1
    this.order = this.o
    //自动判定复数
    if (Array.isArray(a) && (a[0] instanceof Complex)) dtype=Complex
    this.dtype=dtype
  }
  ensurePoly(p){if (!(p instanceof Poly)) throw new Error("参数必须是Poly对象")}
  add(p){
    this.ensurePoly(p);
    if (this.c==0) return p
    let x = [...this.c]
    let y = [...p.c]
    for (let i=0 ; i<Math.abs(x.length - y.length);i++){
      (x.length>y.length)?y.unshift(0):x.unshift(0)
    }
    if (this.dtype == Complex){
      return new Poly(x.map((v,i)=>v.add((y[i]!=undefined)?y[i]:0)))
    }
    return new Poly(x.map((v,i)=>v+(y[i]!=undefined)?y[i]:0))
  }
  sub(p){
    this.ensurePoly(p);
    if (this.c==0) return p
    let x = [...this.c]
    let y = [...p.c]
    for (let i=0 ; i<Math.abs(x.length - y.length);i++){
      (x.length>y.length)?y.unshift(0):x.unshift(0)
    }
    if (this.dtype == Complex){
      return new Poly(x.map((v,i)=>v.sub((y[i]!=undefined)?y[i]:0)))
    }
    return new Poly(x.map((v,i)=>v-((y[i]!=undefined)?y[i]:0)))
  }
  mul(p){
    if (this.c==0) return p
    if (typeof p=="number") {
      if (this.dtype==Complex){
        return new Poly(this.c.map(x=>x.mul(p)))
      }
      return new Poly(this.c.map(x=>x*p))
    }
    if (p instanceof Complex) {
      if (this.dtype==Complex){
        return new Poly(this.c.map(x=>x.mul(p)))
      }
      throw new Error("不支持非复数多项式与复数相乘")
    }
    let c1=this.c
    let c2=p.c
    let T=[]
    if (this.dtype == Complex){
      c1.map((x,i)=>c2.map((y,j)=>(T[i+j]!=undefined)?T[i+j]=T[i+j].add(x.mul(y)):T.push(x.mul(y))))
      return new Poly(T)
    }
    c1.map((x,i)=>c2.map((y,j)=>(T[i+j]!=undefined)?T[i+j]+=x*y:T.push(x*y)))
    return new Poly(T)
  }
  div(p){
    this.ensurePoly(p);
    if (this.c==0) return p
    let c1=[...this.c] 
    let c2=[...p.c]
    let c1l = c1.length
    let c2l = c2.length
    let r=[]
    let l=[]
    let ta,tb;
    ta=0;
    for(let i=0;i<c1l-c2l+1;i++){
      if (this.dtype == Complex){
        r[i]=c1[i].div(c2[0])
      }else{
        r[i]=c1[i]/c2[0];
      }
      tb=ta;
      for(let j=0;j<c2l;j++){
        if (this.dtype == Complex){
          c1[tb]=c1[tb].sub(r[i].mul(c2[j]))
        }else{
          c1[tb]-=r[i]*c2[j];
        }
        tb+=1;
      }
      ta+=1;
    }
    ta=0
    for(let i=0;i<c1.length;i++){
      if (this.dtype == Complex){
        if (!ta && Math.abs(c1[i].real)<=1e-05 && Math.abs(c1[i].imag)<=1e-05) continue
      }else{
        if (!ta && Math.abs(c1[i])<=1e-05) continue
      }
      l[ta]=c1[i];
      ta+=1
    }
    //{q:quotient,r:remainder}
    return {"q":new Poly(r),"r":new Poly(l)}
  }
  pow(n){
    if (n==0) return new Poly([1])
    let p=this
    for (let i=0;i<=n-2;i++){
      p=p.mul(p)
    }
    return p
  }
  val(a){
    if (Array.isArray(a)){
      if (this.dtype == Complex){
        return a.map(x=>this.c.map((v,i)=>
          v.mul((x instanceof Complex)?x.pow(this.o-i):x**(this.o-i))).reduce((m,n)=>m.add(n)))
      }
      return a.map(x=>this.c.map((v,i)=>v*x**(this.o-i)).reduce((m,n)=>m+n))
    }
    if (this.dtype == Complex){
      if (a instanceof Complex)
        return this.c.map((v,i)=>v.mul(a.pow(this.o-i))).reduce((m,n)=>m.add(n))
      return this.c.map((v,i)=>v.mul(a**(this.o-i))).reduce((m,n)=>m.add(n))
    }
    return this.c.map((v,i)=>v*a**(this.o-i)).reduce((m,n)=>m+n)
  } 
  deriv(){
    let c=this.c
    let p=c.length - 1
    if (this.dtype == Complex)
      return new Poly(this.c.map((x,i)=>x.mul(p-i)).slice(0,p))    
    return new Poly(this.c.map((x,i)=>x*(p-i)).slice(0,p))    
  }
  integ(){
   let c=this.c
   let p=c.length - 1
   let c1
   if (this.dtype==Complex){
     c1=this.c.map((x,i)=>x.div(p-i+1))
     c1.push(new Complex(0,0))
   }else{
     c1=this.c.map((x,i)=>x/(p-i+1))
     c1.push(0)
   }
   return new Poly(c1)
  }
  roots(){} 
  lagrange(points) {
    let p = [];
    for (let i=0; i<points.length; i++) {
      p[i] = new Poly([1,-points[i][0]]);
    }

    let sum = new Poly([]);
    for (let i=0; i<points.length; i++) {
      let mpol=new Poly([])
      let factor=1
      for (let j=0; j<points.length; j++){
        if (j==i) continue
        mpol = mpol.mul(p[j])
        factor = factor * (points[i][0]-points[j][0])
      }
      factor = points[i][1] / factor;
      mpol = mpol.mul(factor)
      //console.log(i,factor,points[i][1],mpol.c)
      sum = sum.add(mpol);
    }
    return sum;
  }
  toVector(){return new Vector(this.c)}
  toString(){
    if (this.dtype==Complex){
      return this.c.map((a,i)=>{
        let s1,s2
        if (a.real==0 && a.imag==0) return ''
        s1 = "+"+a.toString()
        s2 = (this.o-i>=2)?'x^'.concat(this.o - i):(this.o-i==1)?'x':''
        return s1+s2
        }).join("").slice(1)
    }
    return this.c.map((a,i)=>{
      let s1,s2
      if (a==0) return ''
      s1 = (a==1)?"+":((a==-1)?"-":((a>0)?"+"+a.toString():a.toString()))
      if (i==0 && a<0) s1="+"+s1
      s2 = (this.o-i>=2)?'x^'.concat(this.o - i):(this.o-i==1)?'x':''
      return s1+s2
      }).join("").slice(1)
  }
}

class Complex{
  constructor(r=0,j=0){
    if (typeof(r)!="number" || typeof(j)!="number") {
      console.log(r,j)
      throw new Error("复数定义不合法")
    }
    this.real = r
    this.imag = j
  }
  add(c){return new Complex(this.real+((c.real!=undefined)?c.real:c),this.imag+((c.imag!=undefined)?c.imag:0))}
  sub(c){return new Complex(this.real-((c.real!=undefined)?c.real:c),this.imag-((c.imag!=undefined)?c.imag:0))}
  mul(c){
    if (c instanceof Complex){
      return new Complex(this.real*c.real-this.imag*c.imag,
                         this.real*c.imag+this.imag*c.real)
    }
    return new Complex(this.real*c,this.imag*c)
  }
  div(c){
    if (c instanceof Complex){
      let dis=c.real**2+c.imag**2
      return new Complex((this.real*c.real+this.imag*c.imag)/dis,
                         (this.imag*c.real-this.real*c.imag)/dis)
    }
    return new Complex(this.real/c,this.imag/c)
  }
  pow(n){
    if (n==0) return new Complex(1,0)
    let p=this
    for (let i=0;i<=n-2;i++){
      p=p.mul(p)
    }
    return p
  }
  conjugate() { //求每个复数的共轭复数
    return new Complex(this.real,value.imag * -1);
  }

  magnitude() { //求每个复数到原点的长度,即模
    return Math.sqrt(this.real**2 + this.imag**2);
  }
  toString(){
    return "("+this.real+"+"+this.imag+"j)"
  }
}

class ArrayBase{
  constructor(data,dtype= Float32Array){
    if (data instanceof ArrayBase){
      this.dtype = data.dtype
      this.data = data.data
    }else{
      //自动判定复数
      if (Array.isArray(data) && (data[0] instanceof Complex)) dtype=Complex
      this.dtype = dtype
      this.data = this.ensureArray(data)
    }
    this.length = this.data.length
    this.shape = [this.length]
    this.T = this.data
    if (this.dtype == Complex){
      this.real = this.data.map(x=>x.real)
      this.imag = this.data.map(x=>x.imag)
    }else{
      this.real = this.data
      this.imag = new Float32Array(this.real.length)
    }
  }
  ensureArray(data){
    if (this.dtype == Complex){
      if (Array.isArray(data)){
        return data.map(x=>{
          if (x instanceof Complex) return x
          return new Complex(x)})
      }else{
        let c=[]
        for(let i=0;i<data;i++){
          c.push(new Complex())
        }
        return c
      }
    }else {
     return Array.isArray(data) && data || new this.dtype(data)
    }
  }
  cast(dtype){
    if (dtype != Complex){
      switch (dtype.toUpperCase()){
        case "INTEGER": dtype=Int32Array;break
        case "INT": dtype=Int32Array;break
        case "FLOAT"  : dtype=Float32Array;break;
        case "STRING" : dtype=String;break;      
        case "STR" : dtype=String;break;      
        case "BOOLEAN": dtype=Boolean;break;      
        case "BOOL": dtype=Boolean;break;      
      }
    }
    return new Vector(this.data.map(item=>{
      if (dtype == Complex)    return new Complex(item)
      if (dtype==Int32Array)   return parseInt(typeof(item)=="boolean"?(item?1:0):item)
      if (dtype==Float32Array) return parseFloat(typeof(item)=="boolean"?(item?1:0):item)
      if (dtype == String)         return String(item)      
      if (dtype == Boolean)        return Boolean(item)
      throw new Error("类型转换定义不合法")
    }),dtype)
  }
  // In-place mapper.
  map(mapper) {
    let value = this.data.map((value,i,n)=>mapper(value, i, n));
    this.data = value
    return this;
  }
  
  sin(){return new Vector(this.data.map(x=>Math.sin(x)))}
  cos(){return new Vector(this.data.map(x=>Math.cos(x)))}
  tan(){return new Vector(this.data.map(x=>Math.tan(x)))}
  asin(){return new Vector(this.data.map(x=>Math.asin(x)))}
  acos(){return new Vector(this.data.map(x=>Math.acos(x)))}
  atan(){return new Vector(this.data.map(x=>Math.atan(x)))}
  asinh(){return new Vector(this.data.map(x=>Math.asinh(x)))}
  acosh(){return new Vector(this.data.map(x=>Math.acosh(x)))}
  atanh(){return new Vector(this.data.map(x=>Math.atanh(x)))}
  sinh(){return new Vector(this.data.map(x=>Math.sinh(x)))}
  cosh(){return new Vector(this.data.map(x=>Math.cosh(x)))}
  tanh(){return new Vector(this.data.map(x=>Math.tanh(x)))}
  log(){return new Vector(this.data.map(x=>Math.log(x)))}
  log2(){return new Vector(this.data.map(x=>Math.log2(x)))}
  log10(){return new Vector(this.data.map(x=>Math.log10(x)))}
  exp(){return new Vector(this.data.map(x=>Math.exp(x)))}
  sqrt(){return new Vector(this.data.map(x=>Math.sqrt(x)))}
  square(){return new Vector(this.data.map(x=>Math.pow(x,2)))}
  pow(n){return new Vector(this.data.map(x=>Math.pow(x,n)))}
  around(n){return new Vector(this.data.map(x=>{
      let a=10**n
      return Math.round(x*a)/a
    }))
  }
  floor(){return new Vector(this.data.map(x=>Math.floor(x)))}
  ceil(){return new Vector(this.data.map(x=>Math.ceil(x)))}

  add(x){
    x=this.ensureValid(x)
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.add(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item+(x.data?x.data[idx]:x)),this.dtype)
  }
  subtract(x){
    x=this.ensureValid(x)
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.sub(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item-(x.data?x.data[idx]:x)),this.dtype)
  }
  multiply(x){
    x=this.ensureValid(x)
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.mul(x.data?x.data[idx]:x)),Complex)
    }else if (this.dtype == String){
      return new Vector(this.data.map((item,idx)=>Array(x + 1).join(item)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item*(x.data?x.data[idx]:x)))
  }
  divide(x){
    x=this.ensureValid(x)
    if (this.dtype == Complex){
      return new Vector(this.data.map((item,idx)=>item.div(x.data?x.data[idx]:x)),Complex)
    }
    return new Vector(this.data.map((item,idx)=>item/(x.data?x.data[idx]:x)))
  }
  power(x){    
    x=this.ensureValid(x);
    return new Vector(this.data.map((item,idx)=>item**(x.data?x.data[idx]:x)))
  }
  mod(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item%(x.data?x.data[idx]:x)))
  }
  
  sub(x){return this.subtract(x)}
  mul(x){return this.multiply(x)}
  div(x){return this.divide(x)}
  neg(){return this.mul(-1)}
  
  reciprocal(){return new Vector(this.data.map((item,idx)=>1/item))}
  sign(){return new Vector(this.data.map((item,idx)=>item>=0?1:-1))}

  gt(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item>(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  gte(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item>=(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  lt(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item<(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  lte(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item<=(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  eq(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item==(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  ne(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>item!=(x.data?x.data[idx]:x)?true:false),Boolean)
  }
  close(x){
    x=this.ensureValid(x)
    return new Vector(this.data.map((item,idx)=>{
        let data=(x.data?x.data[idx]:x)
        return Math.abs(item-data)<=(1e-05+1e-08*data)?true:false
      })
    ,Boolean)
  }
 
  sort(){return new Vector([...this.data].sort())}
  normal(N){
    if (N==undefined) N=[0,1]
    let [mu,sigma]=N
    return this.sub(this.mean()).div(this.std()).mul(sigma).add(mu)
  }
  sum(){return this.data.reduce((a,b)=>a+b)}
  min(){return this.data.reduce((a,b)=>a>b?b:a)}
  argmin(){return this.data.indexOf(this.min())}
  max(){return this.data.reduce((a,b)=>a<b?b:a)}
  argmax(){return this.data.indexOf(this.max())}
  mean(){return this.sum()/this.data.length}
  std(){return Math.sqrt(this.var())}
  var(){
    let mean = this.mean()
    return this.data.map(x=>(x-mean)**2).reduce((x,y)=>x+y)/this.data.length
  }
  cov(){
    let mean = this.mean()
    return this.data.map(x=>(x-mean)**2).reduce((x,y)=>x+y)/(this.data.length-1)
  }
  corrcoef(){
    return 1
  }
  ptp(){return this.max()-this.min()}
  median(){
    let length=parseInt(this.data.length/2)
    if (this.data.length%2!=0) return (this.data[length]+this.data[length-1])/2 
    return this.data[length]
  }
  percentile(p){}
  average(){}  
  
  allclose(x){return this.close(x).all()}
  all(){return this.data.reduce((a,b)=>a&&b)}
  any(){return this.data.reduce((a,b)=>a||b)}
  
  dot(x){
    x=this.ensureValid(x)
    return this.data.map((item,idx)=>item*(x.data?x.data[idx]:x)).reduce((i,j)=>i+j)
  }
  clip(m,n){
    return this.data.map(x=>{
      let a=m,b=n,c=x
      if (m==null) a=x
      if (n==null) b=x
      if (x<a) c=a
      if (x>b) c=b
      return c
    })
  }
  slice(p){
    let data=[]
    if (!Array.isArray(p)) p=[p]
    let [s,t,o]=p
    if (s==undefined) s=0
    if (s<0) s=this.length + s
    if (t==undefined) t=(s==0)?this.length:s+1
    if (t<0) t=this.length + t
    if (o==undefined) o=1
    for (let i=s;i<t;i+=o){
      data.push(this.data[i])
    }
    return new Vector(data)
  }
  take(p){
    if (!Array.isArray(p)) p=[p]
    return new Vector(p.map(n=>{
       if (n>this.length-1) throw new Error(`${n} 超过向量边界`)
       return this.data[n]
      }))
  }
  save(file){
    return fs.writeFileSync(file,this.data)
  }
  
  pad(s,mode="constant",v){
    if (!v) v=[0,0]
    if (typeof v == "number") v=[v,v]
    if (typeof s == "number") s=[s,s]
    let [x,y]=s
    let value
    let data=[]
    switch (mode){
      case "constant":
        value=0;break;
      case "mean":
        value=this.mean();break;
      case "maximum":
        value=this.max();break;
      case "minimum":
        value=this.min();break;
      default:
        value=0
    }
    for (let i=0;i<x;i++) data.push(mode=="constant"?v[0]:value)
    data=data.concat(this.data)
    for (let i=0;i<y;i++) data.push(mode=="constant"?v[1]:value)
    return new Vector(data)
  }
}
class Vector extends ArrayBase{
  ensureValid(a){
    if (typeof a =="number") return a
    a=np.ensureNdarray(a)
    if (np.shape(a).toString()!=np.shape(this).toString()) 
      throw new Error(`对象形状(${np.shape(this)})和(${np.shape(a)})不一致`)
    return a
  }
  reshape(r,c){
    if (!c && !r) r=1
    if (!c) c=Math.floor(this.data.length/r)
    if (!r) r=Math.floor(this.data.length/c)
    if ((r*c)!=this.data.length) throw new Error("转换长度不符合")
    let matrix=[]
    let T=[]
    for (let j=0;j<c;j++){
      T.push([])
    }
    for (let i=0 ;i<r;i++){
      let row=[]
      for (let j=0;j<c;j++){
        row.push(this.data[i*c+j])
        T[j].push(this.data[i*c+j])
      }
      matrix.push(row)
    }
    return new Matrix(matrix,this.dtype,{T:T})
  }
  toMatrix(r,c){return this.reshape(r,c)}
  toPoly(){return new Poly(this.data)}
  value(){return this.data}
  valueT(){return this.T}
  toString(){
    return this.data
  }
  print(){console.log(this.data)}
  __func(fun,args){
    return this.data.map(value=>fun(value,...args))
  }
  copy(){return new Vector(this.value(),this.dtype)}
      
  /*distance(x,y){
    if (!Array.isArray(x) || !Array.isArray(y)){
      throw new Error("有参数不是数组")
    }
    return this.norm(this.ds(x,y))
  }
  cosine(x,y){
    if (!Array.isArray(x) || !Array.isArray(y)){
      throw new Error("有参数不是数组")
    }
    return this.dp(x,y)/(this.norm(x)*this.norm(y))
  }
  */
}
class Matrix{
  //a=[1,2]
  //b=[[1,2],[3,4]]
  //c=[[[1,2],[3,4]],[[5,6],[7,8]]]
  constructor(data,dtype=Float32Array,args={}) {
    this.dtype = dtype
    this.data = data.map(m=>new Vector(m,this.dtype))
    this._row = data.length
    this._col = data[0].length
    this.size = this._row*this._col
    this.shape = [this._row,this._col]
    if (args.T){
      this.T = args.T.map(t=>new Vector(t,this.dtype))
    }else{
      let T=[]
      for (let j=0;j<this._col;j++){
        T.push([])
        for (let i=0 ;i<this._row;i++){
          if (data[i] instanceof Vector){
            T[j].push(data[i].data[j])
          }else{
            T[j].push(data[i][j])
          }
        }
      }
      this.T = T.map(t=>new Vector(t,this.dtype))
    }
  }
  reshape(r,c){
    return this.flatten().reshape(r,c)
  }
  cast(dtype){return new Matrix(this.data.map((item,idx)=>item.cast(dtype)),dtype)
  }
  ensureValid(a){
    if (typeof a =="number") return a
    a=np.ensureNdarray(a)
    if (np.shape(a).toString()!=np.shape(this).toString()) 
      throw new Error(`对象形状(${np.shape(this)})和(${np.shape(a)})不一致`)
    return a
  }
  ensureSquareMatrix(){
    if (this._row!=this._col) throw new Error("需要方阵才能执行后续操作")
  }
  flatten(){
    return new Vector(this.data.map(x=>x.data).reduce((x,y)=>x.concat(y)),this.dtype)
  }
  toVector(){return this.flatten()}
  value(){return [...this.data.map(item=>[...item.value()])]}
  valueT(){return [...this.T.map(item=>[...item.valueT()])]}
  print(){
   if (this.dtype == Complex){
     let str
     str=this.data.map(item=>JSON.stringify(item.data)).reduce((x,y)=>x+"\n"+y)
     console.log(`=====data:=====\n${str}`)
     str=this.T.map(item=>JSON.stringify(item.data)).reduce((x,y)=>x+"\n"+y)
     console.log(`=======T=======\n${str}`)
   }else{
     let str
     str=this.data.map(item=>item.toString()).reduce((x,y)=>x+"\n"+y)
     console.log(`=====data:=====\n${str}`)
     str=this.T.map(item=>item.toString()).reduce((x,y)=>x+"\n"+y)
     console.log(`=======T=======\n${str}`)
   }
  }
  slice(p,q){
    let data
    let matrix = new Matrix(this.T.map(x=>{
        let data=[]
        if (!Array.isArray(p)) p=[p]
        let [s,t,o]=p
        if (s==undefined) s=0
        if (s<0) s=x.data.length + s
        if (t==undefined) t=(s==0)?x.data.length:s+1
        if (t<0) t=x.data.length + t
        if (t>x.data.length) t=x.data.length
        if (o==undefined) o=1
        for (let i=s;i<t;i+=o){
          data.push(x.data[i])
        }
        return data
      }))
    data=matrix.T
    if (q!=undefined){
      matrix = new Matrix(matrix.T.map(x=>{
        let data=[]
        if (!Array.isArray(q)) q=[q]
        let [s,t,o]=q
        if (s==undefined) s=0
        if (s<0) s=x.data.length + s
        if (t==undefined) t=(s==0)?x.data.length:s+1
        if (t<0) t=x.data.length + t
        if (t>x.data.length) t=x.data.length
        if (o==undefined) o=1
        for (let i=s;i<t;i+=o){
          data.push(x.data[i])
        }
        return data
      }))
      data=matrix.data
    }
    return new Matrix(data)
  }
  row(m=0,n=0){
    if (m<0) m = this._row + m
    if (n<0) n = this._row + n
    if (n>this._row) n = this._row
    if (n<m) n=m
    let arr=[]
    for(let i=m ;i<n;i++){
      if (this.data[i])
        arr.push(this.data[i])
    }
    if (arr.length>0) 
     return new Matrix(arr,this.dtype)
    return null
  }
  col(m=0,n=0){
    if (m<0) m = this._col + m
    if (n<0) n = this._col + n
    if (n>this._col) n = this._col
    if (n<m) n=m
    let arr=[]
    for(let i=m ;i<n;i++){
      if (this.T[i])
        arr.push(this.T[i])
    }
    if (arr.length>0) 
     return new Matrix(arr,this.dtype).transpose()
    return null
  }

  copy(){return new Matrix(this.value(),this.dtype)}
  
  sin(){return new Matrix(this.data.map(x=>x.sin()))}
  cos(){return new Matrix(this.data.map(x=>x.cos()))}
  tan(){return new Matrix(this.data.map(x=>x.tan()))}
  asin(){return new Matrix(this.data.map(x=>x.asin()))}
  acos(){return new Matrix(this.data.map(x=>x.acos()))}
  atan(){return new Matrix(this.data.map(x=>x.atan()))}
  asinh(){return new Matrix(this.data.map(x=>x.asinh()))}
  acosh(){return new Matrix(this.data.map(x=>x.acosh()))}
  atanh(){return new Matrix(this.data.map(x=>x.atanh()))}
  sinh(){return new Matrix(this.data.map(x=>x.sinh()))}
  cosh(){return new Matrix(this.data.map(x=>x.cosh()))}
  tanh(){return new Matrix(this.data.map(x=>x.tanh()))}
  log(){return new Matrix(this.data.map(x=>x.log()))}
  log2(){return new Matrix(this.data.map(x=>x.log2()))}
  log10(){return new Matrix(this.data.map(x=>x.log10()))}
  exp(){return new Matrix(this.data.map(x=>x.exp()))}
  sqrt(){return new Matrix(this.data.map(x=>x.sqrt()))}
  square(){return new Matrix(this.data.map(x=>x.square()))}
  pow(n){return new Matrix(this.data.map(x=>x.pow(n)))}
  around(n){return new Matrix(this.data.map(x=>x.around(n)))}
  floor(){return new Matrix(this.data.map(x=>x.floor()))}
  ceil(){return new Matrix(this.data.map(x=>x.ceil()))}

  add(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.add(x.data?x.data[idx]:x)),this.dtype)}
  subtract(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.subtract(x.data?x.data[idx]:x)),this.dtype)}
  multiply(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.multiply(x.data?x.data[idx]:x)),this.dtype)}
  divide(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.divide(x.data?x.data[idx]:x)),this.dtype)}
  power(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.power(x.data?x.data[idx]:x)),this.dtype)}
  mod(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.mod(x.data?x.data[idx]:x)),this.dtype)}
  
  sub(x){return this.subtract(x)}
  mul(x){return this.multiply(x)}
  div(x){return this.divide(x)}
  neg(){return this.mul(-1)}
  
  reciprocal(){return new Matrix(this.data.map((item,idx)=>item.reciprocal()),this.dtype)}
  sign(){return new Matrix(this.data.map((item,idx)=>item.sign()),this.dtype)}
  
  gt(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.gt(x.data?x.data[idx]:x)),Boolean)}
  gte(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.gte(x.data?x.data[idx]:x)),Boolean)}
  lt(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.lt(x.data?x.data[idx]:x)),Boolean)}
  lte(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.lte(x.data?x.data[idx]:x)),Boolean)}
  eq(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.eq(x.data?x.data[idx]:x)),Boolean)}
  ne(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.ne(x.data?x.data[idx]:x)),Boolean)}
  close(x){x=this.ensureValid(x);return new Matrix(this.data.map((item,idx)=>item.close(x.data?x.data[idx]:x)),Boolean)}
  
  sort(axis=null){
    if (axis==null) return new Vector(this.flatten().sort())
    let matrix = new Matrix((axis==0?this.T:this.data).map(x=>x.sort()))
    if (axis==1) return matrix
    return matrix.transpose()
  }
  normal(axis=0,N){
    if (axis==3){
      if (N==undefined) N=[0,1]
      let [mu,sigma]=N
      let mu0= this.mean()
      let sigma0 = this.std()
      return new Matrix(this.data.map(x=>x.sub(mu0).div(sigma0).mul(sigma).add(mu)))
    }
    let matrix = new Matrix((axis==0?this.T:this.data).map(x=>x.normal(N)))
    if (axis==1) return matrix
    return matrix.transpose()
  }
  sum(axis=null){
    if (axis==null) return this.flatten().sum()
    return new Vector((axis==0?this.T:this.data).map(x=>x.sum()))
  }
  min(axis=null){
    if (axis==null) return this.flatten().min()
    return new Vector((axis==0?this.T:this.data).map(x=>x.min()))
  }
  argmin(axis=null){
    if (axis==null) return this.flatten().argmin()
    return new Vector((axis==0?this.T:this.data).map(x=>x.argmin()))
  }
  max(axis=null){
    if (axis==null) return this.flatten().max()
    return new Vector((axis==0?this.T:this.data).map(x=>x.max()))
  }
  argmax(axis=null){
    if (axis==null) return this.flatten().argmax()
    return new Vector((axis==0?this.T:this.data).map(x=>x.argmax()))
  }
  mean(axis=null){
    if (axis==null) return this.flatten().mean()
    return new Vector((axis==0?this.T:this.data).map(x=>x.mean()))
  }
  std(axis=null){
    if (axis==null) return this.flatten().std()
    return new Vector((axis==0?this.T:this.data).map(x=>x.std()))
  }
  var(axis=null){
    if (axis==null) return this.flatten().var()
    return new Vector((axis==0?this.T:this.data).map(x=>x.var()))
  }
  cov(){
    let r=[]
    let t=[]
    for (let i=0;i<this.data.length;i++){
      r[i]=this.data[i].sub(this.data[i].mean())
    }
    for(let i=0;i<this.data.length;i++){
      t[i]=this.data[i].cov()
    }
    let m=[] 
    for (let i=0;i<this.data.length;i++){
      m[i]=[]
      for(let j=0;j<this.data.length;j++){
        if (i<j){
          m[i].push(r[i].mul(r[j]).sum()/(r[i].length-1))
        }else if (i==j){
          m[i].push(t[i])
        }else{
          m[i].push(m[j][i])
        }
      }
    }
    return new Matrix(m)
  }
  corrcoef(){
    let cov = this.cov().value()
    let t=[]
    let m=[]
    for (let i=0;i<cov.length;i++){
      t[i]=[]
      for (let j=0;j<cov.length;j++){
        if (i<j){
          t[i][j] = Math.sqrt(cov[i][i]*cov[j][j])
        }
      }
    }
    for (let i=0;i<cov.length;i++){
      m[i]=[]
      for (let j=0;j<cov.length;j++){
        if (i<j){
          m[i].push(cov[i][j]/t[i][j])
        }else if (i==j){
          m[i].push(1)
        }else{
          m[i].push(m[j][i])
        }
      }
    }
    return new Matrix(m)
  }
  ptp(axis=null){
    if (axis==null) return this.flatten().ptp()
    return new Vector((axis==0?this.T:this.data).map(x=>x.ptp()))
  }
  median(axis=null){
    if (axis==null) return this.flatten().median()
    return new Vector((axis==0?this.T:this.data).map(x=>x.median()))
  }
  percentile(p,axis){
    if (axis==null) return this.flatten().percentile(p)
    return new Vector((axis==0?this.T:this.data).map(x=>x.percentile(p)))
  }
  average(axis){
    if (axis==null) return this.flatten().average()
    return new Vector((axis==0?this.T:this.data).map(x=>x.average()))
  }

  allclose(x){return this.close(x).all()}
  all(axis=null){
    if (axis==null) return this.flatten().all()
    return new Vector((axis==0?this.T:this.data).map(x=>x.all()))
  }
  any(axis=null){
    if (axis==null) return this.flatten().any()
    return new Vector((axis==0?this.T:this.data).map(x=>x.any()))
  }
  
  transpose(){
    return new Matrix(this.T,this.dtype,{T:this.data})
  }
  vstack(a){
    a=np.ensureMatrix(a)
    if (a.T.length!=this.T.length) 
      throw new Error(`矩阵(${np.shape(this)})和(${np.shape(a)})纵向合并，列数不符合要求`)
    let data=[...this.data]
    a.data.map(x=>data.push(x))
    return new Matrix(data,this.dtype)
  }
  hstack(a){
    a=np.ensureMatrix(a)
    if (a.length!=this.length) 
      throw new Error(`矩阵(${np.shape(this)})和(${np.shape(a)})横向合并，行数不符合要求`)
    return new Matrix(this.data.map((x,i)=>x.data.concat(a.data[i].data)),this.dtype)
  }
  split(m,axis=1){
    if (axis==1) return this.hsplit(m)
    if (axis==0) return this.vsplit(m)
    throw new Error("必须制定axis为0-纵向分割，1-横向分割,默认axis=1")
  }
  vsplit(m){
    let n=[]
    let matrix=[]
    if (typeof m =="number"){
      let range = this._row 
      let fromIndex=0
      let count = m
      for(let idx=0;idx<count;idx++){
        let end=Math.ceil(range * (idx+1) / count) - 1 + fromIndex
        let start =Math.ceil( range * idx / count) +1 - 1 + fromIndex
        //console.log(`${idx}:${start}-${end},有${end-start+1}个元素`)
        matrix.push(this.slice([start,end+1]))
       }
    }else{
      let start=0
      matrix=m.map(end=>{
        let temp = this.slice([start,end])
        start = end
        return temp
      })
      matrix.push(this.slice([start,this._row]))
    }
    return matrix
  }
  
  hsplit(m){
    let n=[]
    let matrix=[]
    if (typeof m =="number"){
      let range = this._col 
      let fromIndex=0
      let count = m
      for(let idx=0;idx<count;idx++){
        let end=Math.ceil(range * (idx+1) / count) - 1 + fromIndex
        let start =Math.ceil( range * idx / count) +1 - 1 + fromIndex
        //console.log(`${idx}:${start}-${end},有${end-start+1}个元素`)
        matrix.push(this.slice([],[start,end+1]))
       }
    }else{
      let start=0
      matrix=m.map(end=>{
        let temp = this.slice([],[start,end])
        start = end
        return temp
      })
      matrix.push(this.slice([],[start,this._col]))
    }
    return matrix  
  }

  dot(a){
    let b
    a=np.ensureMatrix(a)
    if (this._col==a._row){
      return new Matrix(this.data.map(x=>a.T.map(y=>y.dot(x))))
    }else if (a._row==1 && this._col==a._col){
      b = a.transpose()
      return new Matrix(this.data.map(x=>b.T.map(y=>y.dot(x))))
    }else{
      throw new Error(`矩阵(${np.shape(this)})和(${np.shape(a)})相乘，列数与行数不一致`)
    }
    //return a.T.map(x=>{
    //  return this.data.map(y=>y.dot(x))
    //})
  }
  lu(){//求三角阵
    let data = this.value()
    let row = this._row
    let col = this._col
    let s = (row < col)?row:col
    for (let k=0;k<s;k++){
      let x=1/data[k][k]
      for (let i=k+1;i<row;i++){
        data[i][k] = data[i][k] * x        
      }
      for (let i=k+1;i<row;i++){
        for (let j=k+1;j<col;j++){
          data[i][j] = data[i][j] - data[i][k]*data[k][j]
        }
      }
    }
    return new Matrix(data)
  }
  det(permute,lu=true){//行列式求值
    this.ensureSquareMatrix()
    if (lu) {  //lu分块分解快速计算det
      let x=1
      let m=this.lu()
      for (let i=0;i<m._row;i++){
        x=x*m.data[i].data[i]
      }    
      return x    
    }
    
    let data=this.value()
    switch (this._row){
      case 2:
        return data[0][0]*data[1][1] - data[0][1]*data[1][0]
      case 3:
        return data[0][0]*data[1][1]*data[2][2] +
               data[1][0]*data[2][1]*data[0][2] +
               data[2][0]*data[0][1]*data[1][2] -
               data[0][2]*data[1][1]*data[2][0] -
               data[1][2]*data[2][1]*data[0][0] -
               data[2][2]*data[0][1]*data[1][0]
      default:
        if (!permute){
          let argN=[]
          for(let i=0;i<this._row;i++){
            argN.push(i)
          }
          permute = np.permute(argN)
        }
        return permute.map(x=>{
          let invert = np.invertCount(x)
          return x.split("").map((y,i)=>data[i][y])
                            .reduce((x,y)=>x*y)*(-1)**invert
        }).reduce((x,y)=>x+y)
    }
  }
  adjoint(){ //伴随矩阵
    this.ensureSquareMatrix()
    let data=this.value()
    let arr=[]
    let det=[]
    let permute=[]
    switch (this._row){
      case 2:
        arr[0]=data[1][1]*(-1)**(1+1)
        arr[1]=data[0][1]*(-1)**(0+1)
        arr[2]=data[1][0]*(-1)**(1+0)
        arr[3]=data[0][0]*(-1)**(0+0)                                                 
        return np.array(arr).reshape(2,2)
      default:
        let temp=[]
        for(let i=0;i<this._row-1;i++){temp.push(i)}
        permute = np.permute(temp)
        for(let i=0;i<this._row;i++){
          let m = [...data]
          m.splice(i,1)
          for(let j=0;j<this._col;j++){
            let n = m.map(y=>{
              let yy=[...y]
              yy.splice(j,1);return yy
            })
           det.push(new Matrix(n).det(permute)*(-1)**(i+j))
           //console.log(i,j,n,det)
          }
        }
        return np.array(det).reshape(this._row,this._row).transpose()
    }
  }
  inv(){//求逆矩阵
    let det = this.det()
    if (det==0) throw new Error("矩阵det=0,该矩阵不存在可逆矩阵")
    return this.adjoint().divide(det)
  }
  solve(b){//行列式求值
    return this.inv().dot(b).value()
  }
  
  clip(m,n){
    return new Matrix(this.data.map((item)=>item.clip(m,n)))
  }
  
  take(p,axis=null){
    if (axis==null) return new Vector(this.flatten().take(p))
    let matrix = new Matrix((axis==0?this.T:this.data).map(x=>x.take(p)))
    if (axis==1) return matrix
    return matrix.transpose()
  }
  
  save(file){
    let data=this.value()
    let str = data.join(';')
    return fs.writeFileSync(file,str)
  }
  
  pad(s,mode="constant",v){
    if (typeof s=="number") s=[[s,s],[s,s]]
    if (typeof s[0]=="number") s[0]=[s[0],s[0]]
    if (typeof s[1]=="number") s[1]=[s[1],s[1]]
    if (!v) v=[0,0]
    if (typeof v=="number") v=[v,v]
    let value,value1
    switch (mode){
      case "constant":
        value=np.zeros(this._col);break;
      case "mean":
        value=this.mean(0);
        v=this.mean();
        break;
      case "maximum":
        value=this.max(0);
        v = this.max();
        break;
      case "minimum":
        value=this.min(0);
        v = this.min();
        break;
      default:
        value=np.zeros(this._col)
    }
    let f,d=[]
    let data=this.data
    f=value.pad([s[0][1],s[1][1]],"constant",v)
    for (let i=0;i<s[0][0];i++) d.push(f)
    d = d.concat(data.map(x=>x.pad([s[0][1],s[1][1]],mode,v)))
    for (let i=0;i<s[1][0];i++) d.push(f)

    return new Matrix(d)   
  }
}
  
class Numpy{
  constructor(){
    this.Complex = Complex
    this.fft = new FFT()
    this.nn = new NN()
    this.random = new Random()
  }
  Complex(r,j){
    let c=[]
    if (Array.isArray(r) && j==undefined){
      j=[]
    }
    if (Array.isArray(r) && Array.isArray(j)){
      if (r.length>=j.length){
        return r.map((x,i)=>new Complex(x,(j[i]=="undefined")?0:j[i]))    
      }else{
        return j.map((y,i)=>new Complex((r[i]=="undefined")?0:r[i],y))    
      }
    }
    return new Complex(r,j)
  }
  Vector(a,dtype){
    return new Vector(a,dtype)
  }
  Matrix(a,dtype){
    let ndim = this.ndim(a)
    if (ndim==1) 
      return new Matrix([a],dtype)
    return new Matrix(a,dtype)
  }
  cast(a,dtype){
    a=this.ensureNdarray(a);
    return a.cast(dtype)
  }
  ndim(a){
    if (a instanceof Vector) return 1
    if (a instanceof Matrix) return 2
    if (typeof a =="number") return 1
    if (!Array.isArray(a)) return 0
    let dim=0
    let b=[...a]
    while (Array.isArray(b)){
      dim++
      b=b[0]
    }
    return dim
  }
  arange(start,end,step,dtype){
    if (typeof end=="function"){
      dtype = end
      end = null
      step = null
    }
    if (!end) {
      end = start
      start = 0
    }
    if (!step) {
      step = 1
    }
    let arr=[]
    for (let i=start;i<end;i+=step){
      arr.push(i)
    }
    return this.array(arr,dtype)
  }
  linspace(start,end,num,dtype){
    if (typeof end == "function"){
      dtype = end
      num = start
      start = 0
      end = num
    }
    let step = (end - start ) / num
    let arr=[]
    for (let i=0;i<num;i++){
      arr.push(start)
      start +=step
    }
    return this.array(arr,dtype)
  }
  mat(str,dtype){
    let data=str.split(";")
    let arr = data.map(x=>x.replace(/\s+/g,",").split(",").map(x=>{
        let d=parseFloat(x)
        if (d!=NaN) return d
        return x
      }))
    if (arr.length==1) arr=arr[0]
    return this.array(arr,dtype)
  }
  __reset(value,dtype,shape=1,...args){
    let size=shape
    let arr=[]
    let r,c=0
    if (typeof shape!="number"){
      r=shape[0]
      c=shape[1]||1
      size = r*c
    }
    for (let i=0;i<size;i++){
      if (typeof value=="function"){
        if (dtype==Complex){
          arr.push(new Complex(value(i,args),value(i,args)))
        }else {
          arr.push(value(i,args))
        }
      }else{
        if (dtype==Complex){
          arr.push(new Complex(value))
        }else{
          arr.push(value)
        }
      }
    }
    if (size==shape){
      return this.array(arr,dtype)
    }else{
      return this.array(arr,dtype).reshape(r,c)
    }
  }
  zeros(shape=1,dtype){
    return this.__reset(0,dtype,shape)
  }
  ones(shape=1,dtype){
    return this.__reset(1,dtype,shape)
  }
  eye(number,dtype){//对角矩阵
    return this.__reset((i,args)=>{
        let n=args[0]
        return (i%n==parseInt(i/n))?1:0
      },dtype,new Array(number,number),number)
  }
  diag(array,dtype){//自定义对角阵
    let len=array.length
    return this.__reset((i,args)=>{
        let n=args[0].length
        return (i%n==parseInt(i/n))?args[0][i%n]:0
      },dtype,new Array(len,len),array)
  }
    
  array(data,dtype){
    dtype = dtype || Float32Array
    let ndim = this.ndim(data)
    if (ndim==1) { 
      return new Vector(data,dtype)
    }else if (ndim==2){
      return new Matrix(data,dtype)
    }else{
      throw new Error("不支持的数据维度")
    }
  }
  size(object){
    if (Array.isArray(object)) return object.length
    if (object instanceof Vector) return object.length
    if (object instanceof Matrix) return object.size
  }
  shape(object){
    if (Array.isArray(object)) return object.length
    if (object instanceof Vector) return [object.length]
    if (object instanceof Matrix) return [object._row,object._col]
  }
  
  invertCount(str){//计算字符串逆序个数
    let a = str.split("")
    let c=0
    while(a.length>1){
      let b=a.splice(0,1)[0]
      c+=a.map(x=>b>x?1:0).reduce((x,y)=>x+y)
    }
    return c
  }
  permute(arr){//求出数组元素的n!种组合
    let data=[]
    function inner(arr,s){
      let a=[...arr]
      a.map(x=>{
        if (a.length>1) return inner(a.filter(y=>y!=x),s+x)
        data.push(s+a[0])
      })
    }
    inner(arr,"")
    //console.log("permute:",arr.length,data.length)
    return data
 }

  __func(fun,object,...args){
    if (object instanceof Matrix)
      return new Matrix(object.data.map(a=>a.__func(fun,args)))
    return new Vector(object.__func(fun,args))
  }
  sin(object){return this.__func(Math.sin,this.ensureNdarray(object))}
  cos(object){return this.__func(Math.cos,this.ensureNdarray(object))}
  tan(object){return this.__func(Math.tan,this.ensureNdarray(object))}
  asin(object){return this.__func(Math.asin,this.ensureNdarray(object))}
  acos(object){return this.__func(Math.acos,this.ensureNdarray(object))}
  atan(object){return this.__func(Math.atan,this.ensureNdarray(object))}
  asinh(object){return this.__func(Math.asinh,this.ensureNdarray(object))}
  acosh(object){return this.__func(Math.acosh,this.ensureNdarray(object))}
  atanh(object){return this.__func(Math.atanh,this.ensureNdarray(object))}
  sinh(object){return this.__func(Math.sinh,this.ensureNdarray(object))}
  cosh(object){return this.__func(Math.cosh,this.ensureNdarray(object))}
  tanh(object){return this.__func(Math.tanh,this.ensureNdarray(object))}
  log(object){return this.__func(Math.log,this.ensureNdarray(object))}
  log2(object){return this.__func(Math.log2,this.ensureNdarray(object))}
  log10(object){return this.__func(Math.log10,this.ensureNdarray(object))}
  exp(object){return this.__func(Math.exp,this.ensureNdarray(object))}
  sqrt(object){return this.__func(Math.sqrt,this.ensureNdarray(object))}
  square(object){return this.__func((data)=>{
      return Math.pow(data,2)
    },this.ensureNdarray(object))}
  pow(object,n){return this.__func((data,n)=>{
      return Math.pow(data,n)
    },this.ensureNdarray(object),n)
  }
  around(object,n){return this.__func((data,n)=>{
      let a=10**n
      return Math.round(data*a)/a
    },this.ensureNdarray(object),n)
  }  
  floor(object){return this.__func(Math.floor,this.ensureNdarray(object))}
  ceil(object){return this.__func(Math.ceil,this.ensureNdarray(object))}
  
  ensureValid(a,b){
    let x=[]
    if (typeof b =="number"){
      a=this.ensureNdarray(a)
      return [a,b]
    }else if (typeof a=="number"){
      b=this.ensureNdarray(b)
      return [b,a]
    }else{
      x=this.ensureNdarray(a,b)
      if (this.shape(x[0]).toString()!=this.shape(x[1]).toString()) 
        throw new Error(`对象形状(${this.shape(x[0])})和(${this.shape(x[1])})不一致`)
      return x
    }
  }
  ensureNdarray(...a){
    let v=a.map(x=>{
      if (x instanceof Vector) {return x}
      if (x instanceof Matrix) {return x}
      if (x instanceof Poly)   {return x.toVector()}
      if (Array.isArray(x)) {return this.array(x)}
      throw new Error("对象要求是Vector、Matrix或者Array")
    })
    if (v.length==1) v=v[0]
    return v
  }
  ensureVector(...a){
    let v=a.map(x=>{
      if (x instanceof Vector) {return x}     
      if (x instanceof Matrix) {return x.flatten()}
      if (x instanceof Poly) { return x.toVector()}
      if (Array.isArray(x)) {return this.Vector(x)}
      throw new Error("对象要求是Vector、Matrix、Poly或者Array")
    })
    if (v.length==1) v=v[0]
    return v
  }
  ensureMatrix(...a){
    let v=a.map(x=>{
      if (x instanceof Vector) {return x.toMatrix()}     
      if (x instanceof Matrix) {return x}
      if (x instanceof Poly) { return x.toVector().toMatrix()}
      if (Array.isArray(x)) {return this.Matrix(x)}
      throw new Error("对象要求是Vector、Matrix、Poly或者Array")
    })
    if (v.length==1) v=v[0]
    return v
  }
  ensurePoly(...a){
    let v=a.map(x=>{
      if (x instanceof Vector) {return x.toPoly()}     
      if (x instanceof Matrix) {return x.toVector().toPoly()}
      if (x instanceof Poly) { return x}
      if (Array.isArray(x)) {return this.poly1d(x)}
      throw new Error("对象要求是Vector、Matrix、Poly或者Array")
    })
    if (v.length==1) v=v[0]
    return v
  }
  add(a,b){[a,b]=this.ensureValid(a,b);return a.add(b)}  
  subtract(a,b){[a,b]=this.ensureValid(a,b);return a.subtract(b)}
  multiply(a,b){[a,b]=this.ensureValid(a,b);return a.multiply(b)}
  divide(a,b){[a,b]=this.ensureValid(a,b);return a.divide(b)}
  power(a,b){[a,b]=this.ensureValid(a,b);return a.power(b)}
  mod(a,b){[a,b]=this.ensrueValid(a,b);return a.mod(b)}
  
  sub(a,b){return this.subtract(a,b)}
  mul(a,b){return this.multiply(a,b)}
  div(a,b){return this.divide(a,b)}
  neg(a){return this.mul(a,-1)}
  
  gt(a,b){[a,b]=this.ensureValid(a,b); return a.gt(b)}
  gte(a,b){[a,b]=this.ensureValid(a,b);return a.gte(b)}
  lt(a,b){[a,b]=this.ensureValid(a,b); return a.lt(b)}
  lte(a,b){[a,b]=this.ensureValid(a,b);return a.lte(b)}
  eq(a,b){[a,b]=this.ensureValid(a,b); return a.eq(b)}
  ne(a,b){[a,b]=this.ensureValid(a,b); return a.ne(b)}
  close(a,b){[a,b]=this.ensureValid(a,b); return a.close(b)}
  
  reciprocal(a){a=this.ensureNdarray(a);return a.reciprocal()}
  sign(a){a=this.ensureNdarray(a);return a.sign()}
  
  copy(a){a=this.ensureNdarray(a);return a.copy()}
  
  transpose(a){a=this.ensureMatrix(a);return a.transpose()}
  vstack(a,b){[a,b]=this.ensureMatrix(a,b);return a.vstack(b)}
  hstack(a,b){[a,b]=this.ensureMatrix(a,b);return a.hstack(b)}
  vsplit(a,m){a=this.ensureMatrix(a);return a.vsplit(m)}
  hsplit(a,m){a=this.ensureMatrix(a);return a.hsplit(m)}
  split(a,m,axis){a=this.ensureMatrix(a);return a.split(m,axis)}
  
  where(a,x,y){
    if (x==undefined && y==undefined){
      a=this.ensureNdarray(a).cast("boolean")
      if (a instanceof Matrix){
        let result1=[]
        a.data.map((t,i)=>np.where(t).map(s=>result1.push([i,s])))
        return result1
      }
      let result=[]
      a.data.map((t,i)=>{if (t) result.push(i)})
      return result
    }if (x!=undefined && y!=undefined){
      a=this.ensureNdarray(a).cast("boolean")
      if (a instanceof Matrix)
        return new Matrix(a.data.map(t=>np.where(t,x,y)),Float32Array)
      return new Vector(a.data.map(t=>t?x:y),Float32Array)
    }else{
      throw new Error("x,y必须同时提供，或同时为空")
    }
  }
  nonzero(a){a=this.ensureNdarray(a);return this.where(a.ne(0))}
  
  sort(x,axis){x=this.ensureNdarray(x);return x.sort(axis)}
  normal(x,axis,N){
    x=this.ensureNdarray(x);
    if (x instanceof Vector)
      return x.normal(axis)
    return x.normal(axis,N)
  }
  sum(x,axis){x=this.ensureNdarray(x);return x.sum(axis)}
  min(x,axis){x=this.ensureNdarray(x);return x.min(axis)}
  argmin(x,axis){x=this.ensureNdarray(x);return x.argmin(axis)}
  max(x,axis){x=this.ensureNdarray(x);return x.max(axis)}
  argmax(x,axis){x=this.ensureNdarray(x);return x.argmax(axis)}
  mean(x,axis){x=this.ensureNdarray(x);return x.mean(axis)}
  std(x,axis){x=this.ensureNdarray(x);return x.std(axis)}
  cov(x,axis){x=this.ensureNdarray(x);return x.cov(axis)}
  ptp(x,axis){x=this.ensureNdarray(x);return x.ptp(axis)}
  median(x,axis){x=this.ensureNdarray(x);return x.median(axis)}
  percentile(x,p,axis){x=this.ensureNdarray(x);return x.percentile(p,axis)}
  average(x,axis){x=this.ensureNdarray(x);return x.average(axis)}
    
  allclose(a,b){[a,b]=this.ensureValid(a,b);return a.allclose(b)}
  all(x,axis){x=this.ensureNdarray(x);return x.all(axis)}
  any(x,axis){x=this.ensureNdarray(x);return x.any(axis)}
  
  dot(a,b){
    [a,b]=this.ensureNdarray(a,b);return a.dot(b)
  }
  matmul(a,b){return this.dot(a,b)}
  
  det(a){a=this.ensureMatrix(a);return a.det()}
  inv(a){a=this.ensureMatrix(a);return a.inv()}
  solve(a,b){[a,b]=this.ensureMatrix(a,b);return a.solve(b)}
  
  clip(a,m,n){a=this.ensureMatrix(a);return a.clip(m,n)}
  
  poly1d(a){
    let b=a
    if (Array.isArray(a) && Array.isArray(a[0])){
      let p=new Poly([])
      return p.lagrange(a)
    }
    if (a instanceof Vector) b=a.data
    if (!Array.isArray(b)) throw new Error("无法生成多项式")
    return new Poly(b)
  }
  polyadd(p1,p2){[p1,p2]=this.ensurePoly(p1,p2);return p1.add(p2)}
  polysub(p1,p2){[p1,p2]=this.ensurePoly(p1,p2);return p1.sub(p2)}
  polymul(p1,p2){[p1,p2]=this.ensurePoly(p1,p2);return p1.mul(p2)}
  polydiv(p1,p2){[p1,p2]=this.ensurePoly(p1,p2);return p1.div(p2)}
  polyval(p,a){p=this.ensurePoly(p);return p.val(a)}
  deriv(p){p=this.ensurePoly(p);return p.deriv()}
  integ(p){p=this.ensurePoly(p);return p.integ()}
  roots(p){p=this.ensurePoly(p);return p.roots()}
  lagrange(points){return this.poly1d(points)}
  
  conv(p1,p2,mode='full'){return this.convolve(p1,p2,mode)}
  convolve(p1,p2,mode='full'){
    //向量卷积
    let px=this.poly1d(p1)
    let py=this.poly1d(p2)
    let pz=px.mul(py)
    let len=0,pos=0
    switch(mode){
      case 'same':
        len = (px.c.length>=py.c.length)?px.c.length:py.c.length
        pos = Math.floor(pz.c.length /2 - len/2)
        return this.array(pz.c.slice(pos,len+pos))
      case 'valid':
        len = Math.abs(px.c.length - py.c.length)+1
        pos = Math.floor(pz.c.length /2 - len/2)
        return this.array(pz.c.slice(pos,len+pos))
      default:
        return this.array(pz.c)
    }
  }
  correlate(p1,p2,mode='valid'){
    return this.conv(p1,p2.reverse(),mode)
  }
  cov(a,b){ //协方差
    let x=a
    if (b) {
      x=this.vstack(a,b)
    }
    return x.cov()
  }
  corrcoef(a,b){ //相关系数
    let x=a
    if (b) {
      x=this.vstack(a,b)
    }
    return x.corrcoef()    
  }
  /*
  cov(a,b){
    //协方差
    let ma = a.mean()
    let mb = b.mean()
    let mab = a.mul(b).mean()
    return mab-ma*mb
  }
  corrcoef(a,b){
    //相关系数
    return this.cov(a,b)/Math.sqrt(this.var(a)*this.var(b))
  }
  */
  fftConv(a,b){
    let n = a.length + b.length -1 
    let N = 2**(parseInt(Math.log2(n))+1)
    let numa=N-a.length
    let numb=N-b.length
    for(let i=0;i<numa;i++) a.unshift(0)
    for(let i=0;i<numb;i++) b.unshift(0)
    let A=this.array(this.fft.fft(a))
    let B=this.array(this.fft.fft(b))
    let C=A.mul(B)
    return this.fft.ifft(C.data)
  }
  slice(a,...k){
    a=this.ensureNdarray(a)
    if (a instanceof Vector) return a.slice(k[0])
    if (a instanceof Matrix) return a.slice(k[0],k[1])
  }
  
  take(a,p,axis){
    a=this.ensureNdarray(a)
    if (a instanceof Vector) return a.take(p)
    if (a instanceof Matrix) return a.take(p,axis)
  }
  
  save(file,a){
    a=this.ensureNdarray(a)
    return a.save(file)
  }
  load(file){
    let data=fs.readFileSync(file,"utf8")
    return this.mat(data)
  }
  
  pad(a,s,mode,v){a=this.ensureNdarray(a);return a.pad(s,mode,v)}
}

class Random{
  constructor(){
  }
  random(shape,dtype){//随机矩阵
    return this.dim.__reset((i,args)=>{
        return Math.random()
      },dtype,shape)
  }
  rand(shape,dtype){return this.random(shape,dtype)}
  randint(range,shape,dtype){
    //range may be a number or a array like as [m,n]
    return dim.__reset((i,args)=>{
        let range=args[0]
        if (typeof range=="number") range=[0,range]
        let [m,n]=range
        return parseInt(Math.random()*(n-m)+m)
      },dtype,shape,range)
  }
  randn(shape,dtype){//正态分布
    let v=dim.__reset((i,args)=>{
        return Math.random()
      },dtype,shape)
    return v.sub(v.mean()).div(v.std())
  }
  normal([mu,sigma],shape,dtype){//随机矩阵
    let v=this.randn(shape,dtype)
    return v.mul(sigma).add(mu)
  }
  choice(a,n){
    if (typeof a == "number") {
      let t=[]
      for (let i=0;i<a;i++) t.push(i);
      a=t 
    }
    a=dim.ensureVector(a)
    return this.shuffle(a.data).slice(0,n)
  }
  shuffle(aArr){
    var iLength = aArr.length,
      i = iLength,
      mTemp,
      iRandom;
    while(i--){
      if(i !== (iRandom = Math.floor(Math.random() * iLength))){
        mTemp = aArr[i];
        aArr[i] = aArr[iRandom];
        aArr[iRandom] = mTemp;
      }
    }
    return aArr;
  }
}
class FFT{
  rader(a){ // 二进制平摊反转置换 O(logn)  
    let len = a.length
    let j = len >>1
    for (let i = 1;i < len - 1;i++){
      if (i < j) {
        //swap(a[i], a[j]);
        let temp=a[i]
        a[i]=a[j]
        a[j]=temp
      }
      let k = len>>1;
      while (j >= k){
        j -= k;
        k>>=1;
      }
      if (j < k) j += k;
    }
    return a
  }
  fft(a,on=1){ //FFT:on=1; IFFT:on=-1
    a=this.padZero(a)
    a=this.rader(a);
    let len = a.length
    for (let h = 2;h <= len;h <<= 1){ //计算长度为h的DFT
      let wn = new Complex(Math.cos(-on * 2 * Math.PI / h), Math.sin(-on * 2 * Math.PI / h));//单位复根 e^(2*PI/m),用欧拉公式展开
      for (let j = 0;j < len;j += h){
        let w = new Complex(1, 0); //旋转因子
        for (let k = j;k < j + (h>>1);k++){
          let u = a[k];
          let t = w.mul(a[k + (h>>1)]);
          a[k] = u.add(t);   //蝴蝶合并操作
          a[k + (h>>1)] = u.sub(t);
          w = w.mul(wn);  //更新旋转因子
        }
      }
    }
    if (on == -1){ //如果是傅立叶逆变换
      for (let i = 0;i < len;i++){
        a[i].real /= len;
      }
    }
    return a
  }
  ifft(a){
    return this.fft(a,-1)
  }
  padZero(a){
    let len = 2** (parseInt(Math.log2(a.length - 1))+1)
    let num = len - a.length
    for (let i=0;i<num;i++){
      if (a[0] instanceof Complex){
        a.unshift(new Complex(0,0))
      }else{
        a.unshift(0)
      }
    }
    
    if (a[0] instanceof Complex)
      return a
    let b=new Numpy().Complex(a)
    return b
  }
  fftshift(){}
  ifftshift(){}
  fftfreq(){}
  //fft(a,n,axis=0){}
}

class NN{
  constructor(){
    this.random=new Random()
  }
  //Classification Function
  softmax(a){
    a=np.ensureVector(a);
    let exp = np.exp(a)
    let sum = exp.sum()
    return new Vector(a.data.map((x,i)=>exp.data[i]/sum))
  }
  crossEntropy(a,y){
    [a,y]=np.ensureNdarray(a,y)
    return np.mean(np.sum(
                    y.mul(np.log(a)).neg().add(
                      y.sub(1).mul(
                          np.log(a.neg().add(1))
                        )
                      )
                    )
                  )
  }

  //Activation Function
  relu(a){
    a=np.ensureNdarray(a);
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.relu(x)))
    return new Vector(a.data.map(x=>x<=0?0:x))
  }
  relu6(a){
    a=np.ensureNdarray(a);
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.relu6(x)))
    return new Vector(a.data.map(x=>x<=0?0:(x>6?6:x)))
  }
  softplus(a){
    a=np.ensureNdarray(a);
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.softplus(x)))
    return new Vector(a.data.map(x=>Math.log(Math.exp(x)+1)))
  }
  sigmoid(a){
    a=np.ensureNdarray(a);
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.sigmoid(x)))
    return new Vector(a.data.map(x=>1/(1+Math.exp(-x))))
  }
  tanh(a){
    a=np.ensureNdarray(a);
    //also equal tanh=sinhx/conhx=(Math.exp(x)-Math.exp(-x))/(Math.exp(x)+Math.exp(-x))
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.tanh(x)))
    return new Vector(a.data.map(x=>Math.tanh(x)))
  }
  tanhDeriv(a){
    a=np.ensureNdarray(a);
    return  a.tanh().square().neg().add(1)
  }
  sigmoidDeriv(a){
    a=np.ensureNdarray(a);
    return this.sigmoid(a).mul((this.sigmoid(a).neg().add(1)))
  }
  dropout(a,keep){
    a=np.ensureNdarray(a);
    if (keep<=0 || keep>1) throw new Error("keep_prob参数必须属于(0,1]")
    if (a instanceof Matrix)
      return new Matrix(a.data.map(x=>np.nn.dropout(x,keep)))
    let remain=a.length*keep
    let arr=[]
    for (let i=0;i<a.length;i++) arr.push(i)
    arr = this.random.shuffle(arr)
    arr = arr.slice(0,remain)
    return new Vector(a.data.map((x,i)=>(arr.indexOf(i)>=0)?x/keep:0))
  }
  
  //Pool Function
  maxPool(a){}
  avgPool(a){}
  meanPool(a){}
 
  //Loss Function
  MSE(a,y){
    //also named L2
    [a,y]=np.ensureNdarray(a,y)
    return np.square(a.sub(y)).mean()*0.5
  }
  logcosh(a,y){
    [a,y]=np.ensureNdarray(a,y)
    return np.log(np.cosh(a.sub(y))).sum()
  }

  //cnn function
  conv2d(input, filter, strides, padding){
  
  }
  
}

class V{
  constructor(object){
    this.data=object
    this.ndim=this.getNdim()
    this.shape=this.getShape()
    this.size=this.shape.reduce((a,b)=>a*b)
    this.T=this.getT()
  }
  getNdim(){
    let i=0
    let a=this.data
    while (Array.isArray(a)){
      i++
      a=a[0].data?a[0].data:a[0]
    }
    return i
  }
  getShape(){
    let shape=[]
    let data=this.data
    for (let i=0;i<this.ndim;i++){
      shape.push(data.length)
      data=data[0].data
    }
    return shape
  }
  getT(){}
  value(){
    return this.data.map((x,i)=>(x instanceof V)?x.value():x)
  }
  ensureSameShape(a){
    if (this.shape!=a.shape) throw new Error(`形状(${this.shape})与形状(${a.shape})不一致`)
  }
  flatten(item){
    if (!item) item=[]
    this.data.map((x,i)=>(x instanceof V)?x.flatten(item):item.push(x))
    //console.log(item)
    return new Vector(item)
  }
  reshape(...d){
    if (Array.isArray(d[0])) d=d[0]
    let a=this.flatten().data
    let t,p=[],plen=0
    plen=d[d.length - 1]
    if (this.size%plen!=0) 
      throw new Error(`尺寸为(${this.size})的数组无法匹配形状(${d})`)
    for (let i=0;i<this.size;i+=plen){
      p.push(a.slice(i,i+plen))
    }
    t=p
    let size = this.size / plen
    for (let i=d.length - 2 ;i>0;i--){
      if (size%d[i]!=0) throw new Error(`尺寸为(${this.size})的数组无法匹配形状(${d})`)
      size = size/d[i]
      t=[]
      for (let j=0;j<size;j++){
        t.push(p.slice(j*d[i],j*d[i]+d[i]))
      }
      p=[...t]
    }
    if (size!=d[0]) throw new Error(`尺寸为(${this.size})的数组无法匹配形状(${d})`)
    return dim.ensureVector(t)
  }
  transpose(axes){}
  add(a){
    this.ensureSameShape(a)
    return new V(this.data.map((x,i)=>(x instanceof V)?x.add(a.data[i]):x+a.data[i]))
    /*
      let data=this.data.map((x,i)=>{
        if (x instanceof A) return x.add(a.data[i])
        return x+a.data[i]
      })
      return new A(data)
    */
  }
  sub(a){
    this.ensureSameShape(a)
    return new V(this.data.map((x,i)=>(x instanceof V)?x.sub(a.data[i]):x-a.data[i]))
  }
  sin(){
    return new V(this.data.map((x,i)=>(x instanceof V)?x.sin():Math.sin(x)))
  }
  pow(n){
    return new V(this.data.map((x,i)=>(x instanceof V)?x.pow(n):Math.pow(x,n)))
  }
  sum(axis=null){
    return this.data.map((x,i)=>(x instanceof V)?x.sum():x).reduce((a,b)=>a+b)
  }
}
class Dim{
  constructor(){
    this.Vector = V
    this.random = new Random()
  }
  ensureVector(a,dtype){
    if (a instanceof this.Vector) return a
    if (Array.isArray(a)) {
      if (Array.isArray(a[0])){
        return new this.Vector(a.map(x=>this.ensureVector(x)))
      }else {
        return new this.Vector(a)
      }
    }
    if (typeof a=="number") {
      let r=[]
      for (let i=0;i<a;i++) r.push(0)
      return new this.Vector(r)
    }
  }
  array(a,dtype){return this.ensureVector(a,dtype)}
  arange(start,end,step,dtype){
    if (typeof end=="function"){
      dtype = end
      end = null
      step = null
    }
    if (!end) {
      end = start
      start = 0
    }
    if (!step) {
      step = 1
    }
    let arr=[]
    for (let i=start;i<end;i+=step){
      arr.push(i)
    }
    return this.array(arr,dtype)
  }
  linspace(start,end,num,dtype){
    if (typeof end == "function"){
      dtype = end
      num = start
      start = 0
      end = num
    }
    let step = (end - start ) / num
    let arr=[]
    for (let i=0;i<num;i++){
      arr.push(start)
      start +=step
    }
    return this.array(arr,dtype)
  }
  mat(str,dtype){
    let data=str.split(";")
    let arr = data.map(x=>x.replace(/\s+/g,",").split(",").map(x=>{
        let d=parseFloat(x)
        if (d!=NaN) return d
        return x
      }))
    if (arr.length==1) arr=arr[0]
    return this.array(arr,dtype)
  }
  __reset(value,dtype,shape=1,...args){
    let arr=[]
    if (typeof shape=="number") shape=[shape,shape]
    let size=shape.reduce((a,b)=>a*b)
    for (let i=0;i<size;i++){
      if (typeof value=="function"){
        if (dtype==Complex){
          arr.push(new Complex(value(i,args),value(i,args)))
        }else {
          arr.push(value(i,args))
        }
      }else{
        if (dtype==Complex){
          arr.push(new Complex(value))
        }else{
          arr.push(value)
        }
      }
    }
    return this.array(arr,dtype).reshape(shape)
  }
  zeros(shape=1,dtype){
    return this.__reset(0,dtype,shape)
  }
  ones(shape=1,dtype){
    return this.__reset(1,dtype,shape)
  }
  eye(number,dtype){//对角矩阵
    return this.__reset((i,args)=>{
        let n=args[0]
        return (i%n==parseInt(i/n))?1:0
      },dtype,number,number)
  }
  diag(array,dtype){//自定义对角阵
    let len=array.length
    return this.__reset((i,args)=>{
        let n=args[0].length
        return (i%n==parseInt(i/n))?args[0][i%n]:0
      },dtype,len,array)
  }

}
exports.dim = new Dim()

exports.gf      = new GF()
exports.np      = new Numpy()
exports.Complex = Complex
exports.Poly    = Poly
exports.Vector  = Vector
exports.Matrix = Matrix