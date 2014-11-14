var fs    = require('node-fs-extra');
var util  = require('util');
var path  = require('path');
var uuid  = require('node-uuid');
var async = require('async');
var utils = require(__dirname + path.sep + 'utils.js').utils;

var queue = function(basePath){
  if(!basePath){
    this.basePath = utils.sanitizePath(path.sep + 'tmp');
  }else{
    this.basePath = utils.sanitizePath(basePath);
  }
};

queue.prototype.generateFilename = function(){
  return Math.floor(new Date().getTime() / 1000) + '~' + uuid.v1() + '.json'; 
};

queue.prototype.enqueue = function(q, func, args, callback){
  var self = this;
  var payload = utils.encode(q, func, args);
  var queuePath = self.basePath + path.sep + 'queues' + path.sep + q;
  var filename = self.generateFilename();

  fs.mkdirs(queuePath, function(err){
    if(err && typeof callback === 'function'){ callback(err); }
    else{
      fs.writeFile(queuePath + path.sep + filename, payload, function(err) {
        if(typeof callback === 'function'){ callback(err, filename, payload); }
      }); 
    }
  });
};

queue.prototype.enqueueAt = function(timestamp, q, func, args, callback){
  // Don't run plugins here, they should be run by scheduler at the enqueue step
  var self = this;
  var payload = utils.encode(q, func, args);
  var delayedQueuePath = self.basePath + path.sep + 'delayed' + path.sep + Math.floor(timestamp / 1000); // assume timestamp is in ms
  var filename = self.generateFilename();

  fs.mkdirs(delayedQueuePath, function(err){
    if(err && typeof callback === 'function'){ callback(err); }
    else{
      fs.writeFile(delayedQueuePath + path.sep + filename, payload, function(err) {
        if(typeof callback === 'function'){ callback(err, filename, payload); }
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
    directories = directories.map(function(x){ return parseInt(x); });
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

queue.prototype.timestampLength = function(timestamp, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'delayed' + path.sep + timestamp;
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
  var payload = utils.encode(q, func, args);
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
  var payload = utils.encode(q, func, args);
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

queue.prototype.promoteDelayed = function(callback){
  var self = this;
  var now = Math.floor(new Date().getTime() / 1000);
  var funcs = [];

  var handleFile = function(filename, callback){
    fs.readFile(filename, function(err, payload){
      var data = JSON.parse(payload);
      var source = self.basePath + path.sep + 'delayed' + path.sep + now + path.sep + filename;
      var destination = self.basePath + path.sep + 'queues' + path.sep + data.queue + path.sep + filename;
      fs.rename(source, destination, callback);
    });
  };

  self.timestamps(function(err, timestamps){
    timestamps.sort();
    if(timestamps[0] && timestamps[0] > now){
      fs.readdir(function(err, files){
        if(err){ callback(err); }
        else if(files.length === 0){
          fs.rmdir(self.basePath + path.sep + 'delayed' + path.sep + now, function(err){
            if(err){ callback(err); }
          });
        }else{ 
          async.map(files, handleFile, function(err){
            callback(err);
          });
        }
      });
    }else{
      callback(err);
    }
  });
};

queue.prototype.claim = function(workerName, q, filename, callback){
  var self = this;
  var source = self.basePath + path.sep + 'queues' + path.sep + q + path.sep + filename;
  var destination = self.basePath + path.sep + 'workers' + path.sep + workerName + path.sep + filename;
  fs.move(source, destination, {clobber: true}, function(err){
    if(typeof callback === 'function'){ callback(err); }
  });
};

// TODO: Requies a side-cache folder of payloads mapped to timestamps
// queue.prototype.scheduledAt = function(q, func, args, callback){ }

//

exports.queue = queue;