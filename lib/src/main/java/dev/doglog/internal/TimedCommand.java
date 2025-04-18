package dev.doglog.internal;

import dev.doglog.DogLog;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;

public class TimedCommand extends Command {
  private final Command command;
  private final String key;

  public TimedCommand(Command command, String key) {
    this.command = command;
    this.key = key;

    setName("Timed" + command.getName());

    addRequirements(command.getRequirements());
  }

  @Override
  public void initialize() {
    CommandScheduler.getInstance().registerComposedCommands(command);

    DogLog.time(key + "/.initialize()");
    command.initialize();
    DogLog.timeEnd(key + "/.initialize()");
  }

  @Override
  public void execute() {
    DogLog.time(key + "/.execute()");
    command.execute();
    DogLog.timeEnd(key + "/.execute()");
  }

  @Override
  public boolean isFinished() {
    return command.isFinished();
  }

  @Override
  public boolean runsWhenDisabled() {
    return command.runsWhenDisabled();
  }

  @Override
  public void end(boolean interrupted) {
    var logKey = key + "/.end(" + interrupted + ")";
    DogLog.time(logKey);
    command.end(interrupted);
    DogLog.timeEnd(logKey);
  }
}
