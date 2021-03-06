var fs    = require('fs-extra');
var util  = require('util');
var path  = require('path');
var uuid  = require('node-uuid');
var async = require('async');
var utils = require(__dirname + path.sep + 'utils.js').utils;

var queue = function(basePath){
  this.utils = utils;

  if(!basePath){
    this.basePath = utils.sanitizePath(path.sep + 'tmp');
  }else{
    this.basePath = utils.sanitizePath(basePath);
  }

  this.ensureDirs();
};

queue.prototype.ensureDirs = function(callback){
  var self = this;
  var dirs = [ 'queues', 'delayed', 'workers' ];

  dirs.forEach(function(dir){
    fs.ensureDirSync(self.basePath + path.sep + dir);
  });
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
    if(err && typeof callback === 'function'){ return callback(err); }
    else{
      fs.writeFile(queuePath + path.sep + filename, payload, function(err) {
        if(typeof callback === 'function'){ return callback(err, filename, payload); }
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
    if(err && typeof callback === 'function'){ return callback(err); }
    else{
      fs.writeFile(delayedQueuePath + path.sep + filename, payload, function(err) {
        if(typeof callback === 'function'){ return callback(err, filename, payload); }
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
    if(typeof callback === 'function'){ return callback(err, directories); }
  });
};

queue.prototype.timestamps = function(callback){
  var self = this;
  utils.subDirectories(self.basePath + path.sep + 'delayed', function(err, directories){
    directories = directories.map(function(x){ return parseInt(x); });
    if(typeof callback === 'function'){ return callback(err, directories); }
  });
};

queue.prototype.length = function(q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.readdir(directory, function(err, files){
    if(typeof callback === 'function'){ return callback(err, files.length); }
  });
};

queue.prototype.timestampLength = function(timestamp, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'delayed' + path.sep + timestamp;
  fs.readdir(directory, function(err, files){
    if(typeof callback === 'function'){ return callback(err, files.length); }
  });
};

queue.prototype.jobs = function(q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.readdir(directory, function(err, files){
    files = files.map(function(f){ return path.basename(f, '.json'); });
    if(typeof callback === 'function'){ return callback(err, files); }
  });
};

queue.prototype.timestampJobs = function(timestamp, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'delayed' + path.sep + timestamp;
  fs.readdir(directory, function(err, files){
    files = files.map(function(f){ return path.basename(f, '.json'); });
    if(typeof callback === 'function'){ return callback(err, files); }
  });
};

queue.prototype.readJob = function(q, jobName, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.readFile(directory + path.sep + jobName + '.json', function(err, contents){
    var payload;
    if(!err){ payload = utils.decode(contents); }
    callback(err, payload);
  });
};

queue.prototype.readTimestampJob = function(timestamp, jobName, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'delayed' + path.sep + timestamp;
  fs.readFile(directory + path.sep + jobName + '.json', function(err, contents){
    var payload;
    if(!err){ payload = utils.decode(contents); }
    callback(err, payload);
  });
};

queue.prototype.del = function(q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.remove(directory, function(err){
    if(typeof callback === 'function'){ return callback(err); }
  });
};

queue.prototype.genericDelFromPath = function(payload, directory, count, callback){
  // never call this method directly; use #delFromQueue or #delFromTimestamp
  var self = this;
  var deletedFiles = [];
  var processedFiles = 0;
  var potentialFiles = 0;
  var payloadString = JSON.stringify(utils.decode(payload));
  
  var processFile = function(err, file, contents){
    var contentsString = JSON.stringify(utils.decode(contents));
    // don't parse the payloads, save time with string comparisons
    if(!err && payloadString === contentsString){
      fs.unlink(directory + path.sep + file, function(err){
        processedFiles++;
        deletedFiles.push(file);
        if(potentialFiles === processedFiles){ return callback(null, deletedFiles); }
      });
    }else if(err){
      processedFiles++;
      return callback(err, deletedFiles);
    }else{
      processedFiles++;
      if(potentialFiles === processedFiles){ return callback(null, deletedFiles); }
    }
  };

  if(count === 0){
    return callback(null, deletedFiles);
  }
  
  fs.readdir(directory, function(err, files){
    if(files.length === 0){
      return callback(null, deletedFiles);
    }
    potentialFiles = files.length;
    files.forEach(function(file){      
      fs.readFile(directory + path.sep + file, function(err, contents){
        processFile(err, file, contents);
      });
    });
  });
};

queue.prototype.delFromQueue = function(q, func, args, count, callback){
  var self = this;
  var payload = utils.encode(q, func, args);
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  if(typeof count === "function" && !callback){
    callback = count;
    count = 1;
  }

  self.genericDelFromPath(payload, directory, count, function(err, deletedFiles){
    if(typeof callback === 'function'){ return callback(err, deletedFiles); }
  });
};

queue.prototype.delFromTimestamp = function(q, func, args, count, callback){
  var self = this;
  var payload = utils.encode(q, func, args);
  if(typeof count === "function" && !callback){
    callback = count;
    count = 1;
  }
  var deletedFiles = [];

  var workTimestamp = function(timestamp, callback){
    if(deletedFiles.length < count){
      var directory = self.basePath + path.sep + 'delayed' + path.sep + timestamp;
      self.genericDelFromPath(payload, directory, (deletedFiles.length - count), function(err, localDeletedFiles){
        deletedFiles = deletedFiles.concat(localDeletedFiles);
        callback();
      });
    }else{
      callback();
    }
  };

  self.timestamps(function(err, timestamps){
    if(timestamps.length === 0){
      return callback(err, deletedFiles);
    }else{
      async.map(timestamps, workTimestamp, function(err){
        callback(err, deletedFiles);
      });
    }
  });
};

queue.prototype.promoteDelayed = function(callback){
  var self = this;
  var now = Math.floor(new Date().getTime() / 1000);
  var funcs = [];
  var directory;

  var handleFile = function(filename, callback){
    var source = directory + path.sep + filename;
    fs.readFile(source, function(err, contents){
      var data = utils.decode(contents);
      var destinationDir = self.basePath + path.sep + 'queues' + path.sep + data.queue;
      var destination = destinationDir + path.sep + filename;
      fs.ensureDir(destinationDir, function(err){
        fs.rename(source, destination, callback);
      });
    });
  };

  self.timestamps(function(err, timestamps){
    if(timestamps[0] !== undefined && timestamps[0] < now){
      directory = self.basePath + path.sep + 'delayed' + path.sep + timestamps[0];
      fs.readdir(directory, function(err, files){
        if(err){ callback(err); }
        else if(files.length === 0){
          fs.rmdir(directory, function(err){
            if(typeof callback === 'function'){ return callback(err); }
          });
        }else{ 
          async.map(files, handleFile, function(err){
            if(typeof callback === 'function'){ return callback(err); }
          });
        }
      });
    }else{
      if(typeof callback === 'function'){ return callback(err); }
    }
  });
};

queue.prototype.claim = function(workerName, q, filename, callback){
  var self = this;
  var source = self.basePath + path.sep + 'queues' + path.sep + q + path.sep + filename;
  var destination = self.basePath + path.sep + 'workers' + path.sep + workerName + path.sep + filename;
  fs.move(source, destination, {clobber: true}, function(err){
    if(err){ if(typeof callback === 'function'){ return callback(err); }}
    else{
      fs.readFile(destination, function(err, contents){
        var obj = utils.decode(contents);
        if(typeof callback === 'function'){ return callback(err, obj); }
      });
    }
  });
};

queue.prototype.claimNext = function(workerName, q, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'queues' + path.sep + q;
  fs.readdir(directory, function(err, files){
    if(err){ if(typeof callback === 'function'){ return callback(err); }}
    else if(files.length === 0){ callback(null, null); }
    else{
      self.claim(workerName, q, files[0], function(err, job){
        if(err && err.code === 'ENOENT'){
          self.claimNext(workerName, q, callback);
        }else if(typeof callback === 'function'){
          return callback(err, job);
        }
      });
    }
  });
};

queue.prototype.workers = function(callback){
  var self = this;
  var directory = self.basePath + path.sep + 'workers';
  var workerDetails = {};
  var totalWorkers = 0;
  var reportedWorkers = 0;

  var getWorkingOn = function(workerName){
    self.workingOn(workerName, function(err, payload){
      reportedWorkers++;
      workerDetails[workerName] = payload;
      if(err){ return callback(err); }
      else if(reportedWorkers === totalWorkers){
        return callback(err, workerDetails);
      }
    });
  };

  utils.subDirectories(directory, function(err, workers){
    if(err){ return callback(err); }
    else if(workers.length === 0){ return callback(null, workerDetails); }
    else{
      totalWorkers = workers.length;
      workers.forEach(function(workerName){
        getWorkingOn(workerName);
      });
    }
  });
};

queue.prototype.workingOn = function(workerName, callback){
  var self = this;
  var directory = self.basePath + path.sep + 'workers' + path.sep + workerName;
  fs.readdir(directory, function(err, files){
    if(err){ return callback(err); }
    else if(files.length === 0){ return callback(null, null); }
    else if(files.length > 1){  return callback(new Error('working on more than one item')); }
    else{
      fs.readFile(directory + path.sep + files[0], function(err, contents){
        var payoload;
        if(!err){ payload = utils.decode(contents); }
        callback(err, payload);
      });
    }
  });
};

// TODO: Requies a side-cache folder of payloads mapped to timestamps
// queue.prototype.scheduledAt = function(q, func, args, callback){ }

//

exports.queue = queue;