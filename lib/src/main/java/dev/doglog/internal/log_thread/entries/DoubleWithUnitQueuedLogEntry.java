package dev.doglog.internal.log_thread.entries;

public class DoubleWithUnitQueuedLogEntry extends BaseQueuedLogEntry {
  public final double value;
  public final String unit;

  public DoubleWithUnitQueuedLogEntry(String key, long timestamp, double value, String unit) {
    super(EntryType.DOUBLE_WITH_UNIT, key, timestamp);
    this.value = value;
    this.unit = unit;
  }
}
