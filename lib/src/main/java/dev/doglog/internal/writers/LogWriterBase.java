package dev.doglog.internal.writers;

import org.jspecify.annotations.NullMarked;

/** All parameters must not be null. */
@NullMarked
public interface LogWriterBase {
  public void log(long timestamp, String key, boolean forceNt, boolean[] value);

  public void log(long timestamp, String key, boolean forceNt, boolean value);

  public void log(long timestamp, String key, boolean forceNt, double[] value);

  public void log(long timestamp, String key, boolean forceNt, double[] value, String unit);

  public void log(long timestamp, String key, boolean forceNt, double value);

  public void log(long timestamp, String key, boolean forceNt, double value, String unit);

  public void log(long timestamp, String key, boolean forceNt, float[] value);

  public void log(long timestamp, String key, boolean forceNt, float[] value, String unit);

  public void log(long timestamp, String key, boolean forceNt, float value);

  public void log(long timestamp, String key, boolean forceNt, float value, String unit);

  public void log(long timestamp, String key, boolean forceNt, long[] value);

  public void log(long timestamp, String key, boolean forceNt, long[] value, String unit);

  public void log(long timestamp, String key, boolean forceNt, long value);

  public void log(long timestamp, String key, boolean forceNt, long value, String unit);

  // TODO: Raw logs

  public void log(long timestamp, String key, boolean forceNt, String[] value);

  public void log(long timestamp, String key, boolean forceNt, String value);

  public void log(
      long timestamp, String key, boolean forceNt, String value, String customTypeString);
}
