import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { VendorStatus } from "../types.js";

const uuidSchema = z.string().uuid("Invalid ID format");
const costSchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Unit cost must be a valid amount with up to 2 decimal places",
  );
const statusQuerySchema = z.nativeEnum(VendorStatus).optional();

const createProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  unitCost: costSchema,
});

const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.vendorId || req.params.id;
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  next();
};

export const validateSkuParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (
    !req.params.sku ||
    typeof req.params.sku !== "string" ||
    req.params.sku.trim() === ""
  ) {
    return res.status(400).json({ error: "SKU is required" });
  }
  next();
};

export const validateStatusQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = statusQuerySchema.safeParse(req.query.status);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  next();
};

export const validateCreateProduct = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = {
    sku: result.data.sku.trim(),
    unitCost: result.data.unitCost.trim(),
  };
  next();
};

export const validateUpdateProduct = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = updateProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};
