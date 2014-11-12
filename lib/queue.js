var fs        = require('fs');
var util      = require('util');
var path      = require('path');
var mkdirp    = require('mkdirp');
var uuid      = require('node-uuid');
var microtime = require('microtime');
var utils     = require(__dirname + path.sep + 'utils.js').utils;

var queue = function(basePath){
  if(!basePath){
    this.basePath = utils.sanitizePath(path.sep + 'tmp');
  }else{
    this.basePath = utils.sanitizePath(basePath);
  }
}

queue.prototype.encode = function(q, func, args){
  return JSON.stringify({
    "class": func,
    queue: q,
    args: args || []
  });
}

queue.prototype.generateFilename = function(){
  // microtime will allow for sorting by time; uuid prevents conflicts
  return String( microtime.now() + '~' + uuid.v1() ); 
}

queue.prototype.enqueue = function(q, func, args, callback){
  var self = this;
  var args = utils.arrayify(args);
  var payload = self.encode(q, func, args);
  var queuePath = self.basePath + path.sep + 'queues' + path.sep + q;
  
  mkdirp(queuePath, function(err){
    if(err && typeof callback == 'function'){ callback(err); }
    else{
      fs.writeFile(queuePath + path.sep + self.generateFilename(), JSON.stringify(payload, null, 2), function(err) {
        if(typeof callback == 'function'){ callback(err, payload); }
      }); 
    }
  });
}

queue.prototype.enqueueAt = function(timestamp, q, func, args, callback){
  // Don't run plugins here, they should be run by scheduler at the enqueue step
  var self = this;
  var args = utils.arrayify(args);
  var payload = self.encode(q, func, args);
  var delayedQueuePath = self.basePath + path.sep + 'delayed' + path.sep + Math.round(timestamp / 1000); // assume timestamp is in ms

  mkdirp(delayedQueuePath, function(err){
    if(err && typeof callback == 'function'){ callback(err); }
    else{
      fs.writeFile(delayedQueuePath + path.sep + self.generateFilename(), JSON.stringify(payload, null, 2), function(err) {
        if(typeof callback == 'function'){ callback(err, payload); }
      }); 
    }
  });
};

queue.prototype.enqueueIn = function(time, q, func, args, callback){
  var self = this;
  var args = utils.arrayify(args);
  var timestamp = (new Date().getTime()) + time;
  self.enqueueAt(timestamp, q, func, args, callback);
}

// queue.prototype.queues = function(callback){
//   var self = this;
//   self.connection.ensureConnected(callback, function(){
//     self.connection.redis.smembers(self.connection.key('queues'), function(err, queues){
//       callback(err, queues);
//     });
//   });
// }

// queue.prototype.length = function(q, callback){
//   var self = this;
//   self.connection.ensureConnected(callback, function(){
//     self.connection.redis.llen(self.connection.key('queue', q), function(err, length){
//       callback(err, length);
//     });
//   });
// }

// queue.prototype.del = function(q, func, args, count, callback){
//   var self = this;
//   var args = arrayify(args);
//   if(typeof count == "function" && callback == null){
//     callback = count;
//     count = 0; // remove first enqueued items that match
//   }
//   self.connection.ensureConnected(callback, function(){
//     self.connection.redis.lrem(self.connection.key('queue', q), count, self.encode(q, func, args), function(err, count){
//       if(typeof callback == "function"){ callback(err, count); }
//     });
//   });
// }

// queue.prototype.delDelayed = function(q, func, args, callback){
//   var self = this;
//   var args = arrayify(args);
//   var search = self.encode(q, func, args);
//   self.connection.ensureConnected(callback, function(){
//     var timestamps = self.connection.redis.smembers(self.connection.key("timestamps:" + search), function(err, members){
//       if(members.length == 0 ){ if(typeof callback == "function"){ callback(err, []); } }
//       else{
//         var started = 0;
//         var timestamps = [];
//         members.forEach(function(key){
//           started++;
//           self.connection.redis.lrem(key, 0, search, function(){
//             self.connection.redis.srem(self.connection.key("timestamps:" + search), key, function(){
//               timestamps.push(key.split(":")[key.split(":").length - 1]);
//               started--;
//               if(started == 0){
//                 if(typeof callback == "function"){ callback(err, timestamps); }
//               }
//             })
//           })
//         });
//       }
//     });
//   });
// }

// queue.prototype.scheduledAt = function(q, func, args, callback){
//   var self = this;
//   var args = arrayify(args);
//   var search = self.encode(q, func, args);
//   self.connection.ensureConnected(callback, function(){
//     self.connection.redis.smembers(self.connection.key("timestamps:" + search), function(err, members){
//       var timestamps = [];
//       if(members != null){
//         members.forEach(function(key){
//           timestamps.push(key.split(":")[key.split(":").length - 1]);
//         })
//       }
//       if(typeof callback == "function"){ callback(err, timestamps); }
//     });
//   });
// }