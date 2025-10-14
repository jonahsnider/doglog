package dev.doglog.internal.writers;

public interface LogWriterBase {
  public void log(long timestamp, String key, boolean[] value);

  public void log(long timestamp, String key, boolean value);

  public void log(long timestamp, String key, double[] value);

  public void log(long timestamp, String key, double value);

  public void log(long timestamp, String key, float[] value);

  public void log(long timestamp, String key, float value);

  public void log(long timestamp, String key, long[] value);

  public void log(long timestamp, String key, long value);

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value);

  public void log(long timestamp, String key, String value);

  public void log(long timestamp, String key, String value, String customTypeString);
}
