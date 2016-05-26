var assert = require('assert');
var dgram = require('dgram');

var udpClient = dgram.createSocket('udp4');
udpClient.on('message', function(msg, rinfo){
    clearInterval(iobj);
    assert.equal(msg.length, 4);
    var ret = msg.readInt32LE(0);
    console.info('B: ' + ret);
    var buf = new Buffer(4);
    buf.writeInt32LE(ret + 1, 0);
    udpClient.send(buf, 0, 4, rinfo.port, rinfo.address);
});

var iobj = setInterval(function(){
    var buf = new Buffer(4);
    buf.writeInt32LE(1, 0);
    udpClient.send(buf, 0, 4, 1153, '127.0.0.1');
    buf = new Buffer(4);
    buf.writeInt32LE(10001, 0);
    udpClient.send(buf, 0, 4, 1153, '127.0.0.1');
}, 3000);
