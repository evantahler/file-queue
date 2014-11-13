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
};

queue.prototype.generateFilename = function(){
  // microtime will allow for sorting by time; uuid prevents conflicts
  return String( microtime.now() + '~' + uuid.v1() ); 
};

queue.prototype.enqueue = function(q, func, args, callback){
  var self = this;
  var payload = self.encode(q, func, args);
  var queuePath = self.basePath + path.sep + 'queues' + path.sep + q;
  
  mkdirp(queuePath, function(err){
    if(err && typeof callback === 'function'){ callback(err); }
    else{
      fs.writeFile(queuePath + path.sep + self.generateFilename(), payload, function(err) {
        if(typeof callback === 'function'){ callback(err); }
      }); 
    }
  });
};

queue.prototype.enqueueAt = function(timestamp, q, func, args, callback){
  // Don't run plugins here, they should be run by scheduler at the enqueue step
  var self = this;
  var payload = self.encode(q, func, args);
  var delayedQueuePath = self.basePath + path.sep + 'delayed' + path.sep + Math.round(timestamp / 1000); // assume timestamp is in ms

  mkdirp(delayedQueuePath, function(err){
    if(err && typeof callback === 'function'){ callback(err); }
    else{
      fs.writeFile(delayedQueuePath + path.sep + self.generateFilename(), payload, function(err) {
        if(typeof callback === 'function'){ callback(err, payload); }
      }); 
    }
  });
};

queue.prototype.enqueueIn = function(time, q, func, args, callback){
  var self = this;
  var timestamp = (new Date().getTime()) + time;
  self.enqueueAt(timestamp, q, func, args, callback);
};

queue.prototype.queues = function(callback){
  var self = this;
  utils.subDirectories(self.basePath + path.sep + 'queues', function(err, directories){
    if(typeof callback === 'function'){ callback(err, directories); }
  });
};

queue.prototype.timestamps = function(callback){
  var self = this;
  utils.subDirectories(self.basePath + path.sep + 'delayed', function(err, directories){
    if(typeof callback === 'function'){ callback(err, directories); }
  });
};

queue.prototype.length = function(q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.readdir(directory, function(err, files){
    if(typeof callback === 'function'){ callback(err, files.length); }
  });
};

queue.prototype.del = function(q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.rmdir(directory, function(err){
    if(typeof callback === 'function'){ callback(err); }
  });
};

queue.prototype.delFromQueue = function(payload, directory, count, callback){
  var deletedFiles = [];
  var processFile = function(err, file, contents){
    if(deletedFiles.length === count){
      return callback(null, deletedFiles);
    }
    // don't parse the payloads, save time with string comparisons
    else if(!err && payload === contents){
      fs.unlink(file);
      deletedFiles.push(file);
    }else if(err){
      return callback(err, deletedFiles);
    }
  };

  if(count === 0){
    return callback(null, deletedFiles);
  }
  
  fs.readdir(directory, function(err, files){
    if(files.length === 0){
      return callback(null, deletedFiles);
    }
    files.forEach(function(file){      
      fs.readFile(file, function(err, contents){
        processFile(file, err, contents);
      });
    });
  });
};

queue.prototype.delTask = function(q, func, args, count, callback){
  var self = this;
  var payload = self.encode(q, func, args);
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  if(typeof count === "function" && !callback){
    callback = count;
    count = 1;
  }

  self.delFromQueue(payload, directory, count, function(err, deletedFiles){
    if(typeof callback === 'function'){ callback(err, deletedFiles); }
  });
};

queue.prototype.delDelayed = function(q, func, args, count, callback){
  var self = this;
  var payload = self.encode(q, func, args);
  if(typeof count === "function" && !callback){
    callback = count;
    count = 1;
  }
  var deletedFiles = [];

  self.timestamps(function(err, timestamps){
    if(timestamps.length === 0){
      return callback(err, deletedFiles);
    }else{
      timestamps.forEach(function(timestamp){
        if(deletedFiles.length < count){
          self.delFromQueue(payload, timestamp, (deletedFiles.length - count), function(err, localDeletedFiles){
            deletedFiles = deletedFiles.concat(localDeletedFiles);
            if(deletedFiles.length === count){
              return callback(null, deletedFiles);
            }
          });
        }
      });
    }
  });
};

// TODO: Requies a side-cache folder of payloads mapped to timestamps
// queue.prototype.scheduledAt = function(q, func, args, callback){ }