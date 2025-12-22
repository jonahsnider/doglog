package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class DoubleArrayWithUnitQueuedLogEntry extends BaseQueuedLogEntry {
  public final double[] value;
  public final String unit;

  public DoubleArrayWithUnitQueuedLogEntry(
      String key, long timestamp, double[] value, String unit) {
    super(EntryType.DOUBLE_ARRAY_WITH_UNIT, key, timestamp);
    this.value = value;
    this.unit = unit;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value, unit);
  }
}
