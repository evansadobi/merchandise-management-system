import type { Request, Response } from "express";
import { VendorRepository } from "../repositories/VendorRepository.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_STATUSES = [
  "PENDING",
  "APPROVED",
  "SUSPENDED",
  "ARCHIVED",
] as const;
type VendorStatus = (typeof VALID_STATUSES)[number];

// Postgres error shape for unique constraint violations
interface PostgresError extends Error {
  code?: string;
  cause?: { code?: string };
}

function isUniqueViolation(error: unknown): error is PostgresError {
  if (typeof error !== "object" || error === null) return false;

  const err = error as PostgresError;

  if ("code" in err && err.code === "23505") return true;
  if (err.cause && typeof err.cause === "object" && "code" in err.cause) {
    return (err.cause as { code?: string }).code === "23505";
  }

  return false;
}

export class VendorController {
  private vendorRepo = new VendorRepository();

  getVendors = async (_req: Request, res: Response) => {
    try {
      const vendors = await this.vendorRepo.findAll();

      return res.status(200).json(vendors);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);

      return res.status(500).json({
        error: "Failed to fetch vendors",
      });
    }
  };

  getVendorById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({
          error: "Invalid vendor ID format",
        });
      }

      const vendor = await this.vendorRepo.findById(id);

      if (!vendor) {
        return res.status(404).json({
          error: "Vendor not found",
        });
      }

      return res.status(200).json(vendor);
    } catch (error) {
      console.error("Failed to fetch vendor:", error);

      return res.status(500).json({
        error: "Failed to fetch vendor",
      });
    }
  };

  createVendor = async (req: Request, res: Response) => {
    try {
      const { name, contactEmail, contactPhone, paymentTerms, leadTimeDays } =
        req.body;

      // Validate vendor name
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          error: "Vendor name is required",
        });
      }

      // Validate email
      if (typeof contactEmail !== "string" || contactEmail.trim() === "") {
        return res.status(400).json({
          error: "Contact email is required",
        });
      }

      if (!EMAIL_REGEX.test(contactEmail)) {
        return res.status(400).json({
          error: "Invalid contact email",
        });
      }

      // Validate phone (required)
      if (typeof contactPhone !== "string" || contactPhone.trim() === "") {
        return res.status(400).json({
          error: "Contact phone is required",
        });
      }

      if (!PHONE_REGEX.test(contactPhone.trim())) {
        return res.status(400).json({
          error: "Invalid contact phone format",
        });
      }

      // Validate payment terms
      if (typeof paymentTerms !== "string" || paymentTerms.trim() === "") {
        return res.status(400).json({
          error: "Payment terms are required",
        });
      }

      // Validate lead time
      if (
        typeof leadTimeDays !== "number" ||
        !Number.isInteger(leadTimeDays) ||
        leadTimeDays < 0
      ) {
        return res.status(400).json({
          error: "Lead time must be a non-negative integer",
        });
      }

      const newVendor = await this.vendorRepo.create({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        paymentTerms: paymentTerms.trim(),
        leadTimeDays,
      });

      return res.status(201).json(newVendor);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({
          error: "A vendor with this email already exists",
        });
      }

      console.error("Failed to create vendor:", error);

      return res.status(500).json({
        error: "Failed to create vendor",
      });
    }
  };

  //  PATCH /api/vendors/:id

  updateVendor = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({
          error: "Invalid vendor ID format",
        });
      }

      const existing = await this.vendorRepo.findById(id);
      if (!existing) {
        return res.status(404).json({
          error: "Vendor not found",
        });
      }

      const {
        name,
        contactEmail,
        contactPhone,
        paymentTerms,
        leadTimeDays,
        status,
      } = req.body;

      const updates: Partial<{
        name: string;
        contactEmail: string;
        contactPhone: string;
        paymentTerms: string;
        leadTimeDays: number;
        status: VendorStatus;
      }> = {};

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim() === "") {
          return res
            .status(400)
            .json({ error: "Vendor name must be a non-empty string" });
        }
        updates.name = name.trim();
      }

      if (contactEmail !== undefined) {
        if (
          typeof contactEmail !== "string" ||
          !EMAIL_REGEX.test(contactEmail)
        ) {
          return res.status(400).json({ error: "Invalid contact email" });
        }
        updates.contactEmail = contactEmail.trim();
      }

      if (contactPhone !== undefined) {
        if (
          typeof contactPhone !== "string" ||
          !PHONE_REGEX.test(contactPhone.trim())
        ) {
          return res
            .status(400)
            .json({ error: "Invalid contact phone format" });
        }
        updates.contactPhone = contactPhone.trim();
      }

      if (paymentTerms !== undefined) {
        if (typeof paymentTerms !== "string" || paymentTerms.trim() === "") {
          return res
            .status(400)
            .json({ error: "Payment terms must be a non-empty string" });
        }
        updates.paymentTerms = paymentTerms.trim();
      }

      if (leadTimeDays !== undefined) {
        if (
          typeof leadTimeDays !== "number" ||
          !Number.isInteger(leadTimeDays) ||
          leadTimeDays < 0
        ) {
          return res
            .status(400)
            .json({ error: "Lead time must be a non-negative integer" });
        }
        updates.leadTimeDays = leadTimeDays;
      }

      if (status !== undefined) {
        if (
          typeof status !== "string" ||
          !VALID_STATUSES.includes(status as VendorStatus)
        ) {
          return res.status(400).json({
            error: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
          });
        }
        updates.status = status as VendorStatus;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: "At least one field must be provided to update",
        });
      }

      const updated = await this.vendorRepo.update(id, updates);

      return res.status(200).json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({
          error: "A vendor with this email already exists",
        });
      }

      console.error("Failed to update vendor:", error);

      return res.status(500).json({
        error: "Failed to update vendor",
      });
    }
  };
}
