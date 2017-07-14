const MongoClient = require('mongodb').MongoClient;
const should = require('should');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

let db;

exports.connect = async config => {
  // Open the connection to the server
  db = await MongoClient.connect(config.mongoUrl);
  should.exists(db);

  // Also use mongoose to connect
  await mongoose.connect(config.mongoUrl);
  return db;
};

exports.teardown = async () => {
  const collections = await db.collections();
  if (!collections) {
    throw new Error('Missing collections');
  }

  for (const collection of collections) {
    await collection.remove({});
  }
};

exports.close = async () => {
  await db.close();
  await mongoose.disconnect();
};
