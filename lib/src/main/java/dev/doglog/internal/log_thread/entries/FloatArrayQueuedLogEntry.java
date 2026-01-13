package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class FloatArrayQueuedLogEntry extends BaseQueuedLogEntry {
  public final float[] value;

  public FloatArrayQueuedLogEntry(String key, boolean forceNt, long timestamp, float[] value) {
    super(EntryType.FLOAT_ARRAY, key, forceNt, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, forceNt, value);
  }
}
