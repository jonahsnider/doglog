// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class IntegerArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final long[] value;

  public IntegerArrayQueuedLogEntry(String key, long timestamp, long[] value) {
    super(EntryType.INTEGER_ARRAY, key, timestamp);
    this.value = value;
  }

  public IntegerArrayQueuedLogEntry(String key, long timestamp, int[] value) {
    this(key, timestamp, new long[value.length]);

    for (int i = 0; i < value.length; i++) {
      this.value[i] = value[i];
    }
  }
}
