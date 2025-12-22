package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class BooleanArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final boolean[] value;

  public BooleanArrayQueuedLogEntry(String key, long timestamp, boolean[] value) {
    super(EntryType.BOOLEAN_ARRAY, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
