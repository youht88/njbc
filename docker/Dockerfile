FROM arm32v6/node:10.13-alpine
#FROM arm32v7/node:10.13-stretch
#FROM node:10.13-alpine  
MAINTAINER youht

RUN apk add curl --no-cache
#RUN apk add nodejs nodejs-npm --no-cache
#ADD node /node
#ENV $PATH=$PATH:/node/bin
#RUN source

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
RUN npm install log4js --save
RUN npm install commander --save
RUN npm install cheerio async --save
RUN npm install request request-promise --save

RUN npm install react-bootstrap --save
RUN npm install node-dev -g 
RUN npm install vm2 --save-dev
RUN npm install deepmerge --save
RUN npm install base-x --save

WORKDIR /njbc
