// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

public abstract class BaseQueuedLogEntry {
  public final String key;
  public final long timestamp;

  protected BaseQueuedLogEntry(String key, long timestamp) {
    this.key = key;
    this.timestamp = timestamp;
  }
}
