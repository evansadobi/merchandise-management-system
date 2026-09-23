import { ProcurementRepository } from "../repositories/ProcurementRepository.js";
import { VendorServiceClient } from "../clients/VendorServiceClient.js";
import { publishPurchaseOrderApproved } from "../events/eventPublisher.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  type CreatePurchaseOrderDTO,
} from "../types.js";

export class ProcurementService {
  constructor(
    private procurementRepo: ProcurementRepository = new ProcurementRepository(),
    private vendorServiceClient: VendorServiceClient = new VendorServiceClient(),
  ) {}

  async getAllPurchaseOrders() {
    return await this.procurementRepo.findAll();
  }

  async getPurchaseOrderById(id: string) {
    const po = await this.procurementRepo.findById(id);
    if (!po) {
      throw new NotFoundError("Purchase order not found");
    }
    return po;
  }

  async createPurchaseOrder(data: CreatePurchaseOrderDTO) {
    const suppliers = await this.vendorServiceClient.getApprovedSuppliersForSku(
      data.sku,
    );
    const match = suppliers.find((s) => s.vendorId === data.vendorId);

    if (!match) {
      throw new ValidationError(
        "This vendor is not an approved supplier for this SKU",
      );
    }

    // Cost and payment terms are locked in HERE, at creation time, from
    // Vendor Service's authoritative data — never trusted from the client.
    return await this.procurementRepo.create({
      vendorId: data.vendorId,
      sku: data.sku,
      quantityOrdered: data.quantity,
      unitCost: match.unitCost,
      paymentTerms: match.paymentTerms,
    });
  }

  async approvePurchaseOrder(id: string, approvedBy: string) {
    const existing = await this.procurementRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Purchase order not found");
    }
    if (existing.status !== "DRAFT") {
      throw new ConflictError(
        `Cannot approve a purchase order in status ${existing.status}`,
      );
    }

    const approved = await this.procurementRepo.approve(id, approvedBy);
    if (!approved) {
      // Someone else approved it between our check and the write.
      throw new ConflictError(
        "Purchase order was already approved by another request",
      );
    }

    await publishPurchaseOrderApproved({
      id: approved.id,
      sku: approved.sku,
      quantity: approved.quantityOrdered,
    });

    return approved;
  }

  async receivePurchaseOrder(id: string, quantityReceived: number) {
    const existing = await this.procurementRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Purchase order not found");
    }

    if (
      existing.status !== "APPROVED" &&
      existing.status !== "PARTIALLY_RECEIVED"
    ) {
      throw new ConflictError(
        `Cannot record receipt against a purchase order in status ${existing.status}`,
      );
    }

    const remaining = existing.quantityOrdered - existing.quantityReceived;
    if (quantityReceived > remaining) {
      throw new ValidationError(
        `Cannot receive more than the remaining open quantity (${remaining})`,
      );
    }

    const updated = await this.procurementRepo.recordReceipt(
      id,
      quantityReceived,
    );
    if (!updated) {
      // Quantity or status changed concurrently since our check above.
      throw new ConflictError(
        "Purchase order state changed concurrently; please retry",
      );
    }

    return updated;
  }
}
