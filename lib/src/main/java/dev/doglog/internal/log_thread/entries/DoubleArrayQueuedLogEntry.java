// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class DoubleArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final double[] value;

  public DoubleArrayQueuedLogEntry(String key, long timestamp, double[] value) {
    super(EntryType.DOUBLE_ARRAY, key, timestamp);
    this.value = value;
  }
}
