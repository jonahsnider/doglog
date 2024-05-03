// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.extras;

import dev.doglog.internal.log_thread.LogQueuer;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.hal.PowerJNI;
import edu.wpi.first.hal.can.CANJNI;
import edu.wpi.first.hal.can.CANStatus;

public class ExtrasLogger {
  public static void log(LogQueuer logger) {
    logger.queueLog("SystemStats/FPGAVersion", HALUtil.getFPGAVersion());
    logger.queueLog("SystemStats/FPGARevision", HALUtil.getFPGARevision());
    logger.queueLog("SystemStats/SerialNumber", HALUtil.getSerialNumber());
    logger.queueLog("SystemStats/Comments", HALUtil.getComments());
    logger.queueLog("SystemStats/TeamNumber", HALUtil.getTeamNumber());
    logger.queueLog("SystemStats/FPGAButton", HALUtil.getFPGAButton());
    logger.queueLog("SystemStats/SystemActive", HAL.getSystemActive());
    logger.queueLog("SystemStats/BrownedOut", HAL.getBrownedOut());
    logger.queueLog("SystemStats/RSLState", HAL.getRSLState());
    logger.queueLog("SystemStats/SystemTimeValid", HAL.getSystemTimeValid());

    logger.queueLog("SystemStats/BatteryVoltage", PowerJNI.getVinVoltage());
    logger.queueLog("SystemStats/BatteryCurrent", PowerJNI.getVinCurrent());

    logger.queueLog("SystemStats/3v3Rail/Voltage", PowerJNI.getUserVoltage3V3());
    logger.queueLog("SystemStats/3v3Rail/Current", PowerJNI.getUserCurrent3V3());
    logger.queueLog("SystemStats/3v3Rail/Active", PowerJNI.getUserActive3V3());
    logger.queueLog("SystemStats/3v3Rail/CurrentFaults", PowerJNI.getUserCurrentFaults3V3());

    logger.queueLog("SystemStats/5vRail/Voltage", PowerJNI.getUserVoltage5V());
    logger.queueLog("SystemStats/5vRail/Current", PowerJNI.getUserCurrent5V());
    logger.queueLog("SystemStats/5vRail/Active", PowerJNI.getUserActive5V());
    logger.queueLog("SystemStats/5vRail/CurrentFaults", PowerJNI.getUserCurrentFaults5V());

    logger.queueLog("SystemStats/6vRail/Voltage", PowerJNI.getUserVoltage6V());
    logger.queueLog("SystemStats/6vRail/Current", PowerJNI.getUserCurrent6V());
    logger.queueLog("SystemStats/6vRail/Active", PowerJNI.getUserActive6V());
    logger.queueLog("SystemStats/6vRail/CurrentFaults", PowerJNI.getUserCurrentFaults6V());

    logger.queueLog("SystemStats/BrownoutVoltage", PowerJNI.getBrownoutVoltage());
    logger.queueLog("SystemStats/CPUTempCelcius", PowerJNI.getCPUTemp());

    CANStatus status = new CANStatus();
    CANJNI.getCANStatus(status);
    logger.queueLog("SystemStats/CANBus/Utilization", status.percentBusUtilization);
    logger.queueLog("SystemStats/CANBus/OffCount", status.busOffCount);
    logger.queueLog("SystemStats/CANBus/TxFullCount", status.txFullCount);
    logger.queueLog("SystemStats/CANBus/ReceiveErrorCount", status.receiveErrorCount);
    logger.queueLog("SystemStats/CANBus/TransmitErrorCount", status.transmitErrorCount);

    logger.queueLog("SystemStats/EpochTimeMicros", HALUtil.getFPGATime());

    PowerDistributionExtrasLogger.log(logger);
  }

  private ExtrasLogger() {}
}
