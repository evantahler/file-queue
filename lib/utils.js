var path   = require('path');
var fs     = require('fs');
 var utils = {

  sanitizePath: function(p){
    return path.resolve(path.normalize(p));
  },

  arrayify: function(o){
    if( Array.isArray(o) ) {
      return o;
    }else{
      return [o];
    }
  },

  subDirectories: function(p, callback){
    var directories = [];
    var started = 0;
    
    var checkDir = function(err, stats){
      if(stats.isDirectory()){
        directories.push(f);
      }
      started--;
      if(started === 0){
        callback(err, directories);
      }
    };

    fs.readdir(p, function(err, files){
      files.forEach(function(f){
        started++;
        fs.stat(checkDir);
      });
    });
  }

};

exports.utils = utils;