package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class StringQueuedLogEntry extends BaseQueuedLogEntry {
  public final String value;

  public StringQueuedLogEntry(String key, boolean forceNt, long timestamp, String value) {
    super(EntryType.STRING, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
