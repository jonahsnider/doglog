---
title: MAX_QUEUED_LOGS
description: Description and solution for the DogLog MAX_QUEUED_LOGS error.
---

## Description

To achieve better performance, DogLog uses a separate thread for handling log operations.
Each time you call `DogLog#log()`, the log is added to a queue to be processed by the log thread.
If too many logs are added to the queue before they can be processed, the queue becomes full and logs can't be added.

## Solution

To avoid this error, you can try the following:

- Reduce the number of logs being added to the queue, especially in short bursts
- Increase the queue capacity in the configured DogLog options
  - [Read more about how to configure this option here](/reference/configuring#log-entry-queue-capacity)
  - [Relevant JavaDoc page for this option](<https://javadoc.doglog.dev/dev/doglog/doglogoptions#withLogEntryQueueCapacity(int)>)
