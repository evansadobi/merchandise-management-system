import { ReceivingRepository } from "../repositories/ReceivingRepository.js";
import { ProcurementServiceClient } from "../clients/ProcurementServiceClient.js";
import { publishGoodsReceived } from "../events/eventPublisher.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  type CreateGrnDTO,
  type DiscrepancyType,
  type PreparedItem,
} from "../types.js";

export class ReceivingService {
  constructor(
    private receivingRepo: ReceivingRepository = new ReceivingRepository(),
    private procurementClient: ProcurementServiceClient = new ProcurementServiceClient(),
  ) {}

  async createGoodsReceivedNote(dto: CreateGrnDTO) {
    const po = await this.procurementClient.getPurchaseOrder(
      dto.purchaseOrderId,
    );

    if (!po) {
      throw new NotFoundError(
        `Procurement has no record of purchase order ${dto.purchaseOrderId}.`,
      );
    }

    if (po.status === "DRAFT") {
      throw new ConflictError(
        `Purchase order ${dto.purchaseOrderId} has not been approved yet — nothing should be arriving for it.`,
      );
    }

    if (po.status === "RECEIVED") {
      throw new ConflictError(
        `Purchase order ${dto.purchaseOrderId} is already fully received — no further deliveries expected.`,
      );
    }

    const preparedItems: PreparedItem[] = [];

    for (const item of dto.items) {
      if (item.sku !== po.sku) {
        throw new ValidationError(
          `SKU mismatch: PO ${dto.purchaseOrderId} is for SKU ${po.sku}, but received SKU was ${item.sku}`,
        );
      }

      const damagedQuantity = item.damagedQuantity ?? 0;
      const totalArrived = item.receivedQuantity;

      if (damagedQuantity > totalArrived) {
        throw new ValidationError(
          `Damaged quantity (${damagedQuantity}) cannot exceed total received quantity (${totalArrived}) for SKU: ${item.sku}`,
        );
      }

      const orderedQuantity = Math.max(
        0,
        po.quantityOrdered - po.quantityReceived,
      );
      const sellableQuantity = totalArrived - damagedQuantity;

      let discrepancyType: DiscrepancyType = "NONE";
      if (totalArrived < orderedQuantity) discrepancyType = "SHORTAGE";
      else if (totalArrived > orderedQuantity) discrepancyType = "OVERAGE";

      preparedItems.push({
        expectedDeliveryId: null,
        sku: item.sku,
        orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        damagedQuantity,
        conditionNotes: item.conditionNotes,
        discrepancyType,
        sellableQuantity,
      });
    }

    const hasDiscrepancy = preparedItems.some(
      (i) => i.discrepancyType !== "NONE" || i.damagedQuantity > 0,
    );

    const expectedUpdates: { id: string; additionalReceived: number }[] = [];

    const { grn, items } = await this.receivingRepo.createGrnWithItems(
      {
        purchaseOrderId: dto.purchaseOrderId,
        supplierId: dto.supplierId,
        receivedBy: dto.receivedBy,
        status: hasDiscrepancy ? "DISCREPANCY" : "COMPLETE",
      },
      preparedItems.map(
        ({ discrepancyType, sellableQuantity, ...dbColumns }) => dbColumns,
      ),
      expectedUpdates,
    );

    if (!grn) {
      throw new Error("Failed to record Goods Received Note header");
    }

    for (const item of preparedItems) {
      if (item.sellableQuantity > 0) {
        await publishGoodsReceived({
          grnId: grn.id,
          purchaseOrderId: dto.purchaseOrderId,
          sku: item.sku,
          quantity: item.sellableQuantity,
        });

        await this.procurementClient.recordReceipt(
          dto.purchaseOrderId,
          item.sellableQuantity,
        );
      }
    }

    return {
      ...grn,
      items: items.map((dbItem, idx) => {
        const prepared = preparedItems[idx];
        return {
          ...dbItem,
          discrepancyType: prepared?.discrepancyType ?? "NONE",
          sellableQuantity:
            prepared?.sellableQuantity ?? dbItem.receivedQuantity,
        };
      }),
    };
  }

  async getGrnById(id: string) {
    const result = await this.receivingRepo.findGrnById(id);
    if (!result) {
      throw new NotFoundError("Goods Received Note not found");
    }

    // Derive computed fields on read — discrepancyType and
    // sellableQuantity are not stored in the DB, only computed.
    return {
      ...result.grn,
      items: result.items.map((item) => ({
        ...item,
        sellableQuantity: item.receivedQuantity - item.damagedQuantity,
        discrepancyType:
          item.receivedQuantity < item.orderedQuantity
            ? "SHORTAGE"
            : item.receivedQuantity > item.orderedQuantity
              ? "OVERAGE"
              : "NONE",
      })),
    };
  }

  async listGrns(page = 1, limit = 20) {
    const [grns, total] = await Promise.all([
      this.receivingRepo.findGrnsWithItems(page, limit),
      this.receivingRepo.countGrns(),
    ]);

    // Hydrate the computed fields per line item — they are derived,
    // not persisted, so we recompute them here from the stored columns.
    const data = grns.map((grn) => ({
      ...grn,
      items: grn.items.map((item) => ({
        ...item,
        sellableQuantity: item.receivedQuantity - item.damagedQuantity,
        discrepancyType:
          item.receivedQuantity < item.orderedQuantity
            ? "SHORTAGE"
            : item.receivedQuantity > item.orderedQuantity
              ? "OVERAGE"
              : "NONE",
      })),
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listExpectedDeliveries() {
    return this.receivingRepo.findAllExpectedDeliveries();
  }
}
