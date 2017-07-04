const MongoClient = require('mongodb').MongoClient;
const should = require('should');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

let db;

exports.connect = config => {
  // Open the connection to the server
  return MongoClient.connect(config.mongoUrl)
  .then(client => {
    should.exists(client);
    db = client;

    // Also use mongoose to connect
    return mongoose.connect(config.mongoUrl, {useMongoClient: true});
  });
};

exports.teardown = () => {
  return db.collections()
  .then(collections => {
    if (!collections) {
      throw new Error('Missing collections');
    }

    return Promise.all(collections.map(collection => {
      if (collection.collectionName.substring(0, 6) === 'system') {
        return false;
      }

      return collection.remove({});
    }));
  });
};

exports.close = () => {
  return db.close()
  .then(() => {
    mongoose.disconnect();
  });
};
