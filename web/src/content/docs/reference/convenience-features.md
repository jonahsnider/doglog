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
