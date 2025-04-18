package dev.doglog.internal.log_thread.entries;

public class IntegerQueuedLogEntry extends BaseQueuedLogEntry {
  public final long value;

  public IntegerQueuedLogEntry(String key, long timestamp, long value) {
    super(EntryType.INTEGER, key, timestamp);
    this.value = value;
  }
}
