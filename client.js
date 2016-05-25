'use strict';

var net = require('net');
var dgram = require('dgram');

module.exports = function(config){
    var serviceList = [];
    var serviceInfo = {};

    var useTcpService = function(port, host, service){
        var tcpServer = net.createServer({pauseOnConnect: true}, function(clientConn){
            var pubConn = net.connect(config.port, config.host, function(){
                pubConn.once('data', function(data){
                    if(data.length > 1) clientConn.write(data.slice(1));
                    pubConn.on('data', function(data){
                        clientConn.write(data);
                    });
                    clientConn.on('data', function(data){
                        pubConn.write(data);
                    });
                    clientConn.resume();
                });
                pubConn.on('error', function(){});
                pubConn.on('close', function(){
                    pubConn = null;
                    if(clientConn) clientConn.end();
                });
                pubConn.write(JSON.stringify({
                    password: config.password,
                    connect: service,
                }));
            });
            clientConn.on('error', function(){});
            clientConn.on('close', function(){
                clientConn = null;
                if(pubConn) pubConn.end();
            });
        });
        tcpServer.on('error', function(){});
        tcpServer.on('listening', function(){
            console.info('Using TCP service on port ' + port + '.');
        });
        tcpServer.listen(port, host || undefined);
    };

    var useUdpService = function(port, host, service){
        // TODO
    };

    // collect "using" services
    for(var k in config['tcp-use']) {
        useTcpService(config['tcp-use'][k].port, config['tcp-use'][k].host, k);
    }
    for(k in config['udp-use']) {
        useUdpService(config['udp-use'][k].port, config['udp-use'][k].host, k);
    }

    // collect "providing" services
    for(k in config['tcp-provide']) {
        serviceInfo[k] = {
            type: 'tcp',
            host: config['tcp-provide'][k].host || 'localhost',
            port: config['tcp-provide'][k].port || 0,
        };
        serviceList.push(k);
    }
    for(k in config['udp-provide']) {
        serviceInfo[k] = {
            type: 'udp',
            host: config['udp-provide'][k].host || 'localhost',
            port: config['udp-provide'][k].port || 0,
        };
        serviceList.push(k);
    }

    var provideTcpService = function(port, host, connId){
        var serverConn = net.connect(port, host, function(){
            var pubConn = net.connect(config.port, config.host, function(){
                pubConn.on('error', function(){});
                pubConn.on('close', function(){
                    pubConn = null;
                    if(serverConn) serverConn.end();
                });
                pubConn.on('data', function(data){
                    serverConn.write(data);
                });
                serverConn.on('data', function(data){
                    pubConn.write(data);
                });
                pubConn.write(JSON.stringify({
                    password: config.password,
                    accept: connId,
                }));
            });
            serverConn.on('error', function(){});
            serverConn.on('close', function(){
                serverConn = null;
                if(pubConn) pubConn.end();
            });
        });
    };

    var provideUdpService = function(port, host){
        // TODO
    };

    var reconnectPub = function(){
        // register services
        var conn = net.connect(config.port, config.host, function(){
            conn.setKeepAlive(true);
            conn.on('data', function(data){
                var str = data.toString('utf8');
                var arr = str.split('~');
                arr.forEach(function(item){
                    if(!item) return;
                    var arr = item.split('#');
                    var connId = arr[0];
                    var service = arr[1];
                    var info = serviceInfo[service];
                    if(!info) return;
                    if(info.type === 'tcp') provideTcpService(info.port, info.host, connId);
                    else provideUdpService(info.port, info.host);
                });
            });
            conn.write(JSON.stringify({
                password: config.password,
                services: serviceList,
            }));
            console.log('Connected to pub server.');
        });
        conn.on('error', function(){});
        conn.on('close', function(){
            console.log('Disconnected from pub server.');
            setTimeout(reconnectPub, 5000);
        });
    };
    reconnectPub();
};
