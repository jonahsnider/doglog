package dev.doglog.internal;

import dev.doglog.DogLog;
import org.wpilib.command2.Command;
import org.wpilib.command2.CommandScheduler;

public class TimedCommand extends Command {
  private final Command command;
  private final String key;

  public TimedCommand(Command command, String key) {
    this.command = command;
    this.key = key;

    setName("Timed" + command.getName());

    CommandScheduler.getInstance().registerComposedCommands(command);

    addRequirements(command.getRequirements());
  }

  @Override
  public void end(boolean interrupted) {
    var logKey = key + "/.end(" + interrupted + ")";
    DogLog.time(logKey);
    command.end(interrupted);
    DogLog.timeEnd(logKey);
  }

  @Override
  public void execute() {
    DogLog.time(key + "/.execute()");
    command.execute();
    DogLog.timeEnd(key + "/.execute()");
  }

  @Override
  public void initialize() {
    DogLog.time(key + "/.initialize()");
    command.initialize();
    DogLog.timeEnd(key + "/.initialize()");
  }

  @Override
  public boolean isFinished() {
    return command.isFinished();
  }

  @Override
  public boolean runsWhenDisabled() {
    return command.runsWhenDisabled();
  }
}
