package dev.doglog.internal.extras;

import static org.wpilib.units.Units.Amps;
import static org.wpilib.units.Units.Celsius;
import static org.wpilib.units.Units.Joules;
import static org.wpilib.units.Units.Volts;
import static org.wpilib.units.Units.Watts;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.DogLog;
import dev.doglog.DogLogOptions;
import java.util.concurrent.atomic.AtomicReference;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.networktables.NetworkTableInstance;
import org.wpilib.system.DataLogManager;
import org.wpilib.system.Notifier;
import org.wpilib.system.RobotController;
import org.wpilib.system.SystemServer;

/** Logs "extra" information. */
@NullMarked
@ThreadSafe
public class ExtrasLogger implements AutoCloseable {
  private static final String VOLTS_UNIT_STRING = Volts.name();
  private static final String AMPS_UNIT_STRING = Amps.name();
  private static final String CELSIUS_UNIT_STRING = Celsius.name();
  private static final String WATTS_UNIT_STRING = Watts.name();
  private static final String JOULES_UNIT_STRING = Joules.name();

  private static final double RADIO_LOG_PERIOD_SECONDS = 5.81;

  private final AtomicReference<@Nullable PowerDistribution> pdh = new AtomicReference<>();

  private final Notifier notifier = new Notifier(this::log);

  private final Notifier radioNotifier = new Notifier(this::logRadio);
  private final RadioLogUtil radioLogUtil = new RadioLogUtil();

  private final NetworkTableInstance systemServer;
  private int systemServerEntryLogger;
  private boolean metadataLogged;
  private volatile boolean logExtras;

  public ExtrasLogger(DogLogOptions initialOptions) {
    systemServer = SystemServer.getSystemServer();
    logExtras = initialOptions.logExtras();

    notifier.setName("DogLog extras logger");
    radioNotifier.setName("DogLog radio logger");
    notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);

    if (logExtras) {
      startSystemServerLog();
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
    }
  }

  @Override
  public synchronized void close() {
    notifier.close();
    radioNotifier.close();
    stopSystemServerLog();
  }

  public synchronized void setOptions(DogLogOptions options) {
    logExtras = options.logExtras();
    if (logExtras) {
      startSystemServerLog();
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
    } else {
      stopSystemServerLog();
      radioNotifier.stop();
    }
  }

  public void setPdh(@Nullable PowerDistribution pdh) {
    this.pdh.set(pdh);
  }

  private void log() {
    AlertLogger.log();
    if (logExtras) {
      logMetadata();
      logPdh();
    }
  }

  private void logMetadata() {
    if (!metadataLogged && DogLog.isEnabled()) {
      DogLog.log("Metadata/SerialNumber", RobotController.getSerialNumber());
      metadataLogged = true;
    }
  }

  private void logPdh() {
    var currentPdh = pdh.get();
    if (currentPdh == null) {
      return;
    }

    DogLog.log(
        "SystemStats/PowerDistribution/Temperature",
        currentPdh.getTemperature(),
        CELSIUS_UNIT_STRING);
    DogLog.log("SystemStats/PowerDistribution/Voltage", currentPdh.getVoltage(), VOLTS_UNIT_STRING);
    DogLog.log(
        "SystemStats/PowerDistribution/ChannelCurrent",
        currentPdh.getAllCurrents(),
        AMPS_UNIT_STRING);
    DogLog.log(
        "SystemStats/PowerDistribution/TotalCurrent",
        currentPdh.getTotalCurrent(),
        AMPS_UNIT_STRING);
    DogLog.log(
        "SystemStats/PowerDistribution/TotalPower", currentPdh.getTotalPower(), WATTS_UNIT_STRING);
    DogLog.log(
        "SystemStats/PowerDistribution/TotalEnergy",
        currentPdh.getTotalEnergy(),
        JOULES_UNIT_STRING);
    DogLog.log("SystemStats/PowerDistribution/ChannelCount", currentPdh.getNumChannels());
  }

  private void logRadio() {
    radioLogUtil.refresh();
    var radioLogResult = radioLogUtil.radioLogResult();

    DogLog.log("RadioStatus/Connected", radioLogResult.isConnected());
    DogLog.log("RadioStatus/StatusJson", radioLogResult.statusJson(), "json");
  }

  private void startSystemServerLog() {
    if (systemServerEntryLogger == 0) {
      systemServerEntryLogger = systemServer.startEntryDataLog(DataLogManager.getLog(), "", "NT:");
    }
  }

  private void stopSystemServerLog() {
    if (systemServerEntryLogger != 0) {
      NetworkTableInstance.stopEntryDataLog(systemServerEntryLogger);
      systemServerEntryLogger = 0;
    }
  }
}
