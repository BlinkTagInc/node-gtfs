var _ = require('underscore');

module.exports = {
  isInt: function (n) {
    return typeof n === 'number' && n % 1 === 0;
  },

  getDayName: function (date) {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  },

  formatDay: function (date) {
    var day = (date.getDate() < 10) ? '' + '0' + date.getDate() : date.getDate(),
      month = ((date.getMonth() + 1) < 10) ? '' + '0' + (date.getMonth() + 1) : (date.getMonth() + 1),
      year = date.getFullYear();
    return '' + year + month + day;
  },

  timeToSeconds: function (time) {
    var timeParts;
    if(time instanceof Date) {
      timeParts = [time.getHours(), time.getMinutes(), time.getSeconds()];
    } else {
      timeParts = time.split(':');
      if(timeParts.length != 3) {
        return null;
      }
    }
    return parseInt(timeParts[0], 10) * 60 * 60 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
  },

  secondsToTime: function (seconds) {
    if(seconds === undefined || seconds === '') {
      return seconds;
    }

    //check if seconds are already in HH:MM:SS format
    if(_.first(seconds.match(/\d+:\d+:\d+/))) {
      return seconds;
    }

    var hour = Math.floor(seconds / (60 * 60)),
      minute = Math.floor((seconds - hour * (60 * 60)) / 60),
      second = seconds - hour * (60 * 60) - minute * 60;

    return((hour < 10) ? '' + '0' + hour : hour) + ':' + ((minute < 10) ? '' + '0' + minute : minute) + ':' + ((second < 10) ? '' + '0' + second : second);
  }
};
