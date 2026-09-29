import type { Request, Response, NextFunction } from "express";
import { ReceivingService } from "../services/ReceivingService.js";

export class ReceivingController {
  constructor(
    private receivingService: ReceivingService = new ReceivingService(),
  ) {}

  createGrn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const grn = await this.receivingService.createGoodsReceivedNote(req.body);
      return res.status(201).json(grn);
    } catch (error) {
      next(error);
    }
  };

  getGrnById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const grn = await this.receivingService.getGrnById(id);
      return res.status(200).json(grn);
    } catch (error) {
      next(error);
    }
  };

  listGrns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.max(
        1,
        Math.min(100, parseInt(req.query.limit as string, 10) || 20),
      );

      const result = await this.receivingService.listGrns(page, limit);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listExpectedDeliveries = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const items = await this.receivingService.listExpectedDeliveries();
      return res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  };
}
