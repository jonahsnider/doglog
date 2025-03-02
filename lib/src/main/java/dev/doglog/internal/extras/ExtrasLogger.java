// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.extras;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.LogQueuer;
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

  private final LogQueuer logger;

  private final CANStatus status = new CANStatus();

  private PowerDistribution pdh;

  private final Notifier notifier = new Notifier(this::log);

  private final Notifier radioNotifier = new Notifier(this::logRadio);
  private final RadioLogUtil radioLogUtil = new RadioLogUtil();

  public ExtrasLogger(LogQueuer logger, DogLogOptions initialOptions) {
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
      notifier.stop();
      radioNotifier.stop();
    } else {
      notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
      radioNotifier.startPeriodic(RADIO_LOG_PERIOD_SECONDS);
    }
  }

  public void setPdh(PowerDistribution pdh) {
    this.pdh = pdh;
  }

  private void log() {
    // Instead of logging directly to DogLog, we write logs to LogQueuer directly. This lets us get
    // the timestamp a single time and reuse that value for all log entries.
    var now = HALUtil.getFPGATime();

    logSystem(now);
    logCan(now);
    logPdh(now);
  }

  private void logSystem(long now) {
    logger.queueLog(now, "SystemStats/FPGAVersion", HALUtil.getFPGAVersion());
    logger.queueLog(now, "SystemStats/FPGARevision", HALUtil.getFPGARevision());
    logger.queueLog(now, "SystemStats/SerialNumber", HALUtil.getSerialNumber());
    logger.queueLog(now, "SystemStats/Comments", HALUtil.getComments());
    logger.queueLog(now, "SystemStats/TeamNumber", HALUtil.getTeamNumber());
    logger.queueLog(now, "SystemStats/FPGAButton", HALUtil.getFPGAButton());
    logger.queueLog(now, "SystemStats/SystemActive", HAL.getSystemActive());
    logger.queueLog(now, "SystemStats/BrownedOut", HAL.getBrownedOut());
    logger.queueLog(now, "SystemStats/RSLState", HAL.getRSLState());
    logger.queueLog(now, "SystemStats/SystemTimeValid", HAL.getSystemTimeValid());

    logger.queueLog(now, "SystemStats/BatteryVoltage", PowerJNI.getVinVoltage());
    logger.queueLog(now, "SystemStats/BatteryCurrent", PowerJNI.getVinCurrent());

    logger.queueLog(now, "SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3());
    logger.queueLog(now, "SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3());
    logger.queueLog(now, "SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    logger.queueLog(now, "SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    logger.queueLog(now, "SystemStats/5vRail/Voltage", PowerJNI.getUserVoltage5V());
    logger.queueLog(now, "SystemStats/5vRail/Current", PowerJNI.getUserCurrent5V());
    logger.queueLog(now, "SystemStats/5vRail/Active", PowerJNI.getUserActive5V());
    logger.queueLog(now, "SystemStats/5vRail/CurrentFaults", PowerJNI.getUserCurrentFaults5V());

    logger.queueLog(now, "SystemStats/6vRail/Voltage", PowerJNI.getUserVoltage6V());
    logger.queueLog(now, "SystemStats/6vRail/Current", PowerJNI.getUserCurrent6V());
    logger.queueLog(now, "SystemStats/6vRail/Active", PowerJNI.getUserActive6V());
    logger.queueLog(now, "SystemStats/6vRail/CurrentFaults", PowerJNI.getUserCurrentFaults6V());

    logger.queueLog(now, "SystemStats/BrownoutVoltage", PowerJNI.getBrownoutVoltage());
    logger.queueLog(now, "SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp());
  }

  private void logCan(long now) {
    CANJNI.getCANStatus(status);
    logger.queueLog(now, "SystemStats/CANBus/Utilization", status.percentBusUtilization);
    logger.queueLog(now, "SystemStats/CANBus/OffCount", status.busOffCount);
    logger.queueLog(now, "SystemStats/CANBus/TxFullCount", status.txFullCount);
    logger.queueLog(now, "SystemStats/CANBus/ReceiveErrorCount", status.receiveErrorCount);
    logger.queueLog(now, "SystemStats/CANBus/TransmitErrorCount", status.transmitErrorCount);

    logger.queueLog(now, "SystemStats/EpochTimeMicros", HALUtil.getFPGATime());
  }

  private void logPdh(long now) {
    if (pdh == null) {
      return;
    }

    logger.queueLog(now, "SystemStats/PowerDistribution/Temperature", pdh.getTemperature());
    logger.queueLog(now, "SystemStats/PowerDistribution/Voltage", pdh.getVoltage());
    logger.queueLog(now, "SystemStats/PowerDistribution/ChannelCurrent", pdh.getAllCurrents());
    logger.queueLog(now, "SystemStats/PowerDistribution/TotalCurrent", pdh.getTotalCurrent());
    logger.queueLog(now, "SystemStats/PowerDistribution/TotalPower", pdh.getTotalPower());
    logger.queueLog(now, "SystemStats/PowerDistribution/TotalEnergy", pdh.getTotalEnergy());
    logger.queueLog(now, "SystemStats/PowerDistribution/ChannelCount", pdh.getNumChannels());
  }

  private void logRadio() {
    var now = HALUtil.getFPGATime();
    radioLogUtil.refresh();

    logger.queueLog(now, "RadioStatus/Connected", radioLogUtil.radioLogResult.isConnected);
    logger.queueLog(now, "RadioStatus/StatusJson", radioLogUtil.radioLogResult.statusJson, "json");
  }
}
