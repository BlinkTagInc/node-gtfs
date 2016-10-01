exports.milesToDegrees = function(miles) {
  const milesPerDegree = 69.17101972;
  return miles / milesPerDegree;
};

exports.loadConfig = function() {
  let config;
  if (process.env.NODE_ENV === 'test'){
    config = require('../test/config.json');
  } else {
    try {
      config = require('../config.json');
    } catch(err) {
      try {
        config = require('../config-sample.json');
      } catch(err) {
        console.error('Cannot find config.json');
      }
    }
  }

  return config;
};
