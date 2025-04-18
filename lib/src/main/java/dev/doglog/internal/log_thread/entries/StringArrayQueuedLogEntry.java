package dev.doglog.internal.log_thread.entries;

public class StringArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final String[] value;

  public StringArrayQueuedLogEntry(String key, long timestamp, String[] value) {
    super(EntryType.STRING_ARRAY, key, timestamp);
    this.value = value;
  }
}
