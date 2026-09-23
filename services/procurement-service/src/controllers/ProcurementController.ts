import type { Request, Response, NextFunction } from "express";
import { ProcurementService } from "../services/ProcurementService.js";

export class ProcurementController {
  constructor(
    private procurementService: ProcurementService = new ProcurementService(),
  ) {}

  getPurchaseOrders = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const pos = await this.procurementService.getAllPurchaseOrders();
      return res.status(200).json(pos);
    } catch (error) {
      next(error);
    }
  };

  getPurchaseOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const po = await this.procurementService.getPurchaseOrderById(id);
      return res.status(200).json(po);
    } catch (error) {
      next(error);
    }
  };

  createPurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const newPo = await this.procurementService.createPurchaseOrder(req.body);
      return res.status(201).json(newPo);
    } catch (error) {
      next(error);
    }
  };

  approvePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const { approvedBy } = req.body;
      const approved = await this.procurementService.approvePurchaseOrder(
        id,
        approvedBy,
      );
      return res.status(200).json(approved);
    } catch (error) {
      next(error);
    }
  };

  receivePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const { quantityReceived } = req.body;
      const updated = await this.procurementService.receivePurchaseOrder(
        id,
        quantityReceived,
      );
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };
}
