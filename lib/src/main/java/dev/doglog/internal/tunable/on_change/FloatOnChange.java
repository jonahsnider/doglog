// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable.on_change;

import edu.wpi.first.util.function.FloatConsumer;

public record FloatOnChange(FloatConsumer onChange, float defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
