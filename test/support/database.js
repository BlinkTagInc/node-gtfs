const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const should = require('should');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

let db;

exports.connect = (config, cb) => {
  // Open the connection to the server
  MongoClient.connect(config.mongoUrl, (err, client) => {
    should.not.exists(err);
    should.exists(client);
    db = client;

    // Also use mongoose to connect
    mongoose.connect(config.mongoUrl, {
      useMongoClient: true
    }, cb);
  });
};

exports.teardown = cb => {
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

exports.close = cb => {
  db.close(err => {
    if (err) {
      return cb(err);
    }
    mongoose.disconnect(cb);
  });
};
