package dev.doglog.internal.writers;

import org.jspecify.annotations.NullMarked;
import org.wpilib.util.struct.Struct;

@NullMarked
public interface LogWriterLowLevel extends LogWriterBase {
  public <T> void log(long timestamp, String key, boolean forceNt, Struct<T> struct, T[] value);

  public <T> void log(long timestamp, String key, boolean forceNt, Struct<T> struct, T value);
}
