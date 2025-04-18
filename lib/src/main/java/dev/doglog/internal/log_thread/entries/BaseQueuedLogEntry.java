package dev.doglog.internal.log_thread.entries;

public abstract class BaseQueuedLogEntry {
  public final EntryType type;
  public final String key;
  public final long timestamp;

  protected BaseQueuedLogEntry(EntryType type, String key, long timestamp) {
    this.type = type;
    this.key = key;
    this.timestamp = timestamp;
  }
}
