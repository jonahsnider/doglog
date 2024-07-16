// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.reporters;

public interface BaseReporter {
  void log(String key, boolean[] value);

  void log(String key, boolean value);

  void log(String key, double[] value);

  void log(String key, double value);

  void log(String key, float[] value);

  void log(String key, float value);

  void log(String key, long[] value);

  void log(String key, long value);

  void log(String key, String[] value);

  void log(String key, String value);
}
