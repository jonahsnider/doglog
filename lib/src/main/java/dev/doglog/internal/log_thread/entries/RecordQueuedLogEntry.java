package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class RecordQueuedLogEntry<T extends Record> extends BaseQueuedLogEntry {
  public final T value;

  public RecordQueuedLogEntry(String key, boolean forceNt, long timestamp, T value) {
    super(EntryType.RECORD, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
