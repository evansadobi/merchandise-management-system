import type { Request, Response } from "express";
import { ProcurementRepository } from "../repositories/ProcurementRepository.js";

interface VendorSupplierMatch {
  vendorId: string;
  vendorName: string;
  paymentTerms: string;
  leadTimeDays: number;
  unitCost: string;
}

const FETCH_TIMEOUT_MS = 5000;

export class ProcurementController {
  private procurementRepo = new ProcurementRepository();
  private vendorServiceUrl =
    process.env.VENDOR_SERVICE_URL || "http://localhost:3001";

  getPurchaseOrders = async (_req: Request, res: Response) => {
    try {
      const pos = await this.procurementRepo.findAll();
      return res.status(200).json(pos);
    } catch (error) {
      console.error("Failed to fetch purchase orders:", error);
      return res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  };

  getPurchaseOrderById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const po = await this.procurementRepo.findById(id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      return res.status(200).json(po);
    } catch (error) {
      console.error("Failed to fetch purchase order:", error);
      return res.status(500).json({ error: "Failed to fetch purchase order" });
    }
  };

  createPurchaseOrder = async (req: Request, res: Response) => {
    try {
      const { vendorId, sku, quantity } = req.body;

      if (!vendorId || !sku || quantity === undefined) {
        return res
          .status(400)
          .json({ error: "Missing required fields: vendorId, sku, quantity" });
      }

      if (
        typeof quantity !== "number" ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res
          .status(400)
          .json({ error: "Quantity must be a positive integer" });
      }

      let suppliersResponse: globalThis.Response;
      try {
        suppliersResponse = await fetch(
          `${this.vendorServiceUrl}/api/vendors/sku/${encodeURIComponent(sku)}/suppliers`,
          { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
        );
      } catch (fetchError) {
        console.error("Vendor Service unreachable:", fetchError);
        return res.status(502).json({ error: "Vendor Service is unavailable" });
      }

      if (!suppliersResponse.ok) {
        return res
          .status(502)
          .json({ error: "Failed to verify vendor product catalog" });
      }

      const suppliers =
        (await suppliersResponse.json()) as VendorSupplierMatch[];
      const match = suppliers.find((s) => s.vendorId === vendorId);

      if (!match) {
        return res.status(400).json({
          error:
            "Validation failed: this vendor is not an approved supplier for this SKU",
        });
      }

      const newPo = await this.procurementRepo.create({
        vendorId,
        sku,
        quantityOrdered: quantity,
        unitCost: match.unitCost,
        paymentTerms: match.paymentTerms,
      });

      return res.status(201).json(newPo);
    } catch (error) {
      console.error("Failed to create purchase order:", error);
      return res.status(500).json({ error: "Failed to create purchase order" });
    }
  };

  approvePurchaseOrder = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { approvedBy } = req.body;

      if (typeof approvedBy !== "string" || approvedBy.trim() === "") {
        return res.status(400).json({ error: "approvedBy is required" });
      }

      const po = await this.procurementRepo.findById(id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (po.status !== "DRAFT") {
        return res.status(409).json({
          error: `Cannot approve a purchase order in status ${po.status}`,
        });
      }

      const approved = await this.procurementRepo.approve(
        id,
        approvedBy.trim(),
      );

      console.log(
        `[event-stub] PurchaseOrderApproved: PO ${id} approved by ${approvedBy}`,
      );

      return res.status(200).json(approved);
    } catch (error) {
      console.error("Failed to approve purchase order:", error);
      return res
        .status(500)
        .json({ error: "Failed to approve purchase order" });
    }
  };

  receivePurchaseOrder = async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { quantityReceived } = req.body;

      if (
        typeof quantityReceived !== "number" ||
        !Number.isInteger(quantityReceived) ||
        quantityReceived <= 0
      ) {
        return res
          .status(400)
          .json({ error: "quantityReceived must be a positive integer" });
      }

      const po = await this.procurementRepo.findById(id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (po.status !== "APPROVED" && po.status !== "PARTIALLY_RECEIVED") {
        return res.status(409).json({
          error: `Cannot record receipt against a purchase order in status ${po.status}`,
        });
      }

      const remaining = po.quantityOrdered - po.quantityReceived;
      if (quantityReceived > remaining) {
        return res.status(400).json({
          error: `Cannot receive more than the remaining open quantity (${remaining})`,
        });
      }

      const updated = await this.procurementRepo.recordReceipt(
        id,
        quantityReceived,
      );
      return res.status(200).json(updated);
    } catch (error) {
      console.error("Failed to record purchase order receipt:", error);
      return res
        .status(500)
        .json({ error: "Failed to record purchase order receipt" });
    }
  };
}
