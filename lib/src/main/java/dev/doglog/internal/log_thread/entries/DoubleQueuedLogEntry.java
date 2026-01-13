package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class DoubleQueuedLogEntry extends BaseQueuedLogEntry {
  public final double value;

  public DoubleQueuedLogEntry(String key, boolean forceNt, long timestamp, double value) {
    super(EntryType.DOUBLE, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
