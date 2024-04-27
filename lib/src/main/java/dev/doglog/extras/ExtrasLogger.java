// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.extras;

import dev.doglog.loggers.DogLogLogger;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.hal.PowerJNI;
import edu.wpi.first.hal.can.CANJNI;
import edu.wpi.first.hal.can.CANStatus;

public class ExtrasLogger {
  public static void log(DogLogLogger logger) {
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

    CANStatus status = new CANStatus();
    CANJNI.getCANStatus(status);
    logger.log("SystemStats/CANBus/Utilization", status.percentBusUtilization);
    logger.log("SystemStats/CANBus/OffCount", status.busOffCount);
    logger.log("SystemStats/CANBus/TxFullCount", status.txFullCount);
    logger.log("SystemStats/CANBus/ReceiveErrorCount", status.receiveErrorCount);
    logger.log("SystemStats/CANBus/TransmitErrorCount", status.transmitErrorCount);

    logger.log("SystemStats/EpochTimeMicros", HALUtil.getFPGATime());

    PowerDistributionExtrasLogger.log(logger);
  }

  private ExtrasLogger() {}
}
