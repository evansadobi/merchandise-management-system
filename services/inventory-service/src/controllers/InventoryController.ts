import type { Request, Response } from "express";
import { InventoryRepository } from "../repositories/InventoryRepository.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALUE_PATTERN = /^\d+(\.\d{1,2})?$/;

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

export class InventoryController {
  private inventoryRepo = new InventoryRepository();

  getItems = async (_req: Request, res: Response) => {
    try {
      const items = await this.inventoryRepo.findAll();
      return res.status(200).json(items);
    } catch (error) {
      console.error("Failed to fetch inventory items:", error);
      return res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  };

  getItemById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return res
          .status(400)
          .json({ error: "Invalid inventory item ID format" });
      }

      const item = await this.inventoryRepo.findById(id);

      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      return res.status(200).json(item);
    } catch (error) {
      console.error("Failed to fetch inventory item:", error);
      return res.status(500).json({ error: "Failed to fetch inventory item" });
    }
  };

  getItemsBySku = async (req: Request, res: Response) => {
    try {
      const { sku } = req.params as { sku: string };

      if (typeof sku !== "string" || sku.trim() === "") {
        return res.status(400).json({ error: "SKU is required" });
      }

      const items = await this.inventoryRepo.findBySku(sku.trim());

      if (items.length === 0) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      return res.status(200).json(items);
    } catch (error) {
      console.error("Failed to fetch inventory items by SKU:", error);
      return res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  };

  getLowStockItems = async (_req: Request, res: Response) => {
    try {
      const items = await this.inventoryRepo.findLowStock();
      return res.status(200).json(items);
    } catch (error) {
      console.error("Failed to fetch low-stock items:", error);
      return res.status(500).json({ error: "Failed to fetch low-stock items" });
    }
  };

  createItem = async (req: Request, res: Response) => {
    try {
      const {
        productName,
        sku,
        locationId,
        quantityOnHand,
        unitValue,
        reorderLevel,
      } = req.body;

      if (typeof productName !== "string" || productName.trim() === "") {
        return res.status(400).json({ error: "productName is required" });
      }

      if (typeof sku !== "string" || sku.trim() === "") {
        return res.status(400).json({ error: "sku is required" });
      }

      if (
        locationId !== undefined &&
        (typeof locationId !== "string" || locationId.trim() === "")
      ) {
        return res
          .status(400)
          .json({ error: "locationId must be a non-empty string if provided" });
      }

      if (
        quantityOnHand !== undefined &&
        (typeof quantityOnHand !== "number" ||
          !Number.isInteger(quantityOnHand) ||
          quantityOnHand < 0)
      ) {
        return res
          .status(400)
          .json({ error: "quantityOnHand must be a non-negative integer" });
      }

      if (
        reorderLevel !== undefined &&
        (typeof reorderLevel !== "number" ||
          !Number.isInteger(reorderLevel) ||
          reorderLevel < 0)
      ) {
        return res
          .status(400)
          .json({ error: "reorderLevel must be a non-negative integer" });
      }

      let trimmedUnitValue: string | undefined;
      if (unitValue !== undefined) {
        trimmedUnitValue =
          typeof unitValue === "string" ? unitValue.trim() : "";
        if (!VALUE_PATTERN.test(trimmedUnitValue)) {
          return res.status(400).json({
            error:
              "unitValue must be a valid amount with up to 2 decimal places",
          });
        }
      }

      const newItem = await this.inventoryRepo.create({
        productName: productName.trim(),
        sku: sku.trim(),
        locationId: locationId ? locationId.trim() : undefined,
        quantityOnHand,
        unitValue: trimmedUnitValue,
        reorderLevel,
      });

      return res.status(201).json(newItem);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({
          error:
            "An inventory item with this SKU already exists at this location",
        });
      }
      console.error("Failed to create inventory item:", error);
      return res.status(500).json({ error: "Failed to create inventory item" });
    }
  };

  adjustStock = async (req: Request, res: Response) => {
    try {
      const { sku } = req.params as { sku: string };
      const { delta, locationId } = req.body;

      if (
        typeof delta !== "number" ||
        !Number.isInteger(delta) ||
        delta === 0
      ) {
        return res
          .status(400)
          .json({ error: "delta must be a non-zero integer" });
      }

      const resolvedLocationId =
        typeof locationId === "string" && locationId.trim() !== ""
          ? locationId.trim()
          : "MAIN_WAREHOUSE";

      const existing = await this.inventoryRepo.findBySkuAndLocation(
        sku,
        resolvedLocationId,
      );
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Inventory item not found at this location" });
      }

      if (delta < 0 && existing.quantityOnHand + delta < 0) {
        return res.status(400).json({
          error: `Cannot reduce On Hand below zero (current: ${existing.quantityOnHand})`,
        });
      }

      const updated = await this.inventoryRepo.adjustOnHand(
        sku,
        resolvedLocationId,
        delta,
      );
      return res.status(200).json(updated);
    } catch (error) {
      console.error("Failed to adjust inventory stock:", error);
      return res
        .status(500)
        .json({ error: "Failed to adjust inventory stock" });
    }
  };
}
