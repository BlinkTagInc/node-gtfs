
var boot = module.exports = require('./boot')
  , app = require('express').createServer();

module.exports = boot(app);

if (!module.parent) {
  var port = process.env.PORT || 8081;
  app.listen(port, function(){
    console.error('\x1b[32m' + app.set('domain') + '\x1b[0m running on port %d',
      app.address().port);
  });
  
}
