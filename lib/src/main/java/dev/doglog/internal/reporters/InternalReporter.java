// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.reporters;

import edu.wpi.first.util.struct.Struct;

public interface InternalReporter extends BaseReporter {
  <T> void log(String key, Struct<T> struct, T[] value);

  <T> void log(String key, Struct<T> struct, T value);
}
