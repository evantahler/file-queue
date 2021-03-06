var should     = require('should');
var fs         = require('fs-extra');
var path       = require('path');
var async      = require('async');
var timekeeper = require('timekeeper');
var testDir    = '/tmp/test';

var FileQueue = require(__dirname + path.sep + '..' + path.sep + 'index.js');
var queue = new FileQueue.queue(testDir);

describe('queue', function(){

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

  it('should save the default path', function(){
    queue.basePath.should.equal(testDir);
  });

  it('can save a basic payload', function(done){
    queue.enqueue('test_queue', 'doStuffLater', {a: 1, b: 2}, function(err, filename, payload){
      should.not.exist(err);
      
      var payloadObj = JSON.parse(payload);
      payloadObj.class.should.equal('doStuffLater');
      payloadObj.queue.should.equal('test_queue');
      payloadObj.args[0].a.should.equal(1);
      payloadObj.args[0].b.should.equal(2);

      var bodyPayload = JSON.parse(fs.readFileSync(testDir + path.sep + 'queues' + path.sep + 'test_queue' + path.sep + filename));
      bodyPayload.class.should.equal('doStuffLater');
      bodyPayload.queue.should.equal('test_queue');
      bodyPayload.args[0].a.should.equal(1);
      bodyPayload.args[0].b.should.equal(2);

      done();
    });
  });

  it('can save a job for later (enqueueAt)', function(done){
    var now = new Date().getTime();
    queue.enqueueAt((now + 100), 'test_queue', 'doStuffLater', {a: 1, b: 2}, function(err, filename, payload){
      should.not.exist(err);
      
      var payloadObj = JSON.parse(payload);
      payloadObj.class.should.equal('doStuffLater');
      payloadObj.queue.should.equal('test_queue');
      payloadObj.args[0].a.should.equal(1);
      payloadObj.args[0].b.should.equal(2);

      var bodyPayload;
      bodyPayload = JSON.parse(fs.readFileSync(testDir + path.sep + 'delayed' + path.sep + Math.floor(now/1000) + path.sep + filename));
      bodyPayload.class.should.equal('doStuffLater');
      bodyPayload.queue.should.equal('test_queue');
      bodyPayload.args[0].a.should.equal(1);
      bodyPayload.args[0].b.should.equal(2);

      done();
    });
  });

  it('can save a job for later (enqueueIn)', function(done){
    var now = new Date().getTime();
    queue.enqueueIn(100, 'test_queue', 'doStuffLater', {a: 1, b: 2}, function(err, filename, payload){
      should.not.exist(err);
      
      var payloadObj = JSON.parse(payload);
      payloadObj.class.should.equal('doStuffLater');
      payloadObj.queue.should.equal('test_queue');
      payloadObj.args[0].a.should.equal(1);
      payloadObj.args[0].b.should.equal(2);

      var bodyPayload;
      try{
        bodyPayload = JSON.parse(fs.readFileSync(testDir + path.sep + 'delayed' + path.sep + Math.floor(now/1000) + path.sep + filename));
      }catch(e){
        if(e.code !== 'ENOENT'){ throw e; }
        // add a second
        bodyPayload = JSON.parse(fs.readFileSync(testDir + path.sep + 'delayed' + path.sep + (Math.floor(now/1000) + 1) + path.sep + filename));
      }
      bodyPayload.class.should.equal('doStuffLater');
      bodyPayload.queue.should.equal('test_queue');
      bodyPayload.args[0].a.should.equal(1);
      bodyPayload.args[0].b.should.equal(2);

      done();
    });
  });

  it('can inspect queues', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_b', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_c', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.queues(function(err, queues){
        should.not.exist(err);
        queues.length.should.equal(3);
        queues.indexOf('test_queue_a').should.equal(0);
        queues.indexOf('test_queue_b').should.equal(1);
        queues.indexOf('test_queue_c').should.equal(2);
        done();
      });
    });
  });

  it('can inspect timestamps', function(done){
    var now = new Date().getTime();
    async.parallel([
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 2000, 'test_queue_b', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 3000, 'test_queue_c', 'doStuffLater', {}, callback); },
    ], function(err){
      queue.timestamps(function(err, timestamps){
        should.not.exist(err);
        timestamps.indexOf(Math.floor(now/1000) + 1).should.equal(0);
        timestamps.indexOf(Math.floor(now/1000) + 2).should.equal(1);
        timestamps.indexOf(Math.floor(now/1000) + 3).should.equal(2);
        done();
      });
    });
  });

  it('can inspect queue length', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.length('test_queue_a', function(err, length){
        should.not.exist(err);
        length.should.equal(3);
        done();
      });
    });
  });

  it('can inspect timestamp length', function(done){
    var now = new Date().getTime();
    async.parallel([
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_b', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_c', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.timestampLength(Math.floor(now/1000) + 1, function(err, length){
        should.not.exist(err);
        length.should.equal(3);
        done();
      });
    });
  });

  it('can get a list of normal enqueued jobs', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.jobs('test_queue_a', function(err, jobs){
        should.not.exist(err);
        jobs.length.should.equal(3);
        done();
      });
    });
  });

  it('can get a list of delayed jobs for a timestamp', function(done){
    var now = new Date().getTime();
    async.parallel([
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_b', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_c', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.timestampJobs(Math.floor(now/1000) + 1, function(err, jobs){
        should.not.exist(err);
        jobs.length.should.equal(3);
        done();
      });
    });
  });

  it('can read the payload of normal job', function(done){
    queue.enqueue('test_queue_a', 'doStuffLater', {}, function(err, filename, payload){
      queue.readJob('test_queue_a', filename.split('.')[0], function(err, data){
        data.class.should.equal('doStuffLater');
        data.queue.should.equal('test_queue_a');
        done();
      });
    });
  });

  it('can read the payload of an delayed job', function(done){
    var now = new Date().getTime();
    queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, function(err, filename, payload){
      queue.readTimestampJob(Math.floor(now/1000) + 1, filename.split('.')[0], function(err, data){
        data.class.should.equal('doStuffLater');
        data.queue.should.equal('test_queue_a');
        done();
      });
    });
  });

  it('can delte a queue', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {}, callback); },
    ], function(err){
      queue.queues(function(err, queues){
        queues.indexOf('test_queue_a').should.equal(0);
        queue.del('test_queue_a', function(err){
          should.not.exist(err);
          queue.queues(function(err, queues){
            queue.queues(function(err, queues){
              queues.length.should.equal(0);
              done();
            });
          });
        });
      });
    });
  });

  it('can delete an item from a queue', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {a: 1}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {a: 1}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {b: 2}, callback); },
    ], function(err){
      queue.length('test_queue_a', function(err, length){
        length.should.equal(3);
        queue.delFromQueue('test_queue_a', 'doStuffLater', {a:1}, 999, function(err, deletedFiles){
          should.not.exist(err);
          deletedFiles.length.should.equal(2);
          queue.length('test_queue_a', function(err, length){
            length.should.equal(1);
            done();
          });
        });
      });
    });
  });

  it('can delete an item from all delayed imestamps', function(done){
    var now = new Date().getTime();
    async.parallel([
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 2000, 'test_queue_c', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now + 3000, 'test_queue_a', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.delFromTimestamp('test_queue_a', 'doStuffLater', {}, 999, function(err, deletedFiles){
        should.not.exist(err);
        deletedFiles.length.should.equal(2);
        done();
      });
    });
  });

  it('can promote ready delayed items (and leave future ones)', function(done){
    var now = new Date().getTime();
    async.parallel([
      function(callback){ queue.enqueueAt(now + 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now - 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
      function(callback){ queue.enqueueAt(now - 1000, 'test_queue_a', 'doStuffLater', {}, callback); },
    ], function(err){
      should.not.exist(err);
      queue.queues(function(err, queues){
        queues.length.should.equal(0);
        
        queue.promoteDelayed(function(){ // once to move the file
        queue.promoteDelayed(function(){ // again to clear the now-empty old timestamp
          queue.timestamps(function(err, timestamps){
            timestamps.length.should.equal(1);
            timestamps.indexOf(Math.floor(now/1000) + 1).should.equal(0);
            queue.queues(function(err, queues){
              queues.length.should.equal(1);
              queues[0].should.equal('test_queue_a');
              done();
            });
          });
        });
        });
      });
    });
  });

  it('can claim an item (basic)', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {a: 1}, callback); },
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {b: 2}, callback); },
    ], function(err){
      queue.length('test_queue_a', function(err, length){
        length.should.equal(2);
        queue.claimNext('testWorker', 'test_queue_a', function(err, job){
          should.not.exist(err);
          job.args[0].a.should.equal(1);
          queue.length('test_queue_a', function(err, length){
            length.should.equal(1);
            done();
          });
        });
      });
    });
  });

  it('can claim an item (contention, no errors)', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {a: 1}, callback); },
    ], function(err){

      async.parallel([
        function(callback){
          queue.claimNext('testWorker1', 'test_queue_a', callback);
        },
        function(callback){
          queue.claimNext('testWorker2', 'test_queue_a', callback);
        },
        function(callback){
          queue.claimNext('testWorker3', 'test_queue_a', callback);
        },
      ], function(err, data){
        should.not.exist(err);
        data.length.should.equal(3);
        data[0].class.should.equal('doStuffLater');
        should.equal(data[1], null);
        should.equal(data[2], null);
        queue.length('test_queue_a', function(err, length){
          length.should.equal(0);
          done();
        });
      });
    });
  });

  it('can list workers and what they are working on', function(done){
    async.parallel([
      function(callback){ queue.enqueue('test_queue_a', 'doStuffLater', {a: 1}, callback); },
    ], function(err){
      queue.claimNext('testWorker', 'test_queue_a', function(err, job){
        queue.workers(function(err, workers){
          workers.testWorker.class.should.equal('doStuffLater');
          workers.testWorker.queue.should.equal('test_queue_a');
          workers.testWorker.args[0].a.should.equal(1);
          done();
        });
      });
    });
  });

});