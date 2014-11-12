var path  = require('path');

exports.utils = {

  sanitizePath: function(p){
    return path.resolve(path.normalize(p));
  },

  arrayify: function(o){
    if( Array.isArray(o) ) {
      return o;
    }else{
      return [o];
    }
  }

}