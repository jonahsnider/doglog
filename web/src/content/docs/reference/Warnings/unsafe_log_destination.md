---
title: UNSAFE_LOG_DESTINATION
description: Description and solution for the DogLog UNSAFE_LOG_DESTINATION warning.
---

## Description

DogLog uses WPILib's `DataLogManager` to manage writing logs to `.wpilog` files.
If a properly formatted USB drive is plugged into the roboRIO, `DataLogManager` will automatically store logs there.
Otherwise, logs will be stored on the roboRIO's storage.

On a roboRIO 2, this means logs will be written to the microSD card.
This makes it impossible to easily access logs without having the robot powered on to download them, but other than that, is a valid way to store logs.

On a roboRIO 1, however, this means logs will be written to the internal flash storage.
Flash memory like the one on the roboRIO 1 can only support a limited number of write cycles in its lifetime, before writes will fail.
Without a USB to use for logs, there is a risk of bricking the roboRIO from the increased write load caused by logging.

This warning will be recorded when DogLog is being used on a roboRIO 1 without a properly formatted USB drive attached.

## Solution

Plugging in a properly formatted USB drive into the roboRIO will prevent this warning from being recorded the next time your robot code starts up.
