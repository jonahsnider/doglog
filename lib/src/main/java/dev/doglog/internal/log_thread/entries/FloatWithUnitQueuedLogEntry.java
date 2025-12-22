package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class FloatWithUnitQueuedLogEntry extends BaseQueuedLogEntry {
  public final float value;
  public final String unit;

  public FloatWithUnitQueuedLogEntry(String key, long timestamp, float value, String unit) {
    super(EntryType.FLOAT_WITH_UNIT, key, timestamp);
    this.value = value;
    this.unit = unit;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value, unit);
  }
}
