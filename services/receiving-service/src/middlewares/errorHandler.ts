import type { Request, Response, NextFunction } from "express";
import { NotFoundError, ConflictError, ValidationError } from "../types.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: "NotFoundError",
      message: err.message,
    });
  }

  if (err instanceof ConflictError) {
    return res.status(409).json({
      error: "ConflictError",
      message: err.message,
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: "ValidationError",
      message: err.message,
    });
  }

  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return res.status(400).json({
      error: "BadRequestError",
      message: "Malformed JSON payload provided",
    });
  }

  console.error(`[UNHANDLED ERROR] ${req.method} ${req.path}:`, err);

  return res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected internal server error occurred",
  });
}
