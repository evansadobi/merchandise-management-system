import type { Request, Response, NextFunction } from "express";
import { VendorService } from "../services/VendorService.js";

export class VendorController {
  constructor(private vendorService: VendorService = new VendorService()) {}

  getVendors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;

      const result = await this.vendorService.getAllVendors(page, limit);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getVendorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const vendor = await this.vendorService.getVendorById(id);
      return res.status(200).json(vendor);
    } catch (error) {
      next(error);
    }
  };

  createVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newVendor = await this.vendorService.createVendor(req.body);
      return res.status(201).json(newVendor);
    } catch (error) {
      next(error);
    }
  };

  updateVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const updated = await this.vendorService.updateVendor(id, req.body);
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  deleteVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const deleted = await this.vendorService.deleteVendor(id);
      return res.status(200).json(deleted);
    } catch (error) {
      next(error);
    }
  };
}
