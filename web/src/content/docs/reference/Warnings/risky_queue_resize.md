---
title: RISKY_QUEUE_RESIZE
description: Description and solution for the DogLog RISKY_QUEUE_RESIZE warning.
---

## Description

To achieve better performance, DogLog uses a separate thread for handling log operations.
Each time you call `DogLog#log()`, the log is added to a queue to be processed by the log thread.
If the queue capacity is reduced, you are at risk of having log entries dropped.

This warning on its own is not a problem, but ignoring it may lead to other issues like [`QUEUE_RESIZE_DROPPED_LOGS`](/reference/errors/queue_resize_dropped_logs).
