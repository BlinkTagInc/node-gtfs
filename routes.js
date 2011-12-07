var errors = require('./lib/util/errors');

module.exports = function routes(app){

  app.get('/api', function(req, res){

    //Spit back variables from URL
    for(i in req.query){ console.log(i+": "+req.query[i]); }
  
    res.contentType('application/json');

    res.send({
      error: 'none'
    });
      
  });

  app.all('*', function notFound(req, res, next) {
    next(new errors.NotFound);
  });

}