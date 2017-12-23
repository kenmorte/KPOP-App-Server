const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const db             = require('./config/db');


const app            = express();

// Listening on port 8000
const port = 8000;

// To parse body of HTTP requests
app.use(bodyParser.urlencoded({ extended: true }));

MongoClient.connect(db.url, (err, database) => {
    if (err) console.log('ERROR: Error connecting to MongoClient. Message = ', err);

    database = database.db('kpop-dance-challenge-app');
    require('./app/routes')(app, database);

    app.listen(port, () => {
        console.log('We are live on ' + port);
    });
});
