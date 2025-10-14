---
title: QUEUE_RESIZE_DROPPED_LOGS
description: Description and solution for the DogLog QUEUE_RESIZE_DROPPED_LOGS error.
---

## Description

By default, DogLog uses a separate thread for handling log operations.
When that thread is enabled, each call to `DogLog#log()` is added to a queue to be processed in the background.

This error occurs when the queue capacity is reduced, and there are too many unprocessed logs to fit in the queue.
When this happens, logs are dropped, meaning they are lost and not processed.

If you disable the log thread with [`DogLogOptions#withUseLogThread(false)`](<https://javadoc.doglog.dev/dev/doglog/DogLogOptions.html#withUseLogThread(boolean)>), the queue is not used and this error will not occur.

## Solution

To avoid this error, you can try the following:

- Resize the queue when there are less pending log entries in the queue
- Don't reduce the queue capacity so much
