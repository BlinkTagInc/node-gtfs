var config = require('./config')
  , routes = require('./routes');

module.exports = function boot(app){

  config(app);
  
  routes(app);

  return app;

}
