// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.loggers;

import edu.wpi.first.util.struct.Struct;

public interface LogConsumer {
  public void log(String key, boolean[] value);

  public void log(String key, boolean value);

  public void log(String key, double[] value);

  public void log(String key, double value);

  public void log(String key, float[] value);

  public void log(String key, float value);

  public void log(String key, int[] value);

  public void log(String key, long[] value);

  public void log(String key, int value);

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(String key, String[] value);

  public void log(String key, String value);

  public <T> void log(String key, Struct<T> struct, T[] value);

  public <T> void log(String key, Struct<T> struct, T value);
}
