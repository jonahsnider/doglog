package dev.doglog.internal.extras;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.reporters.CombinedReporter;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.hal.PowerJNI;
import edu.wpi.first.hal.can.CANJNI;
import edu.wpi.first.hal.can.CANStatus;
import edu.wpi.first.wpilibj.Notifier;
import edu.wpi.first.wpilibj.PowerDistribution;

/** Logs "extra" information. */
public class ExtrasLogger {
  private static final double RADIO_LOG_PERIOD_SECONDS = 5.81;

  private final CombinedReporter logger;

  private final CANStatus status = new CANStatus();

  private PowerDistribution pdh;

  private final Notifier notifier = new Notifier(this::log);

  private final Notifier radioNotifier = new Notifier(this::logRadio);
  private final RadioLogUtil radioLogUtil = new RadioLogUtil();

  public ExtrasLogger(CombinedReporter logger, DogLogOptions initialOptions) {
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

  public void setPdh(PowerDistribution pdh) {
    this.pdh = pdh;
  }

  private void log() {
    // Instead of logging directly to DogLog, we write logs to CombinedReporter directly. This lets
    // us get the timestamp a single time and reuse that value for all log entries.
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

    logger.log(now, "SystemStats/BatteryVoltage", PowerJNI.getVinVoltage());
    logger.log(now, "SystemStats/BatteryCurrent", PowerJNI.getVinCurrent());

    logger.log(now, "SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3());
    logger.log(now, "SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3());
    logger.log(now, "SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    logger.log(now, "SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    logger.log(now, "SystemStats/BrownoutVoltage", PowerJNI.getBrownoutVoltage());
    logger.log(now, "SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp());
  }

  private void logCan(long now) {
    for (int i = 0; i < 5; i++) {
      CANJNI.getCANStatus(i, status);
      var logPrefix = "SystemStats/CANBus/can_s" + i;

      logger.log(now, logPrefix + "/Utilization", status.percentBusUtilization);
      logger.log(now, logPrefix + "/OffCount", status.busOffCount);
      logger.log(now, logPrefix + "/TxFullCount", status.txFullCount);
      logger.log(now, logPrefix + "/ReceiveErrorCount", status.receiveErrorCount);
      logger.log(now, logPrefix + "/TransmitErrorCount", status.transmitErrorCount);
    }

    logger.log(now, "SystemStats/EpochTimeMicros", now);
  }

  private void logPdh(long now) {
    if (pdh == null) {
      return;
    }

    logger.log(now, "SystemStats/PowerDistribution/Temperature", pdh.getTemperature());
    logger.log(now, "SystemStats/PowerDistribution/Voltage", pdh.getVoltage());
    logger.log(now, "SystemStats/PowerDistribution/ChannelCurrent", pdh.getAllCurrents());
    logger.log(now, "SystemStats/PowerDistribution/TotalCurrent", pdh.getTotalCurrent());
    logger.log(now, "SystemStats/PowerDistribution/TotalPower", pdh.getTotalPower());
    logger.log(now, "SystemStats/PowerDistribution/TotalEnergy", pdh.getTotalEnergy());
    logger.log(now, "SystemStats/PowerDistribution/ChannelCount", pdh.getNumChannels());
  }

  private void logRadio() {
    var now = HALUtil.getFPGATime();
    radioLogUtil.refresh();

    logger.log(now, "RadioStatus/Connected", radioLogUtil.radioLogResult.isConnected);
    logger.log(now, "RadioStatus/StatusJson", radioLogUtil.radioLogResult.statusJson, "json");
  }
}
