Quickstart NodeJS HTTPS Sample Project Including HTTPS Authorized Certs (aka 2-Way SSL / Mutual SSL)
====================================================================================================

This project was cloned from the excellent example by Anders Brownworth. The original
repo by Anders is available https://github.com/anders94/https-authorized-clients

His great blog article [HTTPS Authorized Certs with Node.js](https://engineering.circle.com/https-authorized-certs-with-node-js-315e548354a2#.b1hqa57j6)
that references the above git repo was also used to in my further elaboration of this
topic.

Intro
=====

Typically, HTTPS servers do a basic TLS handshake and accept any client connection as 
long as a compatible cipher suite can be found. However, the server can be configured 
to send the client a CertificateRequest during the TLS handshake which requires the
client to present a certificate as a form of identity.

Here's some background on
[Client-authenticated TLS Handshakes](http://en.wikipedia.org/wiki/Transport_Layer_Security#Client-authenticated_TLS_handshake)
at Wikipedia.

HTTPS server certificates usually have their "Common Name" set to their fully qualified 
domain name and are signed by a well known certificate authority such as Verisign. 
However, the "Common Name" usually used in client certificates can be set to anything that
identifies the client such as "Acme, Co." or "client-12345". This will be presented to the 
server and can be used in addition to or instead of username / password strategies to
identify the client.

Using node.js, one can instruct the server to request a client certificate and reject 
unauthorized clients by adding

    {
      requestCert: true,
      rejectUnauthorized: true
    }

to the options passed to https.createServer(). In turn, a client will be rejected unless
it passes a valid certificate in its https.request() options.

    {
      key: fs.readFileSync('keys/client-key.pem'),
      cert: fs.readFileSync('keys/client-crt.pem')
    }

The following exercise will create a self signed certificate authority, server certificate and 
two client certificates all "self signed" by the certificate authority. Then we will run an 
HTTPS server which will accept only connections made by clients presenting a valid certificate.
We will finish off by revoking one of the client certificates and seeing that the server 
rejects requests from this client.

Setup
=====

Let's create our own certificate authority so we can sign our own client certificates. We will
also sign our server certificate so we don't have to pay for one for our server.

Create a Certificate Authority
------------------------------

We will do this only once and use the configuration stored in keys/ca.cnf. A 27 year certificate 
(9999 days) of 4096 bits should do the trick quite well. (we want our CA to be valid for a long
time and be super secure - but this is really just overkill)

    openssl req -new -x509 -days 9999 -config tls/ca/ca.cnf -keyout tls/ca/keys/ca-key.pem -out tls/ca/certs/ca-crt.pem

Now we have a certificate authority with the private key tls/cs/keys/ca-key.pem and the public key 
tls/ca/keys/ca-crt.pem.

Create Private Keys
-------------------

Let's build some private keys for our server and client certificates. Note keys can be generated first without having first created public
certs of Certificate Signing Requests (CSR)

    openssl genrsa -out tls/server/keys/server-key.pem 4096
    openssl genrsa -out tls/client/keys/client1-key.pem 4096
    openssl genrsa -out tls/client/keys/client2-key.pem 4096

Again, 4096 is a bit of overkill here but we aren't too worried about CPU usage issues.

Sign Certificates by generating Certificate Signing Requests (CSR)
------------------------------------------------------------------

Now let's sign these certificates using the certificate authority we made previously. This is usually
called "self signing" our certificates. We'll start by signing the server certificate.

This line creates a "CSR" or certificate signing request which is written to tsl/server/csr/server-csr.pem

    openssl req -new -config tls/server/server.cnf -key tls/server/keys/server-key.pem -out tls/server/csr/server-csr.pem

Next we use the configuration stored in tls/server/server.cnf and our certificate authority to sign the CSR
resulting in tls/server/certs/server-crt.pem, our server's new public certificate. Note when the -CA option is 
used to sign a certificate it uses a serial number specified in a file. This file consist of one line containing 
an even number of hex digits with the serial number to use. After each use the serial number is incremented 
and written out to the file again.
                                                                                        
The default filename consists of the CA certificate file base name with ".srl" appended. For example if the CA certificate file 
is called "ca-crt.pem" it expects to find a serial number file called "ca-crt.srl".


    openssl x509 -req -extfile tls/server/server.cnf -days 999 -passin "pass:password" -in tls/server/csr/server-csr.pem -CA tls/ca/certs/ca-crt.pem -CAkey tls/ca/keys/ca-key.pem -CAcreateserial -out tls/server/certs/server-crt.pem


Let's do the same for the two client certificates, using different configuration files. (the configuration 
files are identical except for the Common Name setting so we can distinguish them later)

    openssl req -new -config tls/client/client1.cnf -key tls/client/keys/client1-key.pem -out tls/client/csr/client1-csr.pem
    openssl x509 -req -extfile tls/client/client1.cnf -days 999 -passin "pass:password" -in tls/client/csr/client1-csr.pem -CA tls/ca/keys/ca-crt.pem -CAkey tls/ca/keys/ca-key.pem -CAcreateserial -out tls/client/certs/client1-crt.pem

    openssl req -new -config tls/client/client2.cnf -key tls/client/keys/client2-key.pem -out tls/client/csr/client2-csr.pem
    openssl x509 -req -extfile tls/client/client2.cnf -days 999 -passin "pass:password" -in tls/client/csr/client2-csr.pem -CA tls/ca/certs/ca-crt.pem -CAkey tls/ca/keys/ca-key.pem -CAcreateserial -out tls/client/certs/client2-crt.pem

OK, we should be set with the certificates we need.

Verify
------

Let's just test them out though to make sure each of these certificates has been validly signed by our
certificate authority.

    openssl verify -CAfile tls/ca/certs/ca-crt.pem tls/server/certs/server-crt.pem
    openssl verify -CAfile tls/ca/certs/ca-crt.pem tls/client/certs/client1-crt.pem
    openssl verify -CAfile tls/ca/certs/ca-crt.pem tls/client/certs/client2-crt.pem

If we get an "OK" when running each of those commands, we are all set.

Run the Example
===============

We should be ready to go now. Let's fire up the server:

    node server

We now have a server listening on 0.0.0.0:4433 that will only work if the client presents a valid 
certificate signed by the certificate authority. Let's test that out in another window:

    node client 1

This will invoke a client using the client1-crt.pem certificate which should connect to the server
and get a "hello world" back in the body. Let's try it with the other client certificate as well:

    node client 2

You should be able to see from the server output that it can distinguish between the two clients
by the certificates they present. (client1 or client2 which are the Common Names set in the .cnf 
files)

Certificate Revocation
======================

All is well in the world until we want to shut down a specific client without shutting everybody 
else down and regenerating certificates. Let's create a Certificate Revocation List (CRL) and 
revoke the client2 certificate. The first time we'll do this, we need to create an empty database:

    touch tls/ca/crl/ca-database.txt

Now let's revoke client2's certificate and update the CRL:

    openssl ca -revoke tls/client/certs/client2-crt.pem -keyfile tls/ca/keys/ca-key.pem -config tls/ca/ca.cnf -cert tls/ca/certs/ca-crt.pem -passin 'pass:password'
    openssl ca -keyfile tls/ca/keys/ca-key.pem -cert tls/ca/certs/ca-crt.pem -config tls/ca/ca.cnf -gencrl -out tls/ca/crl/ca-crl.pem -passin 'pass:password'

Let's stop the server and comment back in line 8 which reads in the CRL:

    crl: fs.readFileSync('keys/ca-crl.pem')

and restart the server again:

    node server

Now comes the moment of truth. Let's test to see if client 2 works or not:

    node client 2

If all goes well, it won't work anymore. Just as a sanity check, let's make sure client 1 still works:

    node client 1

Likewise, if all is well, client 1 still works while client 2 is rejected.

Verifying it with Curl 
======================

Using Curl to verify the above TLS configurations you can try the following examples.

To demonstrate the Server is expecting client authintication the following request will 
 complain that _SSL peer handshake failed, the server most likely requires a client certificate to connect_

    curl -k https://localhost:4433

So to fix this add the following arguments - Update! on Mac Curl has problems using PEM files see [here](https://www.brandpending.com/2016/05/03/using-a-pem-file-as-a-client-certificate-with-curl-on-mac-os-x/)
 for further information;
* -k or --insecure : Disables Certificate Verification against a Root/Intermediate
* --cert or -E : Tells curl to use the specified certificate file. The certificate must be in PEM format
* --cert-type : Private key file type (DER, PEM, and ENG are supported)
* --cacert : CA Certificate
* --key : Client private key


    curl -k --cert-type pem --cert ./tls/client/certs/client1-crt.pem:password --cacert ./tls/ca/certs/ca-crt.pem --key ./tls/client/keys/client1-key.pem "https://localhost:4433"

Conclusion
==========

We have seen how we can create self signed server and client certificates and ensure that clients
interacting with our server only use valid certificates signed by us. Additionally, we can revoke 
any of the client certificates without having to revoke everything and rebuild from scratch. 
Because we can see the Common Name of the client certificates being presented and we know that they
must be valid in order for us to see them, we can use this as a strategy to identify clients using
our server.

