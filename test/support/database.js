const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const should = require('should');

function DatabaseTestSupport(config) {
  if (!(this instanceof DatabaseTestSupport)) {
    return new DatabaseTestSupport(config);
  }

  this.config = config;
  this.db =  null;
}

DatabaseTestSupport.prototype.connect = function(cb) {
  MongoClient.connect(this.config.mongo_url, {w: 1}, (err, db) => {
    should.not.exists(err);
    should.exists(db);
    this.db = db;
    cb(err, this.db);
  });
};

DatabaseTestSupport.prototype.teardown = function(cb) {
  if (!this.db || !this.db.collections) {
    return cb(new Error('Missing collections'));
  }

  this.db.collections((err, collections) => {
    if (err) {
      return cb(err, null);
    }

    if (!collections) {
      return cb(new Error('Missing collections'));
    }

    async.eachSeries(collections, (collection, next) => {
      if (collection.collectionName.substring(0, 6) === 'system') {
        return next();
      }

      collection.remove({}, next);
    }, cb);
  });
};

DatabaseTestSupport.prototype.close = function(cb) {
  this.db.close(cb);
};

module.exports = DatabaseTestSupport;
