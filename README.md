# File-Queue
[![Build Status](https://travis-ci.org/evantahler/file-queue.svg?branch=master)](https://travis-ci.org/evantahler/file-queue)

A [resque-like](https://github.com/resque/resque) queue system based on flat files.

## What?
Many applications rely on a distributed queue to process delayed jobs and schedules.  Historically, these systems are based on a remote database for persistence.  They allow for high-throughput and atomic operations.  However, there are times when durability might mater more than speed.  

File-Queue starts with persistence at its core. Every operation *is* a disk operation, and all state information *is* a file.  There are many great ways to **mount a remote file system** (NFS, S3, Fuse, etc) to your application servers.  Let them handle the heavy lifting.

## Pros + Cons
### Pros
- Persistence every operation
- Easier introspection (`ls`, `grep`, and all the normal *nix tools)
- Larger storage (doesn't need to fit in RAM)

### Cons
- Often slower than communicating with redis
- Requires a mounted remote drive (usually not possible in heroku-like deployments)

## Benchmarks (compared to ruby-resque with a local redis server)
TODO

## API

### Queue Methods

##### `new queue(basePath)`
- create a new queue object.  
- `basePath` is the (absolute) directory of your queue.
- On init, some folders will be created (workers, queues, and delayed)

#### Normal Queue

##### `queue.enqueue(q, func, args, callback)`
- `q` is the name of the queue (like `emails` or `high`)
- `func` is the worker method to be called 
- `args` is an array of arguments to pass to `func`
- `callback` will be returned `callback(err, filename, payload)`

##### `queue.queues(callback)`
- `callback` will be returned `callback(err, queueNames)` where queueNames is an array

##### `queue.length(q, callback)`
- returns a count of jobs in a given queue
- `callback` will be returned `callback(err, length)`

##### `queue.jobs(q, callback)`
- returns the names of jobs in a given queue
- `callback` will be returned `callback(err, jobs)`

##### `queue.readJob(q, jobName, callback)`
- returns the payload of a named job in a given queue
- `callback` will be returned `callback(err, job)`

##### `queue.del(q, callback)`
- deletes a queue, and any/all jobs in that queue
- `callback` will be returned `callback(err)`

##### `queue.delFromQueue(q, func, args, count, callback)`
- deletes n (count) jobs from a queue matching the arguments provided
- `callback` will be returned `callback(err, deletedFiles)` where deletedFiles is an array of job names

##### `queue.promoteDelayed(callback)`
- checks if any delayed timestamp queue is eligible to be run now, and if so, moves those jobs to the proper queue.  Subsequent runs of this method will also delete empty old queue directories.
- `callback` will be returned `callback(err)`


#### Delayed Queue

##### `queue.enqueueAt(timestamp, q, func, args, callback)`
- `timestamp` is the js timestamp (microseconds) you want the job to run
- `q` is the name of the queue (like `emails` or `high`)
- `func` is the worker method to be called 
- `args` is an array of arguments to pass to `func`
- `callback` will be returned `callback(err, filename, payload)`

##### `queue.enqueueIn(time, q, func, args, callback)`
- `time` is the microseconds from now you want the job to run
- `q` is the name of the queue (like `emails` or `high`)
- `func` is the worker method to be called 
- `args` is an array of arguments to pass to `func`
- `callback` will be returned `callback(err, filename, payload)`

##### `queue.timestamps(callback)`
- `callback` will be returned `callback(err, timestamps)` where timestamps is an array

##### `queue.timestampLength(timestamp, callback)`
- returns a count of jobs in a given delayed timestamp (in seconds) queue
- `callback` will be returned `callback(err, length)`

##### `queue.timestampJobs(timestamp, callback)`
- returns the names of jobs in a given timestamp (in seconds) queue
- `callback` will be returned `callback(err, jobs)`

##### `queue.readTimestampJob(timestamp, jobName, callback)`
- returns the payload of a named job in a given timestamp (in seconds) queue
- `callback` will be returned `callback(err, job)`

##### `queue.delFromTimestamp(q, func, args, count, callback)`
- deletes n (count) jobs from **all** timestamps matching the arguments provided
- `callback` will be returned `callback(err, deletedFiles)` where deletedFiles is an array of job names

#### Worker Methods

##### `queue.claimNext(workerName, q, callback)`
- used to "claim" a job by moving it in a contention-proof manner into a work queue for this workerName
- `callback` will be returned `callback(err, job)`.  Job will be null if there are no jobs or the contention check failed.

##### `queue.claim(workerName, q, filename, callback)`
- used to "claim" a job by moving it in a contention-proof manner into a work queue for this workerName
- `callback` will be returned `callback(err, job)`.  Job will be null if there are no jobs or the contention check failed.

##### `queue.workers(callback)`
- list all the workers in the system, and what job (if anything) they are working on
- `callback` will be returned `callback(err, workerDetails)`.  `workerDetails` is a hash where the keys are the worker names and the values are the parsed job details.

##### `queue.prototype.workingOn(workerName, callback)`
- inspect what a named worker is working on (if anything)
- `callback` will be returned `callback(err, job)`.

### Scheduler Methods 
TODO

### Worker Methods
TODO

## Topology Guide
- local disk
- mounted disk (NFS, AFS, etc)
- [S3 via FUSE](https://github.com/s3fs-fuse/s3fs-fuse)
- Hadoop
