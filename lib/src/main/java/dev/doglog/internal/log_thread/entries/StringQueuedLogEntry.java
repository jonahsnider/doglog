package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class StringQueuedLogEntry extends BaseQueuedLogEntry {
  public final String value;

  public StringQueuedLogEntry(String key, long timestamp, String value) {
    super(EntryType.STRING, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
