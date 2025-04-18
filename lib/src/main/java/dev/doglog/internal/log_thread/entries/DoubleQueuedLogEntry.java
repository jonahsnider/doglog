package dev.doglog.internal.log_thread.entries;

public class DoubleQueuedLogEntry extends BaseQueuedLogEntry {
  public final double value;

  public DoubleQueuedLogEntry(String key, long timestamp, double value) {
    super(EntryType.DOUBLE, key, timestamp);
    this.value = value;
  }
}
