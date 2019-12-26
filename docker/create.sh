
#docker run -dit --name njbc -p 4000:4000 -p 3000:3000 --network overlay_mynet -v /opt/source/nodejs/njbc:/njbc 192.168.31.119:7000/arm/njbc:v5

docker run -dit --name node1 -p 34041:4000 -p 33041:3000 -p 7778:7777 --network overlay_mynet -v /Users/youht/opt/source/nodejs/njbc20191030:/njbc njbc:v1
docker run -dit --name node2 -p 34042:4000 -p 33042:3000 --network overlay_mynet -v /Users/youht/opt/source/nodejs/njbc_old:/njbc njbc:v1
docker run -dit --name node3 -p 34043:4000 -p 33043:3000 --network overlay_mynet -v /Users/youht/opt/source/nodejs/njbc_old:/njbc njbc:v1
docker run -dit --name node4 -p 34044:4000 -p 33044:3000 --network overlay_mynet -v /Users/youht/opt/source/nodejs/njbc_old:/njbc njbc:v1

docker run -dit --name node5 -p 34045:4000 -p 33045:3000 --network overlay_mynet -v /Users/youht/opt/source/nodejs/njbc_old:/njbc njbc:v1