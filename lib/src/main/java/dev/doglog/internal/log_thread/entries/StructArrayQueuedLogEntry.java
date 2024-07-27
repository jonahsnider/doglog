// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

import edu.wpi.first.util.struct.StructSerializable;

public class StructArrayQueuedLogEntry<T extends StructSerializable> extends BaseQueuedLogEntry {
  public final T[] value;

  public StructArrayQueuedLogEntry(String key, long timestamp, T[] value) {
    super(EntryType.STRUCT_ARRAY, key, timestamp);
    this.value = value;
  }
}
