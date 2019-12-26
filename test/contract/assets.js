<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
     <title>健康记录</title>
</head>
<body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/json2html/1.2.0/json2html.min.js"></script>
 
<script>
  var t = {'<>':'div','html':'
      <h2 style="color:red">id:${data.id}</h2><table border=1><tr><th>体重</th><th>身高</th><th>timestamp</th></tr><tr><td>${data.weight}</td><td>${data.height}</td><td>${_timestamp}</td></tr></table>'};    
  var d=[合并后的文本]
  document.write( json2html.transform(d,t) );
</script>
</body>
</html>