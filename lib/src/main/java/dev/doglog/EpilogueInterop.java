package dev.doglog;

import edu.wpi.first.epilogue.EpilogueConfiguration;
import edu.wpi.first.epilogue.Logged;
import edu.wpi.first.epilogue.NotLogged;
import edu.wpi.first.epilogue.logging.EpilogueBackend;
import edu.wpi.first.epilogue.logging.FileBackend;
import edu.wpi.first.epilogue.logging.NTEpilogueBackend;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.TimedRobot;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/** A utility class that allows DogLog to interop with Epilogue. */
public class EpilogueInterop {
	private static final Map<Object, String> logPathStore = new HashMap<>();
	private static EpilogueConfiguration syncedConfig = null;
	private static boolean isEnabled = false;
	
	/**
	 * Checks if epilogue interop is enabled.
	 * @return If epilogue interop is enabled.
	 */
	public static boolean isEnabled() { return isEnabled; }
	
	/**
	 * Returns a log "path" that allows a value to be logged
	 * under the same namespace as epilogue.
	 * <p>Example:</p>
	 * <pre>
	 *     import static dev.doglog.EpilogueInterop.logPath;
	 *     public class Robot extends TimedRobot {
	 *         private final Arm arm = new Arm();
	 *     }
	 *
	 *     {@literal @}Logged
	 *      public class Arm extends SubsystemBase {
	 *          private double position; // logs under Robot/arm/position
	 *          public Arm() {
	 *              // logs under Robot/arm/initialState;
	 *              // shows up next to the "position" field
	 *              DogLog.log(logPath(this, "initialState"), "open");
	 *          }
	 *      }
	 * </pre>
	 * @param thisRef A reference of "this" object.
	 * @param fieldName The field in which you want to log under.
	 * @return A log path that matches with epilogue
	 */
	public static String logPath(Object thisRef, String fieldName) {
		return logPathStore.getOrDefault(thisRef, "Unknown") + "/" + fieldName;
	}
	
	/**
	 * Enables epilogue and DogLog interop.
	 * This allows for epilogue's {@link EpilogueConfiguration} to be synced
	 * with your configured {@link DogLogOptions} automatically,
	 * and allows you to manually log values(via doglog)
	 * under the same namespace as epilogue.
	 *
	 * <p>Example:</p>
	 * <pre>EpilogueInterop.enable(this, Epilogue.getConfig());</pre>
	 *
	 * @param robot The robot class.
	 * @param epilogueConfig Your current epilogue config; fetched by ```Epilogue.getConfig()```.
	 */
	public static void enable(TimedRobot robot, EpilogueConfiguration epilogueConfig) {
		if (isEnabled) return;
		isEnabled = true;
		recurse(robot, "");
		syncedConfig = epilogueConfig;
		syncEpilogueConfig(DogLog.getOptions());
	}
	
	static void syncEpilogueConfig(DogLogOptions options) {
		var fileBackend = new FileBackend(DataLogManager.getLog());
		syncedConfig.backend = options.ntPublish()
           ? EpilogueBackend.multi(fileBackend, new NTEpilogueBackend(NetworkTableInstance.getDefault()))
           : fileBackend;
	}
	
	private static void recurse(Object root, String currentPath) {
		var clazz = root.getClass();
		var loggedAnno = clazz.getAnnotation(Logged.class);
		if (loggedAnno == null) return;
		
		logPathStore.put(root, currentPath);
		var fieldsStream = Arrays.stream(clazz.getDeclaredFields());
		if (loggedAnno.strategy() == Logged.Strategy.OPT_IN) {
			fieldsStream = fieldsStream.filter(field -> field.isAnnotationPresent(Logged.class));
		}
		fieldsStream = fieldsStream.filter(field -> !field.isAnnotationPresent(NotLogged.class));
		
		fieldsStream.forEach(field -> {
			field.setAccessible(true);
			String fieldName = loggedAnno.name().isEmpty() ? field.getName() : loggedAnno.name();
			try {
				recurse(field.get(root), currentPath + "/" + fieldName);
			} catch (IllegalAccessException e) {
				throw new RuntimeException(e);
			}
		});
	}
}