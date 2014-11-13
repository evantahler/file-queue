# File-Queue
A [resque-like](https://github.com/resque/resque) queue system based on flat files.

## What?
Many applications rely on a distributed queue to process delayed jobs and schedules.  Historically, these systems are based on a remote database for persistence.  They allow for high-throughput and atomic operations.  However, there are times when durability might mater more than speed.  

File-Queue starts with persistence at its core. Every operation *is* a disk operation, and all state information *is* a file.  There are many great ways to mount a remote file system to your application servers.  Let them handle the heavy lifting.

## Pros + Cons
### Pros
- Persistence every operation
- Easier introspection (ls, grep, and all the normal *nix tools)
- Larger storage (doesn't need to fit in RAM)

### Cons
- Slower than talking with redis
- Requires a mounted remote drive (not possible in heroku-like deployments)

## Benchmarks (compared to ruby-resque with a local redis server)
TODO

## API
TODO

- enqueue stuff
- run the scheduler
- run the worker

## Topology Guide
- local disk
- mounted disk (NFS, AFS, etc)
- [S3 via FUSE](https://github.com/s3fs-fuse/s3fs-fuse)
- Hadoop