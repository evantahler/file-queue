var path   = require('path');
var fs     = require('node-fs-extra');
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

    var checkDir = function(err, f, stats){
      if(!err && stats.isDirectory()){
        directories.push(f);
      }
      started--;
      if(started === 0){
        directories.sort();
        callback(err, directories);
      }
    };

    fs.readdir(p, function(err, files){
      if(files.length === 0){
        return callback(err, directories);
      }
      files.forEach(function(f){
        started++;
        fs.stat(p + path.sep + f, function(err, stats){
          checkDir(err, f, stats);
        });
      });
    });
  },

  encode: function(q, func, args){
    args = utils.arrayify(args);
    return JSON.stringify({
      "class": func,
      queue: q,
      args: args || []
    }, null, 2);
  },

  decode: function(payload){

  },

};

exports.utils = utils;