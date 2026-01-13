package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;
import edu.wpi.first.util.struct.StructSerializable;

public class StructArrayQueuedLogEntry<T extends StructSerializable> extends BaseQueuedLogEntry {
  public final T[] value;

  public StructArrayQueuedLogEntry(String key, boolean forceNt, long timestamp, T[] value) {
    super(EntryType.STRUCT_ARRAY, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
