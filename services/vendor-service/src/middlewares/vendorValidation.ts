import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { VendorStatus } from "../types.js";

const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

const uuidSchema = z.string().uuid("Invalid vendor ID format");

const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contactEmail: z.string().email("Invalid contact email"),
  contactPhone: z.string().regex(PHONE_REGEX, "Invalid contact phone format"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  leadTimeDays: z
    .number()
    .int()
    .nonnegative("Lead time must be a non-negative integer"),
});

const updateVendorSchema = createVendorSchema
  .partial()
  .extend({
    status: z.nativeEnum(VendorStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid vendor ID format" });
  }
  next();
};

export const validateCreateVendor = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = createVendorSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

export const validateUpdateVendor = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = updateVendorSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};
