package dev.doglog.internal;

import com.google.errorprone.annotations.ThreadSafe;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.wpilib.util.struct.Struct;
import org.wpilib.util.struct.StructGenerator;

/** Used internally for working with WPILib {@link Struct}s. */
@ThreadSafe
public class StructRegistry {
  @SuppressWarnings("unchecked")
  private static <E extends Enum<E>> Struct<?> getEnumStructRaw(Class<?> enumClass) {
    return StructGenerator.genEnum((Class<E>) enumClass);
  }

  @SuppressWarnings("unchecked")
  private static <R extends Record> Struct<?> getRecordStructRaw(Class<?> recordClass) {
    return StructGenerator.genRecord((Class<R>) recordClass);
  }

  private final Map<Class<? extends Enum<?>>, Struct<?>> resolvedEnums = new ConcurrentHashMap<>();
  private final Map<Class<? extends Record>, Struct<?>> resolvedRecords = new ConcurrentHashMap<>();

  public Struct<?> getEnumStruct(Class<? extends Enum<?>> enumClass) {
    return resolvedEnums.computeIfAbsent(enumClass, key -> getEnumStructRaw(enumClass));
  }

  public Struct<?> getRecordStruct(Class<? extends Record> recordClass) {
    return resolvedRecords.computeIfAbsent(recordClass, key -> getRecordStructRaw(recordClass));
  }
}
