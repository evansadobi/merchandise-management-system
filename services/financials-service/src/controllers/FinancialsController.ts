import type { Request, Response } from "express";
import { FinancialsService } from "../services/FinancialsService.js";

export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  listLedgers = async (_req: Request, res: Response) => {
    const result = await this.financialsService.listLedgers();
    res.status(200).json(result);
  };

  getLedgerById = async (req: Request, res: Response) => {
    const ledgerId = Array.isArray(req.params.ledgerId)
      ? req.params.ledgerId[0]
      : req.params.ledgerId;

    if (!ledgerId) {
      res.status(400).json({ error: "ledgerId is required" });
      return;
    }

    const result = await this.financialsService.getLedgerById(ledgerId);
    res.status(200).json(result);
  };

  createLedgerEntry = async (req: Request, res: Response) => {
    const result = await this.financialsService.createLedgerEntry(req.body);
    res.status(201).json(result);
  };
}
