// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable.on_change;

import java.util.function.LongConsumer;

public record LongOnChange(LongConsumer onChange, long defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
