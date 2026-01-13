package dev.doglog.internal;

import dev.doglog.internal.writers.LogWriterHighLevel;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.units.Measure;
import edu.wpi.first.units.Unit;
import edu.wpi.first.util.struct.StructSerializable;
import org.jspecify.annotations.Nullable;

public class DogLogForceNt {
  private boolean enabled;
  private LogWriterHighLevel logger;

  public DogLogForceNt(boolean enabled, LogWriterHighLevel logger) {
    this.enabled = enabled;
    this.logger = logger;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public void setLogger(LogWriterHighLevel logger) {
    this.logger = logger;
  }

  /** Log a boolean array to DataLog and NetworkTables. */
  public void log(String key, boolean @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a boolean to DataLog and NetworkTables. */
  public void log(String key, boolean value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a double array to DataLog and NetworkTables. */
  public void log(String key, double @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a double array with unit metadata to DataLog and NetworkTables. */
  public void log(String key, double @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  /** Log a double array with unit metadata to DataLog and NetworkTables. */
  public void log(String key, double @Nullable [] value, @Nullable Unit unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log a double to DataLog and NetworkTables. */
  public void log(String key, double value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a double with unit metadata to DataLog and NetworkTables. */
  public void log(String key, double value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  /** Log a double with unit metadata to DataLog and NetworkTables. */
  public void log(String key, double value, @Nullable Unit unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log a measure, preserving the user-specified unit, to DataLog and NetworkTables. */
  public void log(String key, @Nullable Measure<?> value) {
    if (!enabled || value == null) {
      return;
    }

    log(key, value.magnitude(), value.unit().name());
  }

  /** Log a float array to DataLog and NetworkTables. */
  public void log(String key, float @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a float array with unit metadata to DataLog and NetworkTables. */
  public void log(String key, float @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  /** Log a float to DataLog and NetworkTables. */
  public void log(String key, float value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a float with unit metadata to DataLog and NetworkTables. */
  public void log(String key, float value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  /** Log an int array to DataLog and NetworkTables. */
  public void log(String key, int @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a long array to DataLog and NetworkTables. */
  public void log(String key, long @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a long array with unit metadata to DataLog and NetworkTables. */
  public void log(String key, long @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  /** Log a long to DataLog and NetworkTables. */
  public void log(String key, long value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a long with unit metadata to DataLog and NetworkTables. */
  public void log(String key, long value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, unit);
  }

  // TODO: Raw logs

  /** Log a string array to DataLog and NetworkTables. */
  public void log(String key, @Nullable String[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log an enum array to DataLog and NetworkTables. */
  public <E extends Enum<E>> void log(String key, @Nullable E[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a string to DataLog and NetworkTables. */
  public void log(String key, @Nullable String value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a string with a custom type string to DataLog and NetworkTables. */
  public void log(String key, @Nullable String value, @Nullable String customTypeString) {
    if (!enabled || value == null) {
      return;
    }

    if (customTypeString == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value, customTypeString);
  }

  /** Log an enum to DataLog and NetworkTables. */
  public <E extends Enum<E>> void log(String key, @Nullable E value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a struct array to DataLog and NetworkTables. */
  public <T extends StructSerializable> void log(String key, @Nullable T[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a struct to DataLog and NetworkTables. */
  public <T extends StructSerializable> void log(String key, @Nullable T value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a record to DataLog and NetworkTables. */
  public void log(String key, @Nullable Record value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }

  /** Log a record array to DataLog and NetworkTables. */
  public void log(String key, @Nullable Record[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, true, value);
  }
}
