import type { Request, Response, NextFunction } from "express";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UpstreamServiceError,
} from "../types.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ message: err.message });
  }
  if (err instanceof BadRequestError) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ message: err.message });
  }
  if (err instanceof UpstreamServiceError) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
}
