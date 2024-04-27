// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

// TODO: Add support for "extras" (ex. PDH currents)
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
     * Whether driver station data (robot enable state & joystick inputs) should be saved to the log
     * file.
     */
    boolean captureDs) {
  /**
   * Create a new options object using the default options. The default options are safe, but
   * probably not very helpful for debugging in a non-competition environment.
   *
   * @see https://doglog.dev/getting-started/usage/#configuring For instructions on how to customize
   *     these options.
   */
  public DogLogOptions() {
    // Default options
    this(false, false, true);
  }

  /**
   * Create a new options object with the {@link DogLogOptions#ntPublish} set to the provided value.
   */
  public DogLogOptions withNtPublish(boolean ntPublish) {
    return new DogLogOptions(ntPublish, captureNt(), captureDs());
  }

  /**
   * Create a new options object with the {@link DogLogOptions#captureNt} set to the provided value.
   */
  public DogLogOptions withCaptureNt(boolean captureNt) {
    return new DogLogOptions(ntPublish(), captureNt, captureDs());
  }

  /**
   * Create a new options object with the {@link DogLogOptions#captureDs} set to the provided value.
   */
  public DogLogOptions withCaptureDs(boolean captureDs) {
    return new DogLogOptions(ntPublish(), captureNt(), captureDs);
  }
}
