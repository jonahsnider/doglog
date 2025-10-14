package dev.doglog.internal.writers;

import edu.wpi.first.util.struct.Struct;

public interface LogWriterLowLevel extends LogWriterBase {
  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value);

  public <T> void log(long timestamp, String key, Struct<T> struct, T value);
}
