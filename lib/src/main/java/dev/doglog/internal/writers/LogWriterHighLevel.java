package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.PowerDistribution;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;

/** Consumes log entries provided by DogLog. Implementations decide how to process the log data. */
@NullMarked
public interface LogWriterHighLevel extends LogWriterBase, AutoCloseable {
  public static LogWriterHighLevel create(DogLogOptions options) {
    return new LogWriter(options);
  }

  public void setPdh(@Nullable PowerDistribution pdh);

  public void setOptions(DogLogOptions newOptions);

  public void log(long timestamp, String key, boolean forceNt, int[] value);

  public <T extends StructSerializable> void log(
      long timestamp, String key, boolean forceNt, T[] value);

  public <T extends StructSerializable> void log(
      long timestamp, String key, boolean forceNt, T value);

  public <E extends Enum<E>> void log(long timestamp, String key, boolean forceNt, E[] value);

  public <E extends Enum<E>> void log(long timestamp, String key, boolean forceNt, E value);

  public <T extends Record> void log(long timestamp, String key, boolean forceNt, T[] value);

  public <T extends Record> void log(long timestamp, String key, boolean forceNt, T value);
}
