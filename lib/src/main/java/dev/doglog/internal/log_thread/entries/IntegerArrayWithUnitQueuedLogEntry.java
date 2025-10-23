package dev.doglog.internal.log_thread.entries;

public class IntegerArrayWithUnitQueuedLogEntry extends BaseQueuedLogEntry {
  public final long[] value;
  public final String unit;

  public IntegerArrayWithUnitQueuedLogEntry(String key, long timestamp, long[] value, String unit) {
    super(EntryType.INTEGER_ARRAY_WITH_UNIT, key, timestamp);
    this.value = value;
    this.unit = unit;
  }
}
