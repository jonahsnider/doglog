package dev.doglog.internal.log_thread.entries;

public class StringQueuedLogEntry extends BaseQueuedLogEntry {
  public final String value;

  public StringQueuedLogEntry(String key, long timestamp, String value) {
    super(EntryType.STRING, key, timestamp);
    this.value = value;
  }
}
