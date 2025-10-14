---
title: RISKY_QUEUE_RESIZE
description: Description and solution for the DogLog RISKY_QUEUE_RESIZE warning.
---

## Description

By default, DogLog uses a separate thread for handling log operations.
When that thread is enabled, each call to `DogLog#log()` is queued for asynchronous processing.
If the queue capacity is reduced, you are at risk of having log entries dropped.

If you disable the log thread with [`DogLogOptions#withUseLogThread(false)`](https://javadoc.doglog.dev/dev/doglog/DogLogOptions.html#withUseLogThread(boolean)), the queue is not used and this warning does not apply.

This warning on its own is not a problem, but ignoring it may lead to other issues like [`QUEUE_RESIZE_DROPPED_LOGS`](/reference/errors/queue_resize_dropped_logs).
