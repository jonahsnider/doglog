// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import static org.wpilib.units.Units.Centimeters;
import static org.wpilib.units.Units.Meters;

import com.ctre.phoenix6.hardware.TalonFX;
import dev.doglog.DogLog;
import java.util.function.DoubleSupplier;
import org.wpilib.command2.Command;
import org.wpilib.command2.CommandScheduler;
import org.wpilib.framework.TimedRobot;
import org.wpilib.math.kinematics.SwerveModuleVelocity;
import org.wpilib.sysid.SysIdRoutineLog;

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

  public Robot() {
    m_robotContainer = new RobotContainer();
  }

  @Override
  public void robotPeriodic() {
    DogLog.time("CommandSchedulerExecutionSec");
    CommandScheduler.getInstance().run();
    DogLog.timeEnd("CommandSchedulerExecutionSec");

    DogLog.log("Debug/SwerveState", new SwerveModuleVelocity());
    DogLog.log(
        "Debug/SwerveStates",
        new SwerveModuleVelocity[] {
          new SwerveModuleVelocity(),
          new SwerveModuleVelocity(),
          new SwerveModuleVelocity(),
          new SwerveModuleVelocity()
        });
    DogLog.log("Debug/Position", motor.getPosition().getValueAsDouble());
    DogLog.log("Debug/Json", "{\"test\": \"json\"}", "json");

    DogLog.log("Tunable/SupplierValue", tunableSupplier.getAsDouble());

    DogLog.log("Random/Random", Math.random());

    DogLog.log("Units/Height1", 123, "inches");
    DogLog.log("Units/Height2", 123, Meters);
    DogLog.log("Units/Height3", Centimeters.of(123));
    DogLog.log("Units/Height4", 123, "Meter");
    DogLog.log("Units/Height5", 123, "meter");
    DogLog.log("Units/Height7", motor.getPosition().getValueAsDouble());

    // An enum that can't be converted to a struct
    DogLog.log("BrokenEnumStruct", SysIdRoutineLog.State.DYNAMIC_FORWARD);
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
      CommandScheduler.getInstance().schedule(m_autonomousCommand);
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
  public void utilityInit() {
    CommandScheduler.getInstance().cancelAll();
  }

  @Override
  public void utilityPeriodic() {}

  @Override
  public void utilityExit() {}
}
