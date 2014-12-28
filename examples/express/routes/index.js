var express = require('express');
var router = express.Router();
var gtfs = require('gtfs');

router.get('/', function(req, res) {
  res.render('index', { title: 'Node GTFS Demo' });
});

module.exports = router;
