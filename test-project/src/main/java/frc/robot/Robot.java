// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import com.ctre.phoenix6.hardware.TalonFX;
import dev.doglog.DogLog;
import edu.wpi.first.math.kinematics.SwerveModuleState;
import edu.wpi.first.wpilibj.TimedRobot;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import java.util.function.DoubleSupplier;

public class Robot extends TimedRobot {
  private final TalonFX motor = new TalonFX(5);
  private final DoubleSupplier tunableSupplier =
      DogLog.tunable(
          "my tunable number",
          0.0,
          (value) -> {
            DogLog.timestamp("Tunable/OnChange/Timestamp");
            DogLog.log("Tunable/OnChange/Value", value);
          });

  private Command m_autonomousCommand;

  private RobotContainer m_robotContainer;

  @Override
  public void robotInit() {
    m_robotContainer = new RobotContainer();
  }

  @Override
  public void robotPeriodic() {
    CommandScheduler.getInstance().run();

    DogLog.log("Debug/SwerveState", new SwerveModuleState());
    DogLog.log(
        "Debug/SwerveStates",
        new SwerveModuleState[] {
          new SwerveModuleState(),
          new SwerveModuleState(),
          new SwerveModuleState(),
          new SwerveModuleState()
        });
    DogLog.log("Debug/Position", motor.getPosition().getValueAsDouble());
    DogLog.log("Debug/Json", "{\"test\": \"json\"}", "json");

    DogLog.log("Tunable/SupplierValue", tunableSupplier.getAsDouble());
  }

  @Override
  public void disabledInit() {
    DogLog.decreaseFault("ExampleFault");
  }

  @Override
  public void disabledPeriodic() {}

  @Override
  public void disabledExit() {}

  @Override
  public void autonomousInit() {
    m_autonomousCommand = m_robotContainer.getAutonomousCommand();

    if (m_autonomousCommand != null) {
      m_autonomousCommand.schedule();
    }

    DogLog.clearFault("ExampleFault");
  }

  @Override
  public void autonomousPeriodic() {}

  @Override
  public void autonomousExit() {}

  @Override
  public void teleopInit() {
    if (m_autonomousCommand != null) {
      m_autonomousCommand.cancel();
    }
    DogLog.logFault("ExampleFault");
  }

  @Override
  public void teleopPeriodic() {}

  @Override
  public void teleopExit() {}

  @Override
  public void testInit() {
    CommandScheduler.getInstance().cancelAll();
  }

  @Override
  public void testPeriodic() {}

  @Override
  public void testExit() {}
}
