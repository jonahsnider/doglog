---
title: Tunable values
description: DogLog's tunable values feature makes it easy to tweak robot behavior without needing to redeploy code.
---

DogLog's tunable values feature leverages NetworkTables to stream strings, numbers, and booleans to your robot code, making it easy to tweak robot behavior without needing to redeploy code.

## Creating a tunable value

You can create a tunable value by calling `DogLog.tunable()` and providing a key for the value in NetworkTables, and a default value.

```java
// Create a tunable double with a key of "Intake/Voltage" and a default value of 4.5
private final DoubleEntry voltage = DogLog.tunable("Intake/Voltage", 4.5);

```

Creating a tunable value will return the NetworkTables entry used to interact with the tunable value.

Once a tunable value is created, DogLog will continuously log its value to the `Robot/Tunable/` table in the robot DataLog.

## Reading a tunable value

Once you've created a tunable value, you can read the value from the NetworkTables entry like so:

```java
tunableValue.get();
```

Additionally, each NetworkTables entry type implements the relevant `Supplier` interface (ex. `Supplier<String>`, `DoubleSupplier`, etc.), allowing you to seamlessly integrate tunable values into existing code.

### On change callbacks

In addition to periodically polling the latest value of a tunable, you can also register a consumer function to be called whenever the value changes.

```java
private final DoubleEntry voltage = DogLog.tunable("Intake/Voltage", 4, newVoltage -> {
	motor.setVoltage(newVoltage);
});

```

One callback can be registered per tunable value.
When the value is changed, the provided function will be called with the updated value of the tunable.

## Changing a tunable value

Once a tunable value is created in code, you can change the value via NetworkTables.

Tunable values are published under the "Tunable/" table in NetworkTables.
So, a tunable value with a key of `Intake/Voltage` would be published under the `Tunable/Intake/Voltage` key.

Here are some examples of how to change a tunable value using various popular FRC dashboards:

- [AdvantageScope](https://docs.advantagescope.org/getting-started/connect-live/#tuning-mode)
- [Elastic](https://frc-elastic.gitbook.io/docs/customizing-your-dashboard/adding-and-customizing-widgets)
- [Glass](https://docs.wpilib.org/en/stable/docs/software/dashboards/glass/networktables-connection.html#viewing-networktables-entries)
