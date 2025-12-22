package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class IntegerWithUnitQueuedLogEntry extends BaseQueuedLogEntry {
  public final long value;
  public final String unit;

  public IntegerWithUnitQueuedLogEntry(String key, long timestamp, long value, String unit) {
    super(EntryType.INTEGER_WITH_UNIT, key, timestamp);
    this.value = value;
    this.unit = unit;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value, unit);
  }
}
