import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../types.js";

export interface PostgresError extends Error {
  code?: string;
  cause?: { code?: string };
}

export function isUniqueViolation(error: unknown): error is PostgresError {
  if (typeof error !== "object" || error === null) return false;

  const err = error as PostgresError;

  if ("code" in err && err.code === "23505") return true;
  if (err.cause && typeof err.cause === "object" && "code" in err.cause) {
    return (err.cause as { code?: string }).code === "23505";
  }

  return false;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  if (isUniqueViolation(err)) {
    return res
      .status(409)
      .json({ error: "A record with this unique value already exists" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}