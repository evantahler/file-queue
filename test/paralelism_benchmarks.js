var should     = require('should');
var fs         = require('fs-extra');
var path       = require('path');
var async      = require('async');
var timekeeper = require('timekeeper');
var testDir    = '/tmp/test';

var FileQueue = require(__dirname + path.sep + '..' + path.sep + 'index.js');
var queue = new FileQueue.queue(testDir);

// For higher parallelism, you will need to change the max file pointers... 
var BENCHMARK_COUNT = 100;

describe('parallelism benchmarks', function(){

  afterEach(function(){
    timekeeper.reset();
  });

  beforeEach(function(done){
    timekeeper.freeze(new Date().getTime());
    try{
      fs.remove(testDir, function(){
        queue.ensureDirs();
        done();
      });
    }catch(e){
      if(e.code !== 'ENOENT'){ throw e; }
      queue.ensureDirs();
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

  it('many workers ('+BENCHMARK_COUNT+') can claim many jobs without a collision', function(done){
    //TODO: This test should really involve forking and new processes... 

    var i;
    var loadFuncs = [];
    var workFuncs = [];

    i = 0;
    while(i < BENCHMARK_COUNT){
      (function(i){
      loadFuncs.push(function(callback){
        queue.enqueue('test_queue', 'doStuffLater', {a: i}, function(){ callback(); });
      });})(i);
      i++;
    }

    i = 0;
    while(i < BENCHMARK_COUNT){
      (function(i){
      workFuncs.push(function(callback){
        queue.claimNext(('worker_' + i), 'test_queue', function(err, job){ 
          callback(err, job); 
        });
      });})(i);
      i++;
    }

    async.parallel(loadFuncs, function(){
      async.parallel(workFuncs, function(errs, jobs){
        should.not.exist(errs);
        var counter = 0;
        var foundCounters = [];
        jobs.forEach(function(job){
          job.class.should.equal('doStuffLater');
          foundCounters.push(job.args[0].a);
          counter++;
        });

        foundCounters = foundCounters.filter(function (e, i, arr) {
            return foundCounters.lastIndexOf(e) === i;
        });
        foundCounters.length.should.equal(BENCHMARK_COUNT);

        done();
      });
    });
  });

  it('many scuedulers ('+BENCHMARK_COUNT+') can all promote delayed jobs without coliding', function(done){
    var i;
    var now = new Date().getTime();
    var loadFuncs = [];
    var workFuncs = [];

    i = 0;
    while(i < BENCHMARK_COUNT){
      (function(i){
      loadFuncs.push(function(callback){
        queue.enqueueAt((now - 1000 - (i*1000)), 'test_queue', 'doStuffLater', {a: i}, function(){ callback(); });
      });})(i);
      i++;
    }

    i = 0;
    while(i < (BENCHMARK_COUNT * 2)){
      (function(i){
      workFuncs.push(function(callback){
        queue.promoteDelayed( function(err){ callback(err); });
      });})(i);
      i++;
    }

    async.parallel(loadFuncs, function(){
      async.series(workFuncs, function(errs){
        should.not.exist(errs);
        fs.readdir(testDir + path.sep + 'queues' + path.sep + 'test_queue', function(err, files){
          files.length.should.equal(BENCHMARK_COUNT);
          done();
        });
      });
    });
  });

});