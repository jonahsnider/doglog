package dev.doglog.internal.log_thread.entries;

public class BooleanQueuedLogEntry extends BaseQueuedLogEntry {
  public final boolean value;

  public BooleanQueuedLogEntry(String key, long timestamp, boolean value) {
    super(EntryType.BOOLEAN, key, timestamp);
    this.value = value;
  }
}
