---
title: Convenience features
description: Features that make logging easier and help with common use cases.
---

DogLog includes a few convenience features that can help speed up common logging flows, mostly related to debugging during active development.

## Logging timestamps

Suppose you have a function, and you want to log each time the function is called.

You can use `DogLog.timestamp()` to log the current timestamp to a key like so:

```java
DogLog.timestamp("MyClass/MyFunction");
```

Because timestamps are unique & monotonically increasing, you can graph the value of the logged timestamp.
Each step in the graph represents one time the function was called, making it easier to answer questions like "when is this function being called?".

## Tracking execution time

A common use case for logging is to track how long a subsystem, command, or function takes to execute.
DogLog makes this easy with the `DogLog.time()` and `DogLog.timeEnd()` functions.

```java
// Start the timer
DogLog.time("MyClass/MyFunction");

myClass.myFunction();

// Stop the timer and log the recorded duration
DogLog.timeEnd("MyClass/MyFunction");
```

### Tracking command execution

DogLog includes a helper function that wraps a command with calls to `DogLog.time()` and `DogLog.timeEnd()` to track how long a command takes to execute.

```java
var timedCommand = DogLog.time("MyClass/MyCommand", myClass.myCommand());

```
