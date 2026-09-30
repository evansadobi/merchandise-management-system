import type { Request, Response } from "express";
import { RetailSalesService } from "../services/RetailSalesService.js";

export class RetailSalesController {
  constructor(private readonly retailSalesService: RetailSalesService) {}

  listSales = async (_req: Request, res: Response) => {
    const page = Number(_req.query.page ?? 1);
    const limit = Number(_req.query.limit ?? 20);
    const result = await this.retailSalesService.listSales(page, limit);
    res.status(200).json(result);
  };

  createSale = async (req: Request, res: Response) => {
    const sale = await this.retailSalesService.createSale(req.body);
    res.status(201).json(sale);
  };

  getSaleById = async (req: Request, res: Response) => {
    const saleId = Array.isArray(req.params.saleId)
      ? req.params.saleId[0]
      : req.params.saleId;

    if (!saleId) {
      res.status(400).json({ error: "saleId is required" });
      return;
    }

    const sale = await this.retailSalesService.getSaleById(saleId);
    res.status(200).json(sale);
  };
}
