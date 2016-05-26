'use strict';

var net = require('net');
var dgram = require('dgram');

module.exports = function(config){
    var udpMapping = {};

    var sendMsg = function(msg){
        var buf = new Buffer(4);
        buf.writeInt32LE(msg.length, 0);
        return Buffer.concat([buf, msg]);
    };

    var receiveMsg = function(dataObj, data){
        var arr = [];
        var buf = data;
        if(dataObj.buf) buf = Buffer.concat([dataObj.buf, buf]);
        while(buf.length >= 4) {
            var len = buf.readInt32LE(0);
            if(len + 4 > buf) {
                dataObj.buf = buf;
                return arr;
            }
            var msg = buf.slice(4, len + 4);
            arr.push(msg);
            buf = buf.slice(len + 4);
        }
        if(buf.length) dataObj.buf = buf;
        else dataObj.buf = null;
        return arr;
    };

    var useUdpService = function(port, host, service){
        var udpServer = dgram.createSocket('udp4');
        udpServer.on('message', function(msg, rinfo){
            var rid = rinfo.address + ':' + rinfo.port;
            if(udpMapping[rid]) {
                if(!udpMapping[rid].conn) {
                    udpMapping[rid].pending.push(msg);
                } else {
                    udpMapping[rid].conn.write(sendMsg(msg));
                }
            } else {
                udpMapping[rid] = {
                    conn: null,
                    tobj: null, // TODO
                    pending: [msg],
                    dataObj: {},
                };
                var pubConn = net.connect(config.port, config.host, function(){
                    pubConn.once('data', function(data){
                        if(data.length > 1) {
                            var msgArr = receiveMsg(udpMapping[rid].dataObj, data.slice(1));
                            msgArr.forEach(function(msg){
                                udpServer.send(msg, 0, msg.length, rinfo.port, rinfo.address);
                            });
                        }
                        udpMapping[rid].conn = pubConn;
                        var pending = udpMapping[rid].pending;
                        while(pending.length) {
                            msg = pending.shift();
                            pubConn.write(sendMsg(msg));
                        }
                        pubConn.on('data', function(data){
                            var msgArr = receiveMsg(udpMapping[rid].dataObj, data);
                            msgArr.forEach(function(msg){
                                udpServer.send(msg, 0, msg.length, rinfo.port, rinfo.address);
                            });
                        });
                    });
                    pubConn.on('error', function(){});
                    pubConn.on('close', function(){
                        delete udpMapping[rid];
                    });
                    pubConn.write(JSON.stringify({
                        password: config.password,
                        connect: service,
                    }));
                });
            }
        });
        udpServer.on('error', function(){});
        udpServer.on('listening', function(){
            console.log('Using UDP service "' + service + '" on port ' + port + '.');
        });
        udpServer.bind(port, host || undefined);
    };

    var provideUdpService = function(port, host, connId){
        var udpServer = dgram.createSocket('udp4');
        udpServer.on('error', function(){});
        udpServer.on('listening', function(){
            var dataObj = {};
            var pubConn = net.connect(config.port, config.host, function(){
                pubConn.on('error', function(){});
                pubConn.on('close', function(){
                    if(udpServer) udpServer.close();
                    udpServer = null;
                });
                pubConn.on('data', function(data){
                    var msgArr = receiveMsg(dataObj, data);
                    msgArr.forEach(function(msg){
                        udpServer.send(msg, 0, msg.length, port, host);
                    });
                });
                udpServer.on('message', function(msg){
                    pubConn.write(sendMsg(msg));
                });
                pubConn.write(JSON.stringify({
                    password: config.password,
                    accept: connId,
                }));
            });
        });
        udpServer.bind(0);
    };

    return {
        useUdpService: useUdpService,
        provideUdpService: provideUdpService,
    };
};