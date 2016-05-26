var assert = require('assert');
var dgram = require('dgram');

var udpServer = dgram.createSocket('udp4');
udpServer.on('message', function(msg, rinfo){
    assert.equal(msg.length, 4);
    var ret = msg.readInt32LE(0);
    console.info('R: ' + ret);
    if(ret <= 0) return;
    var buf = new Buffer(4);
    buf.writeInt32LE(ret + 1, 0);
    udpServer.send(buf, 0, 4, rinfo.port, rinfo.address);
});
udpServer.bind(2253);
