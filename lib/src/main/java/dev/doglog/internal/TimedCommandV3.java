package dev.doglog.internal;

import dev.doglog.DogLog;
import java.util.Set;
import org.wpilib.command3.Command;
import org.wpilib.command3.Coroutine;
import org.wpilib.command3.Mechanism;
import org.wpilib.hardware.hal.HALUtil;

public class TimedCommandV3 implements Command {
  private final Command command;
  private final String key;

  public TimedCommandV3(Command command, String key) {
    this.command = command;
    this.key = key;
  }

  @Override
  public String name() {
    return "Timed" + command.name();
  }

  @Override
  public int priority() {
    return command.priority();
  }

  @Override
  public Set<Mechanism> requirements() {
    return command.requirements();
  }

  @Override
  public void run(Coroutine coroutine) {
    var startTime = HALUtil.getMonotonicTime();
    coroutine.await(command);
    var elapsed = (HALUtil.getMonotonicTime() - startTime) / 1_000_000_000.0;
    DogLog.log(key, elapsed);
  }
}
