const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const db             = require('./config/db');
const https          = require('https');
const http           = require('http');
const fs             = require('fs');

const app            = express();

// Listening on port 8000
const HTTP_PORT = 8000;
const HTTPS_PORT = 8443;

const options = {
    key: fs.readFileSync('encryption/server-key.pem'),
    cert: fs.readFileSync('encryption/server-crt.pem'),
    ca: fs.readFileSync('encryption/ca-crt.pem'),
};

// To parse body of HTTP requests
app.use(bodyParser.urlencoded({ extended: true }));

MongoClient.connect(db.url, (err, database) => {
    if (err) console.log('ERROR: Error connecting to MongoClient. Message = ', err);

    database = database.db('kpop-dance-challenge-app');
    require('./app/routes')(app, database);

    var httpServer = http.createServer(app);
    var httpsServer = https.createServer(options, app);


    httpServer.listen(HTTP_PORT);
    httpsServer.listen(HTTPS_PORT);

    // app.listen(port, () => {
    //     console.log('We are live on ' + port);
    // });
});
