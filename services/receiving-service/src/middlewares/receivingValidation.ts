import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid ID format");

const receivingItemSchema = z.object({
  sku: z
    .string()
    .min(1, "sku is required")
    .max(100, "sku cannot exceed 100 characters"),
  receivedQuantity: z
    .number()
    .int("receivedQuantity must be an integer")
    .nonnegative("receivedQuantity must be 0 or greater"),
  damagedQuantity: z
    .number()
    .int("damagedQuantity must be an integer")
    .nonnegative("damagedQuantity must be 0 or greater")
    .optional()
    .default(0),
  conditionNotes: z
    .string()
    .max(500, "conditionNotes cannot exceed 500 characters")
    .optional(),
});

const createGrnSchema = z.object({
  purchaseOrderId: z.string().uuid("purchaseOrderId must be a valid UUID"),
  supplierId: z.string().uuid("supplierId must be a valid UUID"),
  receivedBy: z
    .string()
    .min(1, "receivedBy is required")
    .max(255, "receivedBy cannot exceed 255 characters"),
  items: z.array(receivingItemSchema).min(1, "At least one item is required"),
});

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  next();
};

export const validateCreateGrn = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createGrnSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};
