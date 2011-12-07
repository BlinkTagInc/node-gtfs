
var config = require('./config')
  , routes = require('./routes')
  , errorHandlers = require('./lib/error-handlers');

module.exports = function boot(app){

  config(app);

  errorHandlers(app);
  
  routes(app);

  return app;

}