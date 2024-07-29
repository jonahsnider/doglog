// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class FloatArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final float[] value;

  public FloatArrayQueuedLogEntry(String key, long timestamp, float[] value) {
    super(EntryType.FLOAT_ARRAY, key, timestamp);
    this.value = value;
  }
}
