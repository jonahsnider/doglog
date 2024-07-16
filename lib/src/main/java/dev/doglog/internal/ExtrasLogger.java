// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.reporters.CombinedReporter;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.hal.PowerJNI;
import edu.wpi.first.hal.can.CANJNI;
import edu.wpi.first.hal.can.CANStatus;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.PowerDistribution;
import edu.wpi.first.wpilibj.Timer;

/** Logs "extra" information. */
public class ExtrasLogger {
  private static final double LOOP_PERIOD_SECONDS = 0.02;

  private final Timer timer = new Timer();

  private final CombinedReporter logger;

  private PowerDistribution pdh;
  private double[] currents;

  private DogLogOptions options;

  public ExtrasLogger(CombinedReporter logger, DogLogOptions initialOptions) {
    timer.start();
    this.logger = logger;
    this.options = initialOptions;

    try {
      // Throws if a PowerDistribution has already been initialized in user code
      pdh = new PowerDistribution();
      currents = new double[pdh.getNumChannels()];
    } catch (Exception e) {
      DriverStation.reportWarning(
          "[DogLog] DOG004: Failed to initialize PowerDistribution, PDH stats will not be logged",
          false);
      FaultLogger.logFault(logger, "[DogLog] DOG004");
      pdh = null;
      currents = null;
    }
  }

  public void setOptions(DogLogOptions options) {
    this.options = options;
  }

  public void heartbeat() {
    if (options.logExtras() && timer.hasElapsed(LOOP_PERIOD_SECONDS)) {
      timer.reset();
      log();
    }
  }

  private void log() {
    logSystem();
    logCan();
    logPdh();
  }

  private void logSystem() {
    logger.log("SystemStats/FPGAVersion", HALUtil.getFPGAVersion());
    logger.log("SystemStats/FPGARevision", HALUtil.getFPGARevision());
    logger.log("SystemStats/SerialNumber", HALUtil.getSerialNumber());
    logger.log("SystemStats/Comments", HALUtil.getComments());
    logger.log("SystemStats/TeamNumber", HALUtil.getTeamNumber());
    logger.log("SystemStats/FPGAButton", HALUtil.getFPGAButton());
    logger.log("SystemStats/SystemActive", HAL.getSystemActive());
    logger.log("SystemStats/BrownedOut", HAL.getBrownedOut());
    logger.log("SystemStats/RSLState", HAL.getRSLState());
    logger.log("SystemStats/SystemTimeValid", HAL.getSystemTimeValid());

    logger.log("SystemStats/BatteryVoltage", PowerJNI.getVinVoltage());
    logger.log("SystemStats/BatteryCurrent", PowerJNI.getVinCurrent());

    logger.log("SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3());
    logger.log("SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3());
    logger.log("SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    logger.log("SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    logger.log("SystemStats/5vRail/Voltage", PowerJNI.getUserVoltage5V());
    logger.log("SystemStats/5vRail/Current", PowerJNI.getUserCurrent5V());
    logger.log("SystemStats/5vRail/Active", PowerJNI.getUserActive5V());
    logger.log("SystemStats/5vRail/CurrentFaults", PowerJNI.getUserCurrentFaults5V());

    logger.log("SystemStats/6vRail/Voltage", PowerJNI.getUserVoltage6V());
    logger.log("SystemStats/6vRail/Current", PowerJNI.getUserCurrent6V());
    logger.log("SystemStats/6vRail/Active", PowerJNI.getUserActive6V());
    logger.log("SystemStats/6vRail/CurrentFaults", PowerJNI.getUserCurrentFaults6V());

    logger.log("SystemStats/BrownoutVoltage", PowerJNI.getBrownoutVoltage());
    logger.log("SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp());
  }

  private void logCan() {
    CANStatus status = new CANStatus();
    CANJNI.getCANStatus(status);
    logger.log("SystemStats/CANBus/Utilization", status.percentBusUtilization);
    logger.log("SystemStats/CANBus/OffCount", status.busOffCount);
    logger.log("SystemStats/CANBus/TxFullCount", status.txFullCount);
    logger.log("SystemStats/CANBus/ReceiveErrorCount", status.receiveErrorCount);
    logger.log("SystemStats/CANBus/TransmitErrorCount", status.transmitErrorCount);

    logger.log("SystemStats/EpochTimeMicros", HALUtil.getFPGATime());
  }

  private void logPdh() {
    if (pdh == null) {
      return;
    }

    for (int i = 0; i < currents.length; i++) {
      currents[i] = pdh.getCurrent(i);
    }

    logger.log("SystemStats/PowerDistribution/Temperature", pdh.getTemperature());
    logger.log("SystemStats/PowerDistribution/Voltage", pdh.getVoltage());
    logger.log("SystemStats/PowerDistribution/ChannelCurrent", currents);
    logger.log("SystemStats/PowerDistribution/TotalCurrent", pdh.getTotalCurrent());
    logger.log("SystemStats/PowerDistribution/TotalPower", pdh.getTotalPower());
    logger.log("SystemStats/PowerDistribution/TotalEnergy", pdh.getTotalEnergy());

    logger.log("SystemStats/PowerDistribution/ChannelCount", pdh.getNumChannels());
  }
}
