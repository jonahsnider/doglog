// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

/** Options for configuring DogLog. */
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
    boolean logExtras) {
  /**
   * Create a new options object using the default options. The default options are safe, but
   * probably not very helpful for debugging in a non-competition environment.
   *
   * <p>See https://doglog.dev/getting-started/usage/#configuring For instructions on how to
   * customize these options.
   */
  public DogLogOptions() {
    // Default options
    this(false, false, true, true);
  }

  /**
   * Create a new options object with {@link DogLogOptions#ntPublish} set to the provided value.
   *
   * @param ntPublish Whether logged values should be published to NetworkTables.
   * @return A new options object with {@link DogLogOptions#ntPublish} set to the provided value.
   */
  public DogLogOptions withNtPublish(boolean ntPublish) {
    return new DogLogOptions(ntPublish, captureNt(), captureDs(), logExtras());
  }

  /**
   * Create a new options object with {@link DogLogOptions#captureNt} set to the provided value.
   *
   * @param captureNt Whether all NetworkTables fields should be saved to the log file.
   * @return A new options object with {@link DogLogOptions#captureNt} set to the provided value.
   */
  public DogLogOptions withCaptureNt(boolean captureNt) {
    return new DogLogOptions(ntPublish(), captureNt, captureDs(), logExtras());
  }

  /**
   * Create a new options object with {@link DogLogOptions#captureDs} set to the provided value.
   *
   * @param captureDs Whether driver station data (robot enable state and joystick inputs) should be
   * @return A new options object with {@link DogLogOptions#captureDs} set to the provided value.
   */
  public DogLogOptions withCaptureDs(boolean captureDs) {
    return new DogLogOptions(ntPublish(), captureNt(), captureDs, logExtras());
  }

  /**
   * Create a new options object with {@link DogLogOptions#logExtras} set to the provided value.
   *
   * @param logExtras Whether to log extra data, like PDH currents, CAN usage, etc.
   * @return A new options object with {@link DogLogOptions#logExtras} set to the provided value.
   */
  public DogLogOptions withLogExtras(boolean logExtras) {
    return new DogLogOptions(ntPublish(), captureNt(), captureDs(), logExtras);
  }
}
