// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

// TODO: Add support for "extras" (ex. PDH currents)
public record DogLogOptions(boolean ntPublish, boolean captureNt, boolean captureDs) {
  public DogLogOptions() {
    // Default options
    this(false, false, true);
  }

  public DogLogOptions withNtPublish(boolean ntPublish) {
    return new DogLogOptions(ntPublish, captureNt(), captureDs());
  }

  public DogLogOptions withCaptureNt(boolean captureNt) {
    return new DogLogOptions(ntPublish(), captureNt, captureDs());
  }

  public DogLogOptions withCaptureDs(boolean captureDs) {
    return new DogLogOptions(ntPublish(), captureNt(), captureDs);
  }
}
