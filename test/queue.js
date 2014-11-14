var should     = require('should');
var fs         = require('node-fs-extra');
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
        done();
      });
    }catch(e){
      if(e.code !== 'ENOENT'){ throw e; }
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
        var payload = queue.utils.encode('test_queue_a', 'doStuffLater', {a: 1});
        queue.delFromQueue(payload, 'test_queue_a', 999, function(err, deletedFiles){
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


  it('can delete an item from a timestamp');
  it('can promote ready delayed items');
  it('will not promote early delayed items');
  it('can claim an item (basic)');
  it('can claim an item (contention)');

});