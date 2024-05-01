// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.extras;

import dev.doglog.internal.log_thread.LogQueuer;
import edu.wpi.first.wpilibj.PowerDistribution;

class PowerDistributionExtrasLogger {
  private static final PowerDistribution pdh = new PowerDistribution();
  private static final double[] currents = new double[pdh.getNumChannels()];

  public static void log(LogQueuer logger) {
    for (int i = 0; i < currents.length; i++) {
      currents[i] = pdh.getCurrent(i);
    }

    logger.queueLog("SystemStats/PowerDistribution/Temperature", pdh.getTemperature());
    logger.queueLog("SystemStats/PowerDistribution/Voltage", pdh.getVoltage());
    logger.queueLog("SystemStats/PowerDistribution/ChannelCurrent", currents);
    logger.queueLog("SystemStats/PowerDistribution/TotalCurrent", pdh.getTotalCurrent());
    logger.queueLog("SystemStats/PowerDistribution/TotalPower", pdh.getTotalPower());
    logger.queueLog("SystemStats/PowerDistribution/TotalEnergy", pdh.getTotalEnergy());

    logger.queueLog("SystemStats/PowerDistribution/ChannelCount", pdh.getNumChannels());
  }

  private PowerDistributionExtrasLogger() {}
}
