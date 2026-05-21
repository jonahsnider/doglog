package dev.doglog.internal.extras;

import com.google.errorprone.annotations.ThreadSafe;
import org.jspecify.annotations.NullMarked;

@NullMarked
@ThreadSafe
public class RadioLogResult {
  public String statusJson;
  public boolean isConnected;

  public RadioLogResult() {
    this.statusJson = "";
    this.isConnected = false;
  }
}
