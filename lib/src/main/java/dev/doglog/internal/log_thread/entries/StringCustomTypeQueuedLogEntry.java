// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

// Custom class instead of just making StringQueuedLogEntry generic so that there's less runtime
// cost to check what kind of string log to do.
public class StringCustomTypeQueuedLogEntry extends BaseQueuedLogEntry {
  public final String value;
  public final String customTypeString;

  public StringCustomTypeQueuedLogEntry(
      String key, long timestamp, String value, String customTypeString) {
    super(EntryType.STRING_CUSTOM_TYPE, key, timestamp);
    this.value = value;
    this.customTypeString = customTypeString;
  }
}
