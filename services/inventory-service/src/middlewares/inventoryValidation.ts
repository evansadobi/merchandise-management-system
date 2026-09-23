import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid ID format");

const createInventorySchema = z.object({
  productName: z.string().min(1, "productName is required"),
  sku: z.string().min(1, "sku is required"),
  locationId: z.string().min(1).optional(),
  quantityOnHand: z.number().int().nonnegative().optional(),
  unitValue: z
    .string()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "unitValue must be a valid amount with up to 2 decimal places",
    )
    .optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
});

const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, "delta must be non-zero"),
  locationId: z.string().min(1).optional(),
});

const reserveStockSchema = z.object({
  quantity: z.number().int().positive("quantity must be a positive integer"),
  locationId: z.string().min(1).optional(),
});

const skuParamSchema = z.string().min(1, "SKU is required");

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid inventory item ID format" });
  }
  next();
};

export const validateSkuParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = skuParamSchema.safeParse(req.params.sku);
  if (!result.success) {
    return res.status(400).json({ error: "SKU is required" });
  }
  next();
};

export const validateCreateInventory = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createInventorySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

export const validateAdjustStock = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = adjustStockSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

export const validateReserveStock = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = reserveStockSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};
