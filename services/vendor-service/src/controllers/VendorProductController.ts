import type { Request, Response } from "express";
import { VendorProductRepository } from "../repositories/VendorProductRepository.js";
import { VendorRepository } from "../repositories/VendorRepository.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COST_PATTERN = /^\d+(\.\d{1,2})?$/;

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

export class VendorProductController {
  private productRepo = new VendorProductRepository();
  private vendorRepo = new VendorRepository();

  getByVendorId = async (req: Request, res: Response) => {
    try {
      const { vendorId } = req.params as { vendorId: string };

      if (!UUID_REGEX.test(vendorId)) {
        return res.status(400).json({ error: "Invalid vendor ID format" });
      }

      const vendor = await this.vendorRepo.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      const products = await this.productRepo.findByVendorId(vendorId);
      return res.status(200).json(products);
    } catch (error) {
      console.error("Failed to fetch vendor products:", error);
      return res.status(500).json({ error: "Failed to fetch vendor products" });
    }
  };

  getSuppliersForSku = async (req: Request, res: Response) => {
    try {
      const { sku } = req.params as { sku: string };

      if (typeof sku !== "string" || sku.trim() === "") {
        return res.status(400).json({ error: "SKU is required" });
      }

      const suppliers = await this.productRepo.findSuppliersBySku(sku.trim());
      return res.status(200).json(suppliers);
    } catch (error) {
      console.error("Failed to fetch suppliers for SKU:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch suppliers for SKU" });
    }
  };

  createProduct = async (req: Request, res: Response) => {
    try {
      const { vendorId } = req.params as { vendorId: string };
      const { sku, unitCost } = req.body;

      if (!UUID_REGEX.test(vendorId)) {
        return res.status(400).json({ error: "Invalid vendor ID format" });
      }

      const vendor = await this.vendorRepo.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      if (typeof sku !== "string" || sku.trim() === "") {
        return res.status(400).json({ error: "SKU is required" });
      }

      const trimmedCost = typeof unitCost === "string" ? unitCost.trim() : "";

      if (trimmedCost === "" || !COST_PATTERN.test(trimmedCost)) {
        return res.status(400).json({
          error: "Unit cost must be a valid amount with up to 2 decimal places",
        });
      }

      const newProduct = await this.productRepo.create({
        vendorId,
        sku: sku.trim(),
        unitCost: trimmedCost,
      });

      return res.status(201).json(newProduct);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({
          error: "This vendor already has a cost entry for this SKU",
        });
      }
      console.error("Failed to create vendor product:", error);
      return res.status(500).json({ error: "Failed to create vendor product" });
    }
  };

  deleteProduct = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: "Invalid product ID format" });
      }

      const deleted = await this.productRepo.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor product not found" });
      }

      return res
        .status(200)
        .json({ message: "Vendor product deleted successfully" });
    } catch (error) {
      console.error("Failed to delete vendor product:", error);
      return res.status(500).json({ error: "Failed to delete vendor product" });
    }
  };
}
