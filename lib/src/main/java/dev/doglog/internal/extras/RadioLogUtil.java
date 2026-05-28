package dev.doglog.internal.extras;

import com.google.errorprone.annotations.ThreadSafe;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.jspecify.annotations.NullMarked;
import org.wpilib.system.RobotController;

@NullMarked
@ThreadSafe
class RadioLogUtil {
  private static final Duration REQUEST_TIMEOUT_DURATION = Duration.ofSeconds(1);

  private static URI getRadioStatusEndpoint() {
    var teamNumber = RobotController.getTeamNumber();

    return URI.create("http://10." + teamNumber / 100 + "." + teamNumber % 100 + ".1/status");
  }

  private final AtomicReference<RadioLogResult> radioLogResult =
      new AtomicReference<>(RadioLogResult.DISCONNECTED);

  private final HttpClient httpClient = HttpClient.newHttpClient();
  private final HttpRequest request =
      HttpRequest.newBuilder()
          .uri(getRadioStatusEndpoint())
          .timeout(REQUEST_TIMEOUT_DURATION)
          .build();

  @SuppressWarnings("NullAway")
  public RadioLogResult radioLogResult() {
    return radioLogResult.get();
  }

  /** Get the latest radio status and update the {@link #radioLogResult()} object. */
  @SuppressWarnings("NullAway")
  public void refresh() {
    try {
      var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      radioLogResult.set(new RadioLogResult(true, response.body()));
    } catch (
        @SuppressWarnings("InterruptedExceptionSwallowed")
        Exception e) {
      radioLogResult.set(RadioLogResult.DISCONNECTED);
    }
  }
}
