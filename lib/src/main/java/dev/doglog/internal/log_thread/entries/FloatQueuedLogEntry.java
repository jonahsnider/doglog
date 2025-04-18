package dev.doglog.internal.log_thread.entries;

public class FloatQueuedLogEntry extends BaseQueuedLogEntry {
  public final float value;

  public FloatQueuedLogEntry(String key, long timestamp, float value) {
    super(EntryType.FLOAT, key, timestamp);
    this.value = value;
  }
}
