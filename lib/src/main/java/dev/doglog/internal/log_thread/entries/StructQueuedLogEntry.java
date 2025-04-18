package dev.doglog.internal.log_thread.entries;

import edu.wpi.first.util.struct.StructSerializable;

public class StructQueuedLogEntry<T extends StructSerializable> extends BaseQueuedLogEntry {
  public final T value;

  public StructQueuedLogEntry(String key, long timestamp, T value) {
    super(EntryType.STRUCT, key, timestamp);
    this.value = value;
  }
}
