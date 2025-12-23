package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class EnumArrayQueuedLogEntry<E extends Enum<E>> extends BaseQueuedLogEntry {
  public final E[] value;

  public EnumArrayQueuedLogEntry(String key, long timestamp, E[] value) {
    super(EntryType.ENUM_ARRAY, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
