package dev.doglog.internal.extras;

import org.jspecify.annotations.NullMarked;

@NullMarked
public class RadioLogResult {
  public String statusJson;
  public boolean isConnected;

  public RadioLogResult() {
    this.statusJson = "";
    this.isConnected = false;
  }
}
