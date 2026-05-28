package dev.doglog.internal.extras;

import com.google.errorprone.annotations.ThreadSafe;
import org.jspecify.annotations.NullMarked;

@NullMarked
@ThreadSafe
public record RadioLogResult(boolean isConnected, String statusJson) {
  public static final RadioLogResult DISCONNECTED = new RadioLogResult(false, "");
}
