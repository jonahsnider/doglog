// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.extras;

public class RadioLogResult {
  public String statusJson;
  public boolean isConnected;

  public RadioLogResult() {
    this.statusJson = "";
    this.isConnected = false;
  }
}
