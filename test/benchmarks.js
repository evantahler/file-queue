var should     = require('should');
var fs         = require('node-fs-extra');
var path       = require('path');
var async      = require('async');
var timekeeper = require('timekeeper');
var testDir    = '/tmp/test';

var FileQueue = require(__dirname + path.sep + '..' + path.sep + 'index.js');
var queue = new FileQueue.queue(testDir);

var BENCHMARK_COUNT = 1000;

describe('benchmarks', function(){

  afterEach(function(){
    timekeeper.reset();
  });

  beforeEach(function(done){
    timekeeper.freeze(new Date().getTime());
    try{
      fs.remove(testDir, function(){
        done();
      });
    }catch(e){
      if(e.code !== 'ENOENT'){ throw e; }
      done();
    }
  });

  it('can save many ('+BENCHMARK_COUNT+') jobs quickly without a name collision', function(done){
    var i = 0;
    var funcs = [];
    while(i < BENCHMARK_COUNT){
      funcs.push(function(callback){
        queue.enqueue('test_queue', 'doStuffLater', {a: 1, b: 2}, function(){ callback(); });
      });
      i++;
    }
    async.parallel(funcs, function(){
      fs.readdir(testDir + path.sep + 'queues' + path.sep + 'test_queue', function(err, files){
        should.not.exist(err);
        files.length.should.equal(BENCHMARK_COUNT);
        done();
      });
    });
  });

});