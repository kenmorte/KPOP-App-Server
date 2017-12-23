const routes = require('./routes');

module.exports = (app, db) => {
    routes(app, db);
};