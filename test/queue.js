var should  = require('should');
var fs      = require('node-fs-extra');
var path    = require('path');
var async   = require('async');
var testDir = '/tmp/test';

var FileQueue = require(__dirname + path.sep + '..' + path.sep + 'index.js');
var queue = new FileQueue.queue(testDir);

var cleanup = function(callback){
  try{
    fs.remove(testDir, function(){
      callback();
    });
  }catch(e){
    if(e.code !== 'ENOENT'){ throw e; }
  }
};

describe('queue', function(){

  beforeEach(function(done){
    cleanup(done);
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

  it('can save many jobs quickly without a name collision', function(done){
    var i = 0;
    var funcs = [];
    while(i < 100){
      funcs.push(function(callback){
        queue.enqueue('test_queue', 'doStuffLater', {a: 1, b: 2}, function(){
          callback();
        });
      });
      i++;
    }
    async.parallel(funcs, function(){
      fs.readdir(testDir + path.sep + 'queues' + path.sep + 'test_queue', function(err, files){
        should.not.exist(err);
        files.length.should.equal(100);
        done();
      });
    });
  });

  it('can save a job for later (enqueueAt)');
  it('can save a job for later (enqueueIn)');
  it('can inspect queues');
  it('can inspect timestamps');
  it('can inspect queue length');
  it('can inspect timestamp length');
  it('can delte a queue');
  it('can delte an item from a queue');
  it('can delte an item from a timestamp');
  it('can promote ready delayed items');
  it('will not promote early delayed items');
  it('can claim an item (basic)');
  it('can claim an item (contention)');

});