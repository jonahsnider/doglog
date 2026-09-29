package dev.doglog.internal.extras;

import static java.util.Comparator.comparingLong;

import dev.doglog.DogLog;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.wpilib.util.AlertDataJNI;

/** Logs the current state of all WPILib alerts. */
final class AlertLogger {
  private static final Set<String> KNOWN_GROUPS = new HashSet<>();

  public static void log() {
    var activeByGroup = new HashMap<String, List<AlertDataJNI.AlertInfo>>();

    for (var alert : AlertDataJNI.getAlerts()) {
      KNOWN_GROUPS.add(alert.group);
      if (alert.activeStartTime != 0) {
        activeByGroup.computeIfAbsent(alert.group, group -> new ArrayList<>()).add(alert);
      }
    }

    for (var group : KNOWN_GROUPS) {
      var alerts = activeByGroup.get(group);
      if (alerts == null) {
        alerts = new ArrayList<>();
      }
      alerts.sort(
          comparingLong((AlertDataJNI.AlertInfo alert) -> alert.activeStartTime)
              .reversed()
              .thenComparing(alert -> alert.text));

      var errors = new ArrayList<String>();
      var warnings = new ArrayList<String>();
      var infos = new ArrayList<String>();

      for (var alert : alerts) {
        switch (alert.level) {
          case AlertDataJNI.LEVEL_HIGH -> errors.add(alert.text);
          case AlertDataJNI.LEVEL_MEDIUM -> warnings.add(alert.text);
          case AlertDataJNI.LEVEL_LOW -> infos.add(alert.text);
        }
      }

      DogLog.log(group + "/.type", "Alerts");
      DogLog.log(group + "/errors", errors.toArray(String[]::new));
      DogLog.log(group + "/warnings", warnings.toArray(String[]::new));
      DogLog.log(group + "/infos", infos.toArray(String[]::new));
    }
  }

  private AlertLogger() {}
}
