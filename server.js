var fs = require('fs');
var https = require('https');

var options = {
    key: fs.readFileSync('tls/server/keys/server-key.pem'),
    cert: fs.readFileSync('tls/server/certs/server-crt.pem'),
    ca: fs.readFileSync('tls/ca/certs/ca-crt.pem'),
    //crl: fs.readFileSync('tls/ca/crl/ca-crl.pem'),
    requestCert: true,
    rejectUnauthorized: true
};

https.createServer(options, function (req, res) {
	if (req.socket.authorized) // shouldn't even get here if not authorized
	    console.log(new Date()+' '+req.connection.remoteAddress+' '+
			req.socket.getPeerCertificate().subject.CN+' '+
			req.method+' '+req.url);
	res.writeHead(200);
	res.end("hello world\n");
    }).listen(4433);

console.log('listening on 0.0.0.0:4433');
