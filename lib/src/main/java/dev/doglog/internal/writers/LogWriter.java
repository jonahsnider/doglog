package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.extras.ExtrasLogger;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.PowerDistribution;
import org.jspecify.annotations.Nullable;

/** Writes logs directly from the main thread. */
public class LogWriter implements LogWriterHighLevel {
  private final CombinedWriter writer;
  private final ExtrasLogger extras;

  public LogWriter(DogLogOptions initialOptions) {
    writer = new CombinedWriter(initialOptions);

    extras = new ExtrasLogger(this, initialOptions);
  }

  @Override
  public void setPdh(@Nullable PowerDistribution pdh) {
    extras.setPdh(pdh);
  }

  @Override
  public void setOptions(DogLogOptions newOptions) {
    writer.setOptions(newOptions);
    extras.setOptions(newOptions);
  }

  @Override
  public void log(long timestamp, String key, boolean[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, boolean value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, double[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, double[] value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, double value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, double value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, float[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, float[] value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, float value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, float value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, int[] value) {
    long[] buffer = new long[value.length];

    for (int i = 0; i < value.length; i++) {
      buffer[i] = value[i];
    }

    writer.log(timestamp, key, buffer);
  }

  @Override
  public void log(long timestamp, String key, long[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, long[] value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, long value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, long value, String unit) {
    writer.log(timestamp, key, value, unit);
  }

  @Override
  public void log(long timestamp, String key, String[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, String value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void log(long timestamp, String key, String value, String customTypeString) {
    writer.log(timestamp, key, value, customTypeString);
  }

  @Override
  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public <T extends StructSerializable> void log(long timestamp, String key, T value) {
    writer.log(timestamp, key, value);
  }

  @Override
  public void close() {
    extras.close();
  }
}
