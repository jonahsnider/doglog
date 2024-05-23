---
title: Logging faults
description: Catch issues faster with faults logging.
---

DogLog's faults logging functionality makes catching robot issues fast & simple.

## Logging faults

You can record a fault by calling `DogLog.logFault()`:

```java
DogLog.logFault("Camera offline");
```

You can also represent faults with an enum type, and log them that way:

```java
public enum RobotFault {
    CAMERA_OFFLINE,
    AUTO_SHOT_TIMEOUT_TRIGGERED,
    BROWNOUT;
}
```

```java
DogLog.logFault(RobotFault.CAMERA_OFFLINE);
```

## Viewing faults

Faults are logged under the `Robot/Faults` key and can be accessed like any other logged field.

The count of how many times a fault has occurred is logged under `Robot/Faults/Counts/<fault name>`.
Graphing this can help show when a fault is occurring.

An array of all the faults that have been seen is logged under `Robot/Faults/Seen`.

You can programmatically check if faults have occurred by calling `DogLog.faultsLogged()`.
This could be used for something like changing the color of the robot LEDs to indicate that a fault has occurred.

## Fault review process

Just like how having post-match checklists for physical maintenance improve reliability, checking the logs after matches helps catch software issues that otherwise may go unnoticed.

Faults logging means it's easy to add a step to your post-match process where someone pulls the robot logs checks if theres anything under `Robot/Faults`.

If a fault was recorded, you can use other logged fields to help diagnose the issue further.
