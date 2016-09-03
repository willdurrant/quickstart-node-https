var fs = require('fs');
var https = require('https');

if (process.argv[2]) {
    var x = process.argv[2];

    var options = {
	hostname: 'localhost',
	port: 4433,
	path: '/',
	method: 'GET',
	key: fs.readFileSync('tls/client/keys/client'+x+'-key.pem'),
	cert: fs.readFileSync('tls/client/certs/client'+x+'-crt.pem'),
	ca: fs.readFileSync('tls/ca/certs/ca-crt.pem')
    };

    var req = https.request(options, function(res) {
	    res.on('data', function(data) {
		    process.stdout.write(data);
		});
	});
    req.end();

    req.on('error', function(e) {
	    console.error(e);
	});
}
else
    console.log('usage: node client 1');
