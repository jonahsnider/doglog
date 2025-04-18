package dev.doglog.internal.extras;

import edu.wpi.first.wpilibj.RobotController;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

class RadioLogUtil {
  private static final Duration REQUEST_TIMEOUT_DURATION = Duration.ofSeconds(1);

  private static URI getRadioStatusEndpoint() {
    var teamNumber = RobotController.getTeamNumber();

    return URI.create("http://10." + teamNumber / 100 + "." + teamNumber % 100 + ".1/status");
  }

  public final RadioLogResult radioLogResult = new RadioLogResult();

  private final HttpClient httpClient = HttpClient.newHttpClient();
  private final HttpRequest request =
      HttpRequest.newBuilder()
          .uri(getRadioStatusEndpoint())
          .timeout(REQUEST_TIMEOUT_DURATION)
          .build();

  /** Get the latest radio status and update the {@link this#radioLogResult} object. */
  public void refresh() {
    try {
      var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      radioLogResult.isConnected = true;
      radioLogResult.statusJson = response.body();
    } catch (
        @SuppressWarnings("InterruptedExceptionSwallowed")
        Exception e) {
      radioLogResult.isConnected = false;
      radioLogResult.statusJson = "";
    }
  }
}
