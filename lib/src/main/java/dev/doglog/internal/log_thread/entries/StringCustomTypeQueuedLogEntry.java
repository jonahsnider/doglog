package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

// Custom class instead of just making StringQueuedLogEntry generic so that there's less runtime
// cost to check what kind of string log to do.
public class StringCustomTypeQueuedLogEntry extends BaseQueuedLogEntry {
  public final String value;
  public final String customTypeString;

  public StringCustomTypeQueuedLogEntry(
      String key, long timestamp, String value, String customTypeString) {
    super(EntryType.STRING_CUSTOM_TYPE, key, timestamp);
    this.value = value;
    this.customTypeString = customTypeString;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value, customTypeString);
  }
}
