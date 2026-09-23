import type { Request, Response, NextFunction } from "express";
import { VendorProductService } from "../services/VendorProductService.js";
import type { VendorStatus } from "../types.js";

export class VendorProductController {
  constructor(
    private productService: VendorProductService = new VendorProductService(),
  ) {}

  getByVendorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = req.params.vendorId as string;
      const products =
        await this.productService.getProductsByVendorId(vendorId);
      return res.status(200).json(products);
    } catch (error) {
      next(error);
    }
  };

  getSuppliersForSku = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const sku = req.params.sku as string;
      const status = req.query.status as VendorStatus | undefined;
      const suppliers = await this.productService.getSuppliersForSku(
        sku.trim(),
        status,
      );
      return res.status(200).json(suppliers);
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = req.params.vendorId as string;
      const newProduct = await this.productService.createProduct(
        vendorId,
        req.body,
      );
      return res.status(201).json(newProduct);
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const updated = await this.productService.updateProduct(id, req.body);
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      await this.productService.deleteProduct(id);
      return res
        .status(200)
        .json({ message: "Vendor product deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
