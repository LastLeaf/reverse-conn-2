'use strict';

var net = require('net');

module.exports = function(config){
    var serviceMap = {};
    var connInfo = {};

    var connConnect = function(conn, service){
        var serviceConn = serviceMap[service];
        if(!serviceConn) {
            conn.end();
            return;
        }
        var connId = Date.now() + Math.random();
        var info = connInfo[connId] = {
            client: conn,
            server: null,
            tobj: setTimeout(function(){
                conn.end();
            }, config.timeout)
        };
        conn.on('error', function(){});
        conn.on('close', function(){
            info.client = null;
            if(info.server) info.server.end();
        });
        serviceConn.write('~' + connId + '#' + service);
    };

    var connAccept = function(conn, connId){
        var info = connInfo[connId];
        delete connInfo[connId];
        if(!info) {
            conn.end();
            return;
        }
        clearTimeout(info.tobj);
        info.server = conn;
        conn.on('error', function(){});
        conn.on('close', function(){
            info.server = null;
            if(info.client) info.client.end();
        });
        connBuild(info.client, info.server);
        info.client.write('~');
    };

    var connBuild = function(client, server){
        client.on('data', function(data){
            server.write(data);
        });
        server.on('data', function(data){
            client.write(data);
        });
    };

    var pubServer = net.createServer(function(conn){
        var tobj = setTimeout(function(){
            conn.end();
        }, config.timeout);
        conn.once('data', function(data){
            clearTimeout(tobj);
            try {
                var opt = JSON.parse(data.toString('utf8'));
            } catch(e) {
                conn.end();
                return;
            }
            if(opt.password !== config.password) {
                conn.end();
                return;
            }
            if(opt.services instanceof Array || opt.services instanceof Array) {
                // control connection
                opt.services.forEach(function(name){
                    if(!serviceMap[name]) serviceMap[name] = conn;
                });
                conn.on('error', function(){});
                conn.on('close', function(){
                    for(var k in serviceMap) {
                        if(serviceMap[k] === conn) delete serviceMap[k];
                    }
                });
            } else if(opt.connect) {
                connConnect(conn, opt.connect);
            } else if(opt.accept) {
                connAccept(conn, opt.accept);
            }
        });
    });
    pubServer.on('error', function(){});

    pubServer.once('listening', function(){
        console.log('Server started.');
    });
    pubServer.listen(config.port, config.host || undefined);
};
