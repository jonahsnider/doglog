package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class StringArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final String[] value;

  public StringArrayQueuedLogEntry(String key, boolean forceNt, long timestamp, String[] value) {
    super(EntryType.STRING_ARRAY, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
