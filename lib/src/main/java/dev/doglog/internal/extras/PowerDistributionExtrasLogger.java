// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.extras;

import dev.doglog.internal.loggers.DogLogLogger;
import edu.wpi.first.wpilibj.PowerDistribution;

class PowerDistributionExtrasLogger {
  private static final PowerDistribution pdh = new PowerDistribution();
  private static final double[] currents = new double[pdh.getNumChannels()];

  public static void log(DogLogLogger logger) {
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

  private PowerDistributionExtrasLogger() {}
}
