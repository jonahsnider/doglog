// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import dev.doglog.DogLog;
import dev.doglog.DogLogOptions;
import org.wpilib.command2.Command;
import org.wpilib.command2.Commands;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.units.Units;

public class RobotContainer {
  public RobotContainer() {
    DogLog.setOptions(new DogLogOptions().withCaptureDs(true));
    DogLog.setPdh(new PowerDistribution(0));

    configureBindings();
  }

  public Command getAutonomousCommand() {
    return DogLog.time(
        "Debug/AutoCommand", Commands.waitTime(Units.Seconds.of(0.75)).withName("MyAutoCommand"));
  }

  private void configureBindings() {}
}
