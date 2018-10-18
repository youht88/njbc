FROM alpine 
MAINTAINER youht

RUN apk add curl --no-cache
RUN apk add nodejs nodejs-npm --no-cache

RUN npm config set registry https://registry.npm.taobao.org
RUN npm init --yes
RUN npm install webpack webpack-cli --save-dev
RUN npm install webpack-dev-server  --save-dev

RUN npm install react react-dom --save
RUN npm install react-router react-router-dom --save
RUN npm install redux react-redux --save

RUN npm install react-hot-loader --save-dev

RUN npm install style-loader css-loader url-loader --save-dev
RUN npm install html-webpack-plugin html-loader --save-dev
RUN npm install babel-core babel-preset-env babel-preset-react --save-dev
RUN npm install babel-loader@7 --save-dev
RUN npm install babel-plugin-import --save-dev

RUN npm install antd --save
RUN npm install echarts --save

RUN echo {presets:[\'env\',\'react\']} > .babelrc

#some
RUN npm install jquery underscore moment --save
RUN npm install socket.io socket.io-client --save
RUN npm install express body-parse --save 
RUN npm install mongodb --save
RUN npm install node-rsa --save
RUN npm install log4js --save
RUN npm install commander --save
RUN npm install cheerio async --save
RUN npm install request request-promise --save
#supervisor
RUN apk add supervisor --no-cache
RUN mkdir /etc/supervisor.d
RUN echo  [program:njbc]                 > /etc/supervisor.d/njbc.ini
RUN echo  command = /njbc/node miner.js >> /etc/supervisor.d/njbc.ini
RUN echo  directory = /njbc/            >> /etc/supervisor.d/njbc.ini

RUN npm install react-bootstrap --save

WORKDIR /njbc
