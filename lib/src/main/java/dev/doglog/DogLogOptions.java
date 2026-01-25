package dev.doglog;

import edu.wpi.first.wpilibj.DriverStation;
import java.util.function.BooleanSupplier;

/**
 * Options for configuring DogLog.
 *
 * <p>See https://doglog.dev/reference/logger-options/ for more information.
 */
public record DogLogOptions(
    /**
     * A function that returns whether logged values should be published to NetworkTables. Best
     * practice is to disable NetworkTables publishing during matches to reduce network bandwidth
     * consumption. The default behavior is to publish to NetworkTables unless the robot connects to
     * the FMS on a competition field.
     */
    BooleanSupplier ntPublish,
    /** Whether all NetworkTables fields should be saved to the log file. */
    boolean captureNt,
    /**
     * Whether driver station data (robot enable state and joystick inputs) should be saved to the
     * log file. Because of a limitation in WPILib, this option can't be disabled once it has been
     * enabled.
     */
    boolean captureDs,
    /** Whether to log extra data, like PDH currents, CAN usage, etc. */
    boolean logExtras,
    /** Whether console output should be saved to the log file. */
    boolean captureConsole,
    /** The maximum size of the log entry queue to use. */
    int logEntryQueueCapacity,
    /**
     * A function that returns whether tunable values from NetworkTables should be used. Best
     * practice is to have this disabled when you are at competitions, to make robot behavior more
     * deterministic. The default behavior is to only use tunable values from NetworkTables when not
     * connected to the FMS on a competition field.
     */
    BooleanSupplier ntTunables,
    /**
     * Whether to use a separate thread to handle log entries. This setting defaults to true.
     * Turning off the log thread may reduce the memory usage of logging, but could cause increased
     * CPU load.
     */
    boolean useLogThread) {
  private static boolean isNotOnFms() {
    return !DriverStation.isFMSAttached();
  }

  public static final double LOOP_PERIOD_SECONDS = 0.02;

  /**
   * Create a new options object using the default options. The default options are safe for a
   * competition environment, but you may want to tweak them to improve your development experience
   * at home.
   *
   * <p>See https://doglog.dev/getting-started/usage/#configuring For instructions on how to
   * customize these options.
   */
  public DogLogOptions() {
    // Default options
    this(
        DogLogOptions::isNotOnFms, false, false, true, true, 1000, DogLogOptions::isNotOnFms, true);
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
  // TODO: Always have NT publishing enabled in 2027
  public DogLogOptions withNtPublish(boolean ntPublish) {
    return withNtPublish(() -> ntPublish);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#ntPublish} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withNtPublish(() -> true));
   * </pre>
   *
   * @param ntPublish A function that returns whether logged values should be published to
   *     NetworkTables.
   * @return A new options object with {@link DogLogOptions#ntPublish} set to the provided value.
   */
  public DogLogOptions withNtPublish(BooleanSupplier ntPublish) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
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
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#captureDs} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withCaptureDs(true));</pre>
   *
   * @param captureDs Whether driver station data (robot enable state and joystick inputs) should be
   * @return A new options object with {@link DogLogOptions#captureDs} set to the provided value.
   */
  public DogLogOptions withCaptureDs(boolean captureDs) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#logExtras} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withLogExtras(false));</pre>
   *
   * @param logExtras Whether to log extra data, like PDH currents, CAN usage, radio connection
   *     status, etc.
   * @return A new options object with {@link DogLogOptions#logExtras} set to the provided value.
   */
  public DogLogOptions withLogExtras(boolean logExtras) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
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
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#captureConsole} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withCaptureConsole(false));</pre>
   *
   * @param captureConsole Whether console output should be saved to the log file.
   * @return A new options object with {@link DogLogOptions#captureConsole} set to the provided
   *     value.
   */
  public DogLogOptions withCaptureConsole(boolean captureConsole) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#ntTunables} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withUseTunableValues(true));
   * </pre>
   *
   * @param ntTunables Whether tunable values should be read from NetworkTables.
   * @return A new options object with {@link DogLogOptions#ntTunables} set to the provided value.
   */
  public DogLogOptions withNtTunables(boolean ntTunables) {
    return withNtTunables(() -> ntTunables);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#ntTunables} set to the provided value.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withUseTunableValues(() -> true));
   * </pre>
   *
   * @param ntTunables A function that returns whether tunable values should be read from
   *     NetworkTables.
   * @return A new options object with {@link DogLogOptions#ntTunables} set to the provided value.
   */
  public DogLogOptions withNtTunables(BooleanSupplier ntTunables) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }

  /**
   * Create a new options object, inheriting the configuration from this one, with {@link
   * DogLogOptions#useLogThread} set to the provided value.
   *
   * @param useLogThread Whether to use a separate thread to handle log entries.
   * @return A new options object with {@link DogLogOptions#useLogThread} set to the provided value.
   */
  public DogLogOptions withUseLogThread(boolean useLogThread) {
    return new DogLogOptions(
        ntPublish,
        captureNt,
        captureDs,
        logExtras,
        captureConsole,
        logEntryQueueCapacity,
        ntTunables,
        useLogThread);
  }
}
