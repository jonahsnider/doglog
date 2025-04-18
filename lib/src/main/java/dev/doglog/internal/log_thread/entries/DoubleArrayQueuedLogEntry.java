package dev.doglog.internal.log_thread.entries;

public class DoubleArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final double[] value;

  public DoubleArrayQueuedLogEntry(String key, long timestamp, double[] value) {
    super(EntryType.DOUBLE_ARRAY, key, timestamp);
    this.value = value;
  }
}
