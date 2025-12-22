package dev.doglog.internal.log_thread.entries;

import dev.doglog.internal.log_thread.writers.CombinedWriter;

public class BooleanQueuedLogEntry extends BaseQueuedLogEntry {
  public final boolean value;

  public BooleanQueuedLogEntry(String key, long timestamp, boolean value) {
    super(EntryType.BOOLEAN, key, timestamp);
    this.value = value;
  }

  @Override
  public void log(CombinedWriter writer) {
    writer.log(timestamp, key, value);
  }
}
