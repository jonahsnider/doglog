package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public abstract class BaseQueuedLogEntry {
  public final EntryType type;
  public final String key;
  public final boolean forceNt;
  public final long timestamp;

  protected BaseQueuedLogEntry(EntryType type, String key, boolean forceNt, long timestamp) {
    this.type = type;
    this.key = key;
    this.forceNt = forceNt;
    this.timestamp = timestamp;
  }

  public abstract void log(CombinedWriter writer);
}
