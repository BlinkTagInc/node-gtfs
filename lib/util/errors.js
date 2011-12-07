var NotFound = exports.NotFound = function(msg){
  this.name = 'NotFound';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
};

require('sys').inherits(NotFound, Error);

var Unauthorized = exports.Unauthorized = function(msg){
  this.name = 'Unauthorized';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
};

require('sys').inherits(Unauthorized, Error);

