package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class DoubleArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final double[] value;

  public DoubleArrayQueuedLogEntry(String key, long timestamp, double[] value) {
    super(EntryType.DOUBLE_ARRAY, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
