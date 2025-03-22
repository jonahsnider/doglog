---
title: FAQ
description: Frequently asked questions about using DogLog.
---

## What's the difference between DogLog and other logging libraries?

Within the FRC software ecosystem, there are three main solutions for logging: DogLog, AdvantageKit, and Epilogue.

Here's a quick breakdown of the differences between each library:

|                               | DogLog                                                                   | AdvantageKit                                                                                                             | Epilogue                                     |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Creator                       | Team 581                                                                 | Team 6328                                                                                                                | WPILib                                       |
| Logging pattern               | [`DogLog.log()`](/getting-started/usage#logging)                         | [IO interfaces](https://docs.advantagekit.org/data-flow/recording-inputs/io-interfaces) and annotations                  | Annotations                                  |
| Use case                      | Simplest logging possible                                                | [Replaying logs in simulation](https://docs.advantagekit.org/getting-started/what-is-advantagekit/)                      | Log every public or private field in a class |
| Customizable log destinations | [Yes (NT and datalog)](/reference/configuring/#networktables-publishing) | [Yes (NT and datalog)](https://docs.advantagekit.org/getting-started/installation/existing-projects#robot-configuration) | No (NT always on, datalog can be toggled)    |
| Multithreading                | Yes (log processing thread)                                              | Yes (log processing thread)                                                                                              | No                                           |
| Tunable values                | [Yes](/guides/tunable-values)                                            | [Yes](https://docs.advantagekit.org/data-flow/recording-inputs/dashboard-inputs/)                                        | No                                           |
| Supported language            | Java                                                                     | Java                                                                                                                     | Java                                         |

One thing to note is that while it may technically be possible to use DogLog in combination with other logging libraries, this is definitely not recommended.
You will almost certainly encounter bugs or other compatibility issues as a result.

## Who uses DogLog?

DogLog is used by teams across the FRC community for a variety of purposes.
Here's a selection of DogLog users with open-source robot code you can review for inspiration:

- [Team 4522 - Team SCREAM](https://www.thebluealliance.com/team/4522), extends DogLog to [support logging fields at different frequencies](https://github.com/TeamSCREAMRobotics/4522_2025Competition/blob/5e15fb5ddbe254524759e0cf7a9c4714a160b48d/src/main/java/frc2025/logging/Logger.java) to minimize loop times
- [Team 3847 - Spectrum](https://www.thebluealliance.com/team/3847), uses [their Telemetry class](https://github.com/Spectrum3847/2025-Spectrum/blob/15fe02ad68d86d82df43b5a81ded2fdb2bf3036b/src/main/java/frc/spectrumLib/Telemetry.java) to seamlessly integrate priority levels, `Command` logging, etc., with DogLog's extensible API
- [Team 9496 - LYNK](https://www.thebluealliance.com/team/9496), breaks down triggers for high-level logic by [logging their main robot state](https://github.com/LynkRobotics/RobotCode2025/blob/747012aab2138378f4c0545704f1fb9f258a5350/src/main/java/frc/robot/subsystems/RobotState.java#L296-L301) with DogLog

And of course,

- [Team 581 - Blazing Bulldogs](https://www.thebluealliance.com/team/581), uses DogLog to [provide visibility into robot automation](https://github.com/team581/2024-offseason-bot/blob/4ba4c17f4e07bb44fb5cb433b1519f07246e390a/src/main/java/frc/robot/robot_manager/RobotManager.java#L415-L426), accelerating development at home and improving reliability at competitions

## What should I log?

It can be tempting to simply throw every possible piece of data at DogLog, but often times this causes more problems than it solves. While DogLog is highly optimized for performant logging, there is a point where the roboRIO simply can't keep up.

Take a look at all the fields you are logging, and think about whether or not they're actually useful for your team. Here's a few examples:

- Several debug logs added when first doing robot bring-up, which aren't relevant anymore
- Logging more values than necessary for every motor (ex. temperature, stator current, supply current, applied voltage, velocity, etc.)
- [Capturing all NetworkTables values](/reference/configuring#capture-networktables), instead of just manually logging the handful of relevant fields

## How can I get help with DogLog?

Feel free to [open a GitHub issue](https://github.com/jonahsnider/doglog/issues/new) if you've found a bug or there's a feature request you'd like to see.

If you have questions about DogLog, how to use it, or anything else, you can [start a GitHub discussion](https://github.com/jonahsnider/doglog/discussions/new?category=q-a) or create a reply on the [DogLog Chief Delphi thread](https://www.chiefdelphi.com/t/announcing-doglog-simpler-logging-for-frc/469056?u=jonahsnider).
