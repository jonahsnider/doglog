package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class RecordQueuedLogEntry<T extends Record> extends BaseQueuedLogEntry {
  public final T value;

  public RecordQueuedLogEntry(String key, long timestamp, T value) {
    super(EntryType.RECORD, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
