import type { Request, Response } from "express";
import { SalesAuditService } from "../services/SalesAuditService.js";

export class SalesAuditController {
  constructor(private readonly salesAuditService: SalesAuditService) {}

  getReconciliation = async (req: Request, res: Response) => {
    const registerId = Array.isArray(req.params.registerId)
      ? req.params.registerId[0]
      : req.params.registerId;

    if (!registerId) {
      res.status(400).json({ error: "registerId is required" });
      return;
    }

    const result = await this.salesAuditService.getReconciliation(registerId);
    res.status(200).json(result);
  };

  createReconciliation = async (req: Request, res: Response) => {
    const result = await this.salesAuditService.createReconciliation(req.body);
    res.status(200).json(result);
  };

  listReconciliations = async (_req: Request, res: Response) => {
    const result = await this.salesAuditService.listReconciliations();
    res.status(200).json(result);
  };
}
