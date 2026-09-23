import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid ID format");

const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid("vendorId must be a valid UUID"),
  sku: z.string().min(1, "sku is required"),
  quantity: z.number().int().positive("quantity must be a positive integer"),
});

const approvePurchaseOrderSchema = z.object({
  approvedBy: z.string().min(1, "approvedBy is required"),
});

const receivePurchaseOrderSchema = z.object({
  quantityReceived: z
    .number()
    .int()
    .positive("quantityReceived must be a positive integer"),
});

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid purchase order ID format" });
  }
  next();
};

export const validateCreatePurchaseOrder = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createPurchaseOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

export const validateApprovePurchaseOrder = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = approvePurchaseOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

export const validateReceivePurchaseOrder = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = receivePurchaseOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};
