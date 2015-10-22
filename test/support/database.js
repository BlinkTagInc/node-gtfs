var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var should = require('should');

function DatabaseTestSupport(config){
  if (!(this instanceof DatabaseTestSupport)) return new DatabaseTestSupport(config);

  this.config = config;
  this.db =  null;
}

DatabaseTestSupport.prototype.connect = function(cb){
  MongoClient.connect(this.config.mongo_url, {w: 1}, function(err, db) {
    should.not.exists(err);
    should.exists(db);
    this.db = db;
    cb(err, this.db);
  }.bind(this));
};

DatabaseTestSupport.prototype.teardown = function(cb){
  this.db.collections(function(err, collections){
    if (err) return cb(err, null);
    if (!collections) cb(new Error('Missing collections'));

    async.eachSeries(collections, function(collection, next){
      if (collection.collectionName.substring(0, 6) === 'system') return next();
      collection.remove({}, function(err){
        next();
      });
    }, cb);
  });
};

DatabaseTestSupport.prototype.close = function(cb){
  this.db.close(cb);
};

module.exports = DatabaseTestSupport;
