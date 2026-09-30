import * as grpc from "@grpc/grpc-js";

export function mapInventoryError(error: unknown): grpc.ServiceError {
  const defaultMessage = "Inventory operation failed.";
  const message =
    error instanceof Error ? error.message || defaultMessage : defaultMessage;

  if (message.toLowerCase().includes("not found")) {
    return {
      code: grpc.status.NOT_FOUND,
      details: message,
      message,
      name: "InventoryError",
      metadata: new grpc.Metadata(),
    };
  }

  if (
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("required") ||
    message.toLowerCase().includes("must")
  ) {
    return {
      code: grpc.status.INVALID_ARGUMENT,
      details: message,
      message,
      name: "InventoryError",
      metadata: new grpc.Metadata(),
    };
  }

  if (
    message.toLowerCase().includes("insufficient") ||
    message.toLowerCase().includes("reservation") ||
    message.toLowerCase().includes("mismatch")
  ) {
    return {
      code: grpc.status.FAILED_PRECONDITION,
      details: message,
      message,
      name: "InventoryError",
      metadata: new grpc.Metadata(),
    };
  }

  if (message.toLowerCase().includes("conflict")) {
    return {
      code: grpc.status.ABORTED,
      details: message,
      message,
      name: "InventoryError",
      metadata: new grpc.Metadata(),
    };
  }

  return {
    code: grpc.status.INTERNAL,
    details: message,
    message,
    name: "InventoryError",
    metadata: new grpc.Metadata(),
  };
}
