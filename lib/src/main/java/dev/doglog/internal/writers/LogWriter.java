package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.ProtobufRegistry;
import dev.doglog.internal.StructRegistry;
import dev.doglog.internal.extras.ExtrasLogger;
import java.util.Arrays;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.wpilib.driverstation.DriverStation;
import org.wpilib.hardware.hal.HALUtil;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.system.DataLogManager;
import org.wpilib.util.WPISerializable;
import org.wpilib.util.protobuf.Protobuf;
import org.wpilib.util.protobuf.ProtobufSerializable;
import org.wpilib.util.struct.Struct;
import org.wpilib.util.struct.StructSerializable;

/** Writes logs to NetworkTables. WPILib automatically captures NT entries to DataLog. */
@NullMarked
public class LogWriter implements AutoCloseable {
  private static final String LOG_TABLE = "/Robot";

  private final NetworkTablesWriter ntWriter = new NetworkTablesWriter(LOG_TABLE);
  private final StructRegistry structRegistry = new StructRegistry();
  private final ProtobufRegistry protobufRegistry = new ProtobufRegistry();
  private final ExtrasLogger extras;

  public LogWriter(DogLogOptions initialOptions) {
    DataLogManager.logNetworkTables(true);
    DataLogManager.logConsoleOutput(initialOptions.captureConsole());

    if (initialOptions.captureDs()) {
      DriverStation.startDataLog(DataLogManager.getLog());
    }

    extras = new ExtrasLogger(this, initialOptions);
  }

  @Override
  public void close() {
    extras.close();
    ntWriter.close();
  }

  public void log(long timestamp, String key, boolean value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, boolean[] value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, double value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, double value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  public void log(long timestamp, String key, double[] value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, double[] value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, E value) {
    var struct =
        (Struct<E>) structRegistry.getEnumStruct((@NonNull Class<E>) value.getDeclaringClass());

    if (struct.getSize() == 0) {
      log(timestamp, key, value.toString());
      return;
    }

    ntWriter.log(timestamp, key, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, E[] value) {
    var struct =
        (@NonNull Struct<E>)
            structRegistry.getEnumStruct((@NonNull Class<E>) value.getClass().getComponentType());

    if (struct.getSize() == 0) {
      log(timestamp, key, Arrays.stream(value).map(Enum::toString).toArray(String[]::new));
      return;
    }

    ntWriter.log(timestamp, key, struct, value);
  }

  public void log(long timestamp, String key, float value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, float value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  public void log(long timestamp, String key, float[] value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, float[] value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  public void log(long timestamp, String key, int[] value) {
    long[] buffer = new long[value.length];

    for (int i = 0; i < value.length; i++) {
      buffer[i] = value[i];
    }

    ntWriter.log(timestamp, key, buffer);
  }

  public void log(long timestamp, String key, long value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, long value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  public void log(long timestamp, String key, long[] value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, long[] value, String unit) {
    ntWriter.log(timestamp, key, value, unit);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, R value) {
    var struct = (@NonNull Struct<R>) structRegistry.getRecordStruct(value.getClass());

    ntWriter.log(timestamp, key, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, R[] value) {
    var struct =
        (@NonNull Struct<R>)
            structRegistry.getRecordStruct(
                (Class<? extends Record>) value.getClass().getComponentType());

    ntWriter.log(timestamp, key, struct, value);
  }

  public void log(long timestamp, String key, String value) {
    ntWriter.log(timestamp, key, value);
  }

  public void log(long timestamp, String key, String value, String customTypeString) {
    ntWriter.log(timestamp, key, value, customTypeString);
  }

  public void log(long timestamp, String key, String[] value) {
    ntWriter.log(timestamp, key, value);
  }

  @SuppressWarnings("unchecked")
  public <T extends WPISerializable> void log(long timestamp, String key, T value) {
    switch (value) {
      case StructSerializable s -> {
        var maybeStruct =
            structRegistry.getStruct((@NonNull Class<? extends StructSerializable>) s.getClass());

        if (maybeStruct.isPresent()) {
          var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
          ntWriter.log(timestamp, key, struct, value);
        } else {
          logProto(timestamp, key, value);
        }
      }
      case ProtobufSerializable p -> logProto(timestamp, key, value);
      default -> {}
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    @SuppressWarnings("unchecked")
    var maybeStruct =
        structRegistry.getStruct((@NonNull Class<T>) value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
      ntWriter.log(timestamp, key, struct, value);
    }
  }

  public void setOptions(DogLogOptions options) {
    DataLogManager.logConsoleOutput(options.captureConsole());

    if (options.captureDs()) {
      DriverStation.startDataLog(DataLogManager.getLog());
    }

    extras.setOptions(options);

    printOptions(options);
  }

  public void setPdh(@Nullable PowerDistribution pdh) {
    extras.setPdh(pdh);
  }

  @SuppressWarnings("unchecked")
  private <T extends WPISerializable> void logProto(long timestamp, String key, T value) {
    if (value instanceof ProtobufSerializable p) {
      var maybeProto =
          protobufRegistry.getProto((@NonNull Class<? extends ProtobufSerializable>) p.getClass());

      if (maybeProto.isPresent()) {
        var proto = (@NonNull Protobuf<T, ?>) maybeProto.orElseThrow();
        ntWriter.log(timestamp, key, proto, value);
      }
    }
  }

  private void printOptions(DogLogOptions options) {
    var now = HALUtil.getMonotonicTime();
    log(now, "DogLog/Options", options.toString());
  }
}
