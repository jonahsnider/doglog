package dev.doglog.internal.extras;

import static edu.wpi.first.units.Units.Amps;
import static edu.wpi.first.units.Units.Celsius;
import static edu.wpi.first.units.Units.Joules;
import static edu.wpi.first.units.Units.Microseconds;
import static edu.wpi.first.units.Units.Volts;
import static edu.wpi.first.units.Units.Watts;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.writers.LogWriterHighLevel;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.hal.PowerJNI;
import edu.wpi.first.hal.can.CANJNI;
import edu.wpi.first.hal.can.CANStatus;
import edu.wpi.first.wpilibj.Notifier;
import edu.wpi.first.wpilibj.PowerDistribution;
import org.jspecify.annotations.Nullable;

/** Logs "extra" information. */
public class ExtrasLogger implements AutoCloseable {
  private static final String VOLTS_UNIT_STRING = Volts.name();
  private static final String AMPS_UNIT_STRING = Amps.name();
  private static final String CELSIUS_UNIT_STRING = Celsius.name();
  private static final String WATTS_UNIT_STRING = Watts.name();
  private static final String JOULES_UNIT_STRING = Joules.name();
  private static final String MICROSECONDS_UNIT_STRING = Microseconds.name();

  private static final double RADIO_LOG_PERIOD_SECONDS = 5.81;

  private final LogWriterHighLevel logger;

  private final CANStatus status = new CANStatus();

  private @Nullable PowerDistribution pdh;

  private final Notifier notifier = new Notifier(this::log);

  private final Notifier radioNotifier = new Notifier(this::logRadio);
  private final RadioLogUtil radioLogUtil = new RadioLogUtil();

  public ExtrasLogger(LogWriterHighLevel logger, DogLogOptions initialOptions) {
    this.logger = logger;

    notifier.setName("DogLog extras logger");
    radioNotifier.setName("DogLog radio logger");

    if (initialOptions.logExtras()) {
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
      notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
    }
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
    this.pdh = pdh;
  }

  private void log() {
    // Instead of logging directly to DogLog, we write logs to the consumer directly. This lets us
    // get the timestamp a single time and reuse that value for all log entries.
    var now = HALUtil.getFPGATime();

    logSystem(now);
    logCan(now);
    logPdh(now);
  }

  private void logSystem(long now) {
    logger.log(now, "SystemStats/FPGAVersion", HALUtil.getFPGAVersion());
    logger.log(now, "SystemStats/FPGARevision", HALUtil.getFPGARevision());
    logger.log(now, "SystemStats/SerialNumber", HALUtil.getSerialNumber());
    logger.log(now, "SystemStats/Comments", HALUtil.getComments());
    logger.log(now, "SystemStats/TeamNumber", HALUtil.getTeamNumber());
    logger.log(now, "SystemStats/FPGAButton", HALUtil.getFPGAButton());
    logger.log(now, "SystemStats/SystemActive", HAL.getSystemActive());
    logger.log(now, "SystemStats/BrownedOut", HAL.getBrownedOut());
    logger.log(now, "SystemStats/RSLState", HAL.getRSLState());
    logger.log(now, "SystemStats/SystemTimeValid", HAL.getSystemTimeValid());

    logger.log(now, "SystemStats/BatteryVoltage", PowerJNI.getVinVoltage(), VOLTS_UNIT_STRING);
    logger.log(now, "SystemStats/BatteryCurrent", PowerJNI.getVinCurrent(), AMPS_UNIT_STRING);

    logger.log(now, "SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3(), VOLTS_UNIT_STRING);
    logger.log(now, "SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3(), AMPS_UNIT_STRING);
    logger.log(now, "SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    logger.log(now, "SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    logger.log(now, "SystemStats/5vRail/Voltage", PowerJNI.getUserVoltage5V(), VOLTS_UNIT_STRING);
    logger.log(now, "SystemStats/5vRail/Current", PowerJNI.getUserCurrent5V(), AMPS_UNIT_STRING);
    logger.log(now, "SystemStats/5vRail/Active", PowerJNI.getUserActive5V());
    logger.log(now, "SystemStats/5vRail/CurrentFaults", PowerJNI.getUserCurrentFaults5V());

    logger.log(now, "SystemStats/6vRail/Voltage", PowerJNI.getUserVoltage6V(), VOLTS_UNIT_STRING);
    logger.log(now, "SystemStats/6vRail/Current", PowerJNI.getUserCurrent6V(), AMPS_UNIT_STRING);
    logger.log(now, "SystemStats/6vRail/Active", PowerJNI.getUserActive6V());
    logger.log(now, "SystemStats/6vRail/CurrentFaults", PowerJNI.getUserCurrentFaults6V());

    logger.log(
        now, "SystemStats/BrownoutVoltage", PowerJNI.getBrownoutVoltage(), VOLTS_UNIT_STRING);
    logger.log(now, "SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp(), CELSIUS_UNIT_STRING);
  }

  private void logCan(long now) {
    CANJNI.getCANStatus(status);
    logger.log(now, "SystemStats/CANBus/Utilization", status.percentBusUtilization);
    logger.log(now, "SystemStats/CANBus/OffCount", status.busOffCount);
    logger.log(now, "SystemStats/CANBus/TxFullCount", status.txFullCount);
    logger.log(now, "SystemStats/CANBus/ReceiveErrorCount", status.receiveErrorCount);
    logger.log(now, "SystemStats/CANBus/TransmitErrorCount", status.transmitErrorCount);

    logger.log(now, "SystemStats/EpochTimeMicros", HALUtil.getFPGATime(), MICROSECONDS_UNIT_STRING);
  }

  private void logPdh(long now) {
    if (pdh == null) {
      return;
    }

    logger.log(
        now,
        "SystemStats/PowerDistribution/Temperature",
        pdh.getTemperature(),
        CELSIUS_UNIT_STRING);
    logger.log(now, "SystemStats/PowerDistribution/Voltage", pdh.getVoltage(), VOLTS_UNIT_STRING);
    logger.log(
        now,
        "SystemStats/PowerDistribution/ChannelCurrent",
        pdh.getAllCurrents(),
        AMPS_UNIT_STRING);
    logger.log(
        now, "SystemStats/PowerDistribution/TotalCurrent", pdh.getTotalCurrent(), AMPS_UNIT_STRING);
    logger.log(
        now, "SystemStats/PowerDistribution/TotalPower", pdh.getTotalPower(), WATTS_UNIT_STRING);
    logger.log(
        now, "SystemStats/PowerDistribution/TotalEnergy", pdh.getTotalEnergy(), JOULES_UNIT_STRING);
    logger.log(now, "SystemStats/PowerDistribution/ChannelCount", pdh.getNumChannels());
  }

  private void logRadio() {
    var now = HALUtil.getFPGATime();
    radioLogUtil.refresh();

    logger.log(now, "RadioStatus/Connected", radioLogUtil.radioLogResult.isConnected);
    logger.log(now, "RadioStatus/StatusJson", radioLogUtil.radioLogResult.statusJson, "json");
  }

  @Override
  public void close() {
    notifier.close();
    radioNotifier.close();
  }
}
