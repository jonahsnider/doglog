package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.PowerDistribution;

/**
 * Consumes log entries provided by DogLog. Implementations decide how to process the log data (e.g.
 * enqueueing for processing on a background thread or writing immediately).
 */
public interface LogWriterHighLevel extends LogWriterBase, AutoCloseable {
  public void setPdh(PowerDistribution pdh);

  public void setOptions(DogLogOptions newOptions);

  public void log(long timestamp, String key, int[] value);

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value);

  public <T extends StructSerializable> void log(long timestamp, String key, T value);
}
