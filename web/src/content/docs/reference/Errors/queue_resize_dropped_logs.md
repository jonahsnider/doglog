---
title: QUEUE_RESIZE_DROPPED_LOGS
description: Description and solution for the DogLog QUEUE_RESIZE_DROPPED_LOGS error.
---

## Description

To achieve better performance, DogLog uses a separate thread for handling log operations.
Each time you call `DogLog#log()`, the log is added to a queue to be processed by the log thread.

This error occurs when the queue capacity is reduced, and there are too many unprocessed logs to fit in the queue.
When this happens, logs are dropped, meaning they are lost and not processed.

## Solution

To avoid this error, you can try the following:

- Resize the queue when there are less pending log entries in the queue
- Don't reduce the queue capacity so much
