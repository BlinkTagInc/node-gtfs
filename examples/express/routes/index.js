var router = require('express').Router();


router.get('/', function(req, res, next) {
  res.render('index', { title: 'Node GTFS Example App' });
});


module.exports = router;
