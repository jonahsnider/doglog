package dev.doglog.internal;

import com.google.errorprone.annotations.ThreadSafe;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.wpilib.util.protobuf.Protobuf;
import org.wpilib.util.protobuf.ProtobufSerializable;

/** Used internally for working with WPILib {@link Protobuf}s. */
@ThreadSafe
public class ProtobufRegistry {
  private static final String PROTO_FIELD_NAME = "proto";

  private static <T extends ProtobufSerializable> Optional<Protobuf<?, ?>> getProtoRaw(
      Class<T> classObj) {
    try {
      var field = classObj.getDeclaredField(PROTO_FIELD_NAME);
      @SuppressWarnings("unchecked")
      var resolvedProto = (Protobuf<T, ?>) field.get(null);

      return Optional.of(resolvedProto);
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  private final Map<Class<? extends ProtobufSerializable>, Optional<Protobuf<?, ?>>>
      resolvedProtos = new ConcurrentHashMap<>();

  public Optional<Protobuf<?, ?>> getProto(Class<? extends ProtobufSerializable> entryClass) {
    return resolvedProtos.computeIfAbsent(entryClass, key -> getProtoRaw(entryClass));
  }
}
