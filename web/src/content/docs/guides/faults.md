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

### Alerts

By default, faults are also reported as [WPILib persistent alerts](https://docs.wpilib.org/en/stable/docs/software/telemetry/persistent-alerts.html), with the "error" urgency.

You can customize what urgency to report the alerts as by providing an `AlertType` value to `DogLog.logFault()`:

```java
DogLog.logFault("Arm not homed", AlertType.kWarning);
```

Or if you'd like to disable reporting the fault using alerts, you can pass `null` as the alert urgency:

```java
DogLog.logFault("Command timeout", null);
```

### Marking a fault as resolved

For some faults, it might make sense to have it be active or inactive (ex. a camera is offline temporarily).

`DogLog.logFault()` counts each time a fault is reported, and tracks the number of times a fault has occurred.

To decrease the count of a fault by 1, call `DogLog.decreaseFault()`:

```java
DogLog.decreaseFault("Camera offline");
```

If you want to fully reset the count for a fault to 0, you can use `DogLog.clearFault()`:

```java
DogLog.clearFault("Camera offline");
```

Once a fault's count is 0, the alert associated with it (if present) will be marked inactive.

### Using enums for faults

You can also represent faults with an enum type, and log them that way:

```java
public enum RobotFault {
	CAMERA_OFFLINE,
	AUTO_SHOT_TIMEOUT_TRIGGERED,
	BROWNOUT,
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
Faults that are currently active are logged under `Robot/Faults/Active`.

You can programmatically check if faults have occurred by calling `DogLog.faultsLogged()`.
This could be used for something like changing the color of the robot LEDs to indicate that a fault has occurred.

## Fault review process

Just like how having post-match checklists for physical maintenance improve reliability, checking the logs after matches helps catch software issues that otherwise may go unnoticed.

Faults logging means it's easy to add a step to your post-match process where someone pulls the robot logs, and then checks if theres anything under `Robot/Faults`.
If a fault was recorded, you can use other logged fields to help diagnose the issue further.
