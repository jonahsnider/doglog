package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class IntegerQueuedLogEntry extends BaseQueuedLogEntry {
  public final long value;

  public IntegerQueuedLogEntry(String key, boolean forceNt, long timestamp, long value) {
    super(EntryType.INTEGER, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
