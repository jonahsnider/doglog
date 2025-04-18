package dev.doglog.internal.log_thread.entries;

import edu.wpi.first.util.struct.StructSerializable;

public class StructArrayQueuedLogEntry<T extends StructSerializable> extends BaseQueuedLogEntry {
  public final T[] value;

  public StructArrayQueuedLogEntry(String key, long timestamp, T[] value) {
    super(EntryType.STRUCT_ARRAY, key, timestamp);
    this.value = value;
  }
}
