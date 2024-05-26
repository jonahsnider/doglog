// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

/**
 * Options for configuring DogLog.
 *
 * <p>See https://doglog.dev/reference/advanced-configuration/ for more information.
 */
public record DogLogOptions(
    /**
     * Whether logged values should be published to NetworkTables. You should not have this enabled
     * if you're using a competition flashed radio, otherwise you may consume too much bandwidth.
     */
    boolean ntPublish,
    /** Whether all NetworkTables fields should be saved to the log file. */
    boolean captureNt,
    /**
     * Whether driver station data (robot enable state and joystick inputs) should be saved to the
     * log file.
     */
    boolean captureDs,
    /** Whether to log extra data, like PDH currents, CAN usage, etc. */
    boolean logExtras,
    /** The maximum size of the log entry queue to use. */
    int logEntryQueueCapacity) {
  /**
   * Create a new options object using the default options. The default options are safe for a
   * competition environment, but not really suited for a development environment.
   *
   * <p>See https://doglog.dev/getting-started/usage/#configuring For instructions on how to
   * customize these options.
   */
  public DogLogOptions() {
    // Default options
    this(false, false, true, true, 500);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#ntPublish} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withNtPublish(true));
   * </pre>
   *
   * @param ntPublish Whether logged values should be published to NetworkTables.
   * @return A new options object with {@link DogLogOptions#ntPublish} set to the provided value.
   */
  public DogLogOptions withNtPublish(boolean ntPublish) {
    return new DogLogOptions(
        ntPublish, captureNt(), captureDs(), logExtras(), logEntryQueueCapacity());
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#captureNt} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withCaptureNt(true));</pre>
   *
   * @param captureNt Whether all NetworkTables fields should be saved to the log file.
   * @return A new options object with {@link DogLogOptions#captureNt} set to the provided value.
   */
  public DogLogOptions withCaptureNt(boolean captureNt) {
    return new DogLogOptions(
        ntPublish(), captureNt, captureDs(), logExtras(), logEntryQueueCapacity());
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#captureDs} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withCaptureDs(false));</pre>
   *
   * @param captureDs Whether driver station data (robot enable state and joystick inputs) should be
   * @return A new options object with {@link DogLogOptions#captureDs} set to the provided value.
   */
  public DogLogOptions withCaptureDs(boolean captureDs) {
    return new DogLogOptions(
        ntPublish(), captureNt(), captureDs, logExtras(), logEntryQueueCapacity());
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#logExtras} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withLogExtras(false));</pre>
   *
   * @param logExtras Whether to log extra data, like PDH currents, CAN usage, etc.
   * @return A new options object with {@link DogLogOptions#logExtras} set to the provided value.
   */
  public DogLogOptions withLogExtras(boolean logExtras) {
    return new DogLogOptions(
        ntPublish(), captureNt(), captureDs(), logExtras, logEntryQueueCapacity());
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#logEntryQueueCapacity} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withLogEntryQueueCapacity(1000));</pre>
   *
   * @param logEntryQueueCapacity The size of the log message queue to use.
   * @return A new options object with {@link DogLogOptions#logEntryQueueCapacity} set to the
   *     provided value.
   */
  public DogLogOptions withLogEntryQueueCapacity(int logEntryQueueCapacity) {
    return new DogLogOptions(
        ntPublish(), captureNt(), captureDs(), logExtras(), logEntryQueueCapacity);
  }
}
