// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public class StringArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final String[] value;

  public StringArrayQueuedLogEntry(String key, long timestamp, String[] value) {
    super(EntryType.STRING_ARRAY, key, timestamp);
    this.value = value;
  }
}
