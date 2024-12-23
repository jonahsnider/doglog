// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.reporters;

import edu.wpi.first.util.struct.Struct;

public interface Reporter {
  public void log(long timestamp, String key, boolean[] value);

  public void log(long timestamp, String key, boolean value);

  public void log(long timestamp, String key, double[] value);

  public void log(long timestamp, String key, double value);

  public void log(long timestamp, String key, float[] value);

  public void log(long timestamp, String key, float value);

  public void log(long timestamp, String key, long[] value);

  public void log(long timestamp, String key, long value);

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value);

  public void log(long timestamp, String key, String value);

  public void log(long timestamp, String key, String value, String customTypeString);

  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value);

  public <T> void log(long timestamp, String key, Struct<T> struct, T value);
}
