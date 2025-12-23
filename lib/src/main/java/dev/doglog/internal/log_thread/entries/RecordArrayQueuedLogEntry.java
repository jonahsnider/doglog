package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class RecordArrayQueuedLogEntry<T extends Record> extends BaseQueuedLogEntry {
  public final T[] value;

  public RecordArrayQueuedLogEntry(String key, long timestamp, T[] value) {
    super(EntryType.RECORD_ARRAY, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
