const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const should = require('should');

let db;

exports.connect = (config, cb) => {
  // Open the connection to the server
  MongoClient.connect(config.mongo_url, (err, client) => {
    should.not.exists(err);
    should.exists(client);
    db = client;
    cb(null, db);
  });
};

exports.teardown = (cb) => {
  db.collections((err, collections) => {
    if (err) {
      return cb(err);
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

exports.close = (cb) => {
  db.close(cb);
};
