'use strict';

var fs = require('fs');

var config = JSON.parse( fs.readFileSync(process.env.CONFIG_JSON || 'config.json', {encoding: 'utf8'}) );

if(config.server) {
    require('./pub.js')(config);
} else {
    require('./client.js')(config);
}
