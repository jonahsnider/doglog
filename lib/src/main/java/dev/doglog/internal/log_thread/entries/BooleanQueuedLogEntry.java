// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class BooleanQueuedLogEntry extends BaseQueuedLogEntry {
  public final boolean value;

  public BooleanQueuedLogEntry(String key, long timestamp, boolean value) {
    super(EntryType.BOOLEAN, key, timestamp);
    this.value = value;
  }
}
