package dev.doglog.internal.extras;

import static org.wpilib.units.Units.Amps;
import static org.wpilib.units.Units.Celsius;
import static org.wpilib.units.Units.Joules;
import static org.wpilib.units.Units.Microseconds;
import static org.wpilib.units.Units.Volts;
import static org.wpilib.units.Units.Watts;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.DogLog;
import dev.doglog.DogLogOptions;
import java.util.concurrent.atomic.AtomicReference;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.wpilib.hardware.hal.HAL;
import org.wpilib.hardware.hal.HALUtil;
import org.wpilib.hardware.hal.PowerJNI;
import org.wpilib.hardware.hal.can.CANJNI;
import org.wpilib.hardware.hal.can.CANStatus;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.system.Notifier;

/** Logs "extra" information. */
@NullMarked
@ThreadSafe
public class ExtrasLogger implements AutoCloseable {
  private static final String VOLTS_UNIT_STRING = Volts.name();
  private static final String AMPS_UNIT_STRING = Amps.name();
  private static final String CELSIUS_UNIT_STRING = Celsius.name();
  private static final String WATTS_UNIT_STRING = Watts.name();
  private static final String JOULES_UNIT_STRING = Joules.name();
  private static final String MICROSECONDS_UNIT_STRING = Microseconds.name();

  private static final double RADIO_LOG_PERIOD_SECONDS = 5.81;

  private final CANStatus status = new CANStatus();

  private final AtomicReference<@Nullable PowerDistribution> pdh = new AtomicReference<>();

  private final Notifier notifier = new Notifier(this::log);

  private final Notifier radioNotifier = new Notifier(this::logRadio);
  private final RadioLogUtil radioLogUtil = new RadioLogUtil();

  public ExtrasLogger(DogLogOptions initialOptions) {
    notifier.setName("DogLog extras logger");
    radioNotifier.setName("DogLog radio logger");

    if (initialOptions.logExtras()) {
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
      notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
    }
  }

  @Override
  public void close() {
    notifier.close();
    radioNotifier.close();
  }

  public void setOptions(DogLogOptions options) {
    if (options.logExtras()) {
      notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
    } else {
      notifier.stop();
      radioNotifier.stop();
    }
  }

  public void setPdh(@Nullable PowerDistribution pdh) {
    this.pdh.set(pdh);
  }

  private void log() {
    logSystem();
    logCan();
    logPdh();
  }

  private void logCan() {
    for (int i = 0; i < 5; i++) {
      CANJNI.getCANStatus(i, status);
      DogLog.log("SystemStats/CANBus/" + i + "/Utilization", status.percentBusUtilization);
      DogLog.log("SystemStats/CANBus/" + i + "/OffCount", status.busOffCount);
      DogLog.log("SystemStats/CANBus/" + i + "/TxFullCount", status.txFullCount);
      DogLog.log("SystemStats/CANBus/" + i + "/ReceiveErrorCount", status.receiveErrorCount);
      DogLog.log("SystemStats/CANBus/" + i + "/TransmitErrorCount", status.transmitErrorCount);
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

  private void logSystem() {
    DogLog.log("SystemStats/SerialNumber", HALUtil.getSerialNumber());
    DogLog.log("SystemStats/Comments", HALUtil.getComments());
    DogLog.log("SystemStats/TeamNumber", HALUtil.getTeamNumber());
    DogLog.log("SystemStats/SystemActive", HAL.getSystemActive());
    DogLog.log("SystemStats/BrownedOut", HAL.getBrownedOut());
    DogLog.log("SystemStats/RSLState", HAL.getRSLState());
    DogLog.log("SystemStats/SystemTimeValid", HAL.getSystemTimeValid());

    DogLog.log("SystemStats/BatteryVoltage", PowerJNI.getVinVoltage(), VOLTS_UNIT_STRING);

    DogLog.log("SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3(), VOLTS_UNIT_STRING);
    DogLog.log("SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3(), AMPS_UNIT_STRING);
    DogLog.log("SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    DogLog.log("SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    DogLog.log("SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp(), CELSIUS_UNIT_STRING);

    DogLog.log("SystemStats/EpochTimeMicros", HALUtil.getMonotonicTime(), MICROSECONDS_UNIT_STRING);
  }
}
