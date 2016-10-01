const _ = require('lodash');
const moment = require('moment');

exports.isInt = function(n) {
  return typeof n === 'number' && n % 1 === 0;
};

exports.timeToSeconds = function(time) {
  let mmt;
  if (time instanceof Date) {
    mmt(time);
  } else {
    mmt(time, 'HH:mm:ss');
  }
  const mmtMidnight = mmt.clone().startOf('day');

  // Difference in seconds
  const diffSeconds = mmt.diff(mmtMidnight, 'seconds');
  return diffSeconds;
};

exports.secondsToTime = function(seconds) {
  if (seconds === undefined || seconds === '') {
    return seconds;
  }

  //check if seconds are already in HH:MM:SS format
  if (_.first(seconds.match(/\d+:\d+:\d+/))) {
    return seconds;
  }

  return moment.utc(seconds * 1000).format('HH:mm:ss');
};

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
}
