// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class IntegerQueuedLogEntry extends BaseQueuedLogEntry {
  public final long value;

  public IntegerQueuedLogEntry(String key, long timestamp, long value) {
    super(EntryType.INTEGER, key, timestamp);
    this.value = value;
  }
}
