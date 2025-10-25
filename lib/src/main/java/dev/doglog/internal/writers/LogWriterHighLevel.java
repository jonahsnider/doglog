package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.PowerDistribution;
import org.jspecify.annotations.Nullable;

/** Consumes log entries provided by DogLog. Implementations decide how to process the log data. */
public interface LogWriterHighLevel extends LogWriterBase, AutoCloseable {
  public static LogWriterHighLevel create(DogLogOptions options) {
    return new LogWriter(options);
  }

  public void setPdh(@Nullable PowerDistribution pdh);

  public void setOptions(DogLogOptions newOptions);

  public void log(long timestamp, String key, int[] value);

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value);

  public <T extends StructSerializable> void log(long timestamp, String key, T value);
}
