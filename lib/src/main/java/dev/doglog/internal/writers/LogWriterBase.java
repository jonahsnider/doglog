package dev.doglog.internal.writers;

import org.jspecify.annotations.NullMarked;

/** All parameters must not be null. */
@NullMarked
public interface LogWriterBase {
  public void log(long timestamp, String key, boolean[] value);

  public void log(long timestamp, String key, boolean value);

  public void log(long timestamp, String key, double[] value);

  public void log(long timestamp, String key, double[] value, String unit);

  public void log(long timestamp, String key, double value);

  public void log(long timestamp, String key, double value, String unit);

  public void log(long timestamp, String key, float[] value);

  public void log(long timestamp, String key, float[] value, String unit);

  public void log(long timestamp, String key, float value);

  public void log(long timestamp, String key, float value, String unit);

  public void log(long timestamp, String key, long[] value);

  public void log(long timestamp, String key, long[] value, String unit);

  public void log(long timestamp, String key, long value);

  public void log(long timestamp, String key, long value, String unit);

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value);

  public void log(long timestamp, String key, String value);

  public void log(long timestamp, String key, String value, String customTypeString);
}
