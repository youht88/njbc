cd /njbc/static/
/node_modules/.bin/webpack-dev-server &
cd /njbc
node miner.js --me imac1_njbc.youht.cc:8084 \
              --httpServer imac1_njbc.youht.cc:8084 \
              --entryNode imac1_njbc.youht.cc:8084  \
              --entryKad imac1_njbc.youht.cc:3000  \
              --db mongo:27017/njbc1 