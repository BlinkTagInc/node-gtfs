
var errors = require('./util/errors');

module.exports = function(app){
  /**
   * 404 Not Found
   */

  app.error(function(err, req, res, next){
    if (!app.set('error templates') || !(err instanceof errors.NotFound))
      return next(err);

    if (req.xhr){
      res.send(404);
    } else {
      res.render('error.jade'
      , { layout: false
        , status: 404
        , locals:
          { status: 404
          , title: 'Not Found'
          , text: '404 Error (File not Found)'
          }
        }
      );
    }
  });

  /**
   * 401 Unauthorized
   */

  app.error(function(err, req, res, next){
    if (!app.set('error templates') || !(err instanceof errors.Unauthorized))
      return next(err);

    if (req.xhr){
      res.send(401);
    } else {
      res.render('error.jade'
      , { layout: false
        , status: 401
        , locals:
          { status: 401
          , title: 'Unauthorized'
          , text: '401 Error (Unauthorized)'
          }
        }
      );
    }
  });

  /**
   * 500 Internal Server Error
   */

  app.error(function(err, req, res, next){
    if (!app.set('error templates')) return next(err);

    if (req.xhr){
      res.send(500);
    } else {
      res.render('error.jade'
      , { layout: false
        , status: 500
        , locals:
          { status: 500
          , title: 'Internal Server Error'
          , text: 'Error in our app :( <br> Let us track this down'
          }
        }
      );
    }

    console.error(err.stack || err);
  });

};
