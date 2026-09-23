import type { Request, Response, NextFunction } from "express";
import { InventoryService } from "../services/InventoryService.js";

export class InventoryController {
  constructor(
    private inventoryService: InventoryService = new InventoryService(),
  ) {}

  listItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const result = await this.inventoryService.listItems(page, limit);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getItemById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const item = await this.inventoryService.getItemById(id);
      return res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  };

  getItemsBySku = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku } = req.params as { sku: string };
      const items = await this.inventoryService.getItemsBySku(sku);
      return res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  };

  getLowStockItems = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const items = await this.inventoryService.getLowStockItems();
      return res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  };

  createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.inventoryService.createItem(req.body);
      return res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku } = req.params as { sku: string };
      const { delta, locationId } = req.body;
      const updated = await this.inventoryService.adjustStock(
        sku,
        delta,
        locationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  reserveStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku } = req.params as { sku: string };
      const { quantity, locationId } = req.body;
      const updated = await this.inventoryService.reserveStock(
        sku,
        quantity,
        locationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  releaseReservation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { sku } = req.params as { sku: string };
      const { quantity, locationId } = req.body;
      const updated = await this.inventoryService.releaseReservation(
        sku,
        quantity,
        locationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  commitSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku } = req.params as { sku: string };
      const { quantity, locationId } = req.body;
      const updated = await this.inventoryService.commitSale(
        sku,
        quantity,
        locationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  deleteItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const deleted = await this.inventoryService.deleteItem(id);
      return res.status(200).json(deleted);
    } catch (error) {
      next(error);
    }
  };
}
