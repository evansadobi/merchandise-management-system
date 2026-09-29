import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid ID format");

const createZoneSchema = z.object({
  warehouseId: z.string().min(1, "warehouseId is required"),
  code: z.enum(["FAST", "MID", "BULK"], {
    message: "code must be FAST, MID, or BULK",
  }),
  description: z.string().max(255).optional(),
});

const createAisleSchema = z.object({
  zoneId: z.string().uuid("zoneId must be a valid UUID"),
  code: z.string().min(1, "code is required").max(50),
});

const createShelfSchema = z.object({
  aisleId: z.string().uuid("aisleId must be a valid UUID"),
  code: z.string().min(1, "code is required").max(50),
});

const createBinSchema = z.object({
  shelfId: z.string().uuid("shelfId must be a valid UUID"),
  binCode: z.string().min(1, "binCode is required").max(50),
  capacityUnits: z.number().int().positive("capacityUnits must be positive"),
});

const startTaskSchema = z.object({
  assignedTo: z.string().min(1).max(255).optional(),
});

const completePutawaySchema = z.object({
  actualBinId: z.string().uuid("actualBinId must be a valid UUID"),
});

const createTransferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "at least one item is required"),
});

const suggestBinSchema = z.object({
  sku: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  warehouseId: z.string().min(1).optional(),
});

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  next();
};

export const validateCreateZone = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createZoneSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateCreateAisle = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createAisleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateCreateShelf = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createShelfSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateCreateBin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createBinSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateStartTask = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = startTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateCompletePutaway = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = completePutawaySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateCreateTransfer = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createTransferSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

export const validateSuggestBin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = suggestBinSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message ?? "Validation failed",
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};
