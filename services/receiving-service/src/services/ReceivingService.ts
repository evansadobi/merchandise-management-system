import { ReceivingRepository } from "../repositories/ReceivingRepository.js";
import { publishGoodsReceived } from "../events/eventPublisher.js";
import {
  NotFoundError,
  ValidationError,
  type CreateGrnDTO,
  type DiscrepancyType,
  type PreparedItem,
} from "../types.js";

export class ReceivingService {
  constructor(
    private receivingRepo: ReceivingRepository = new ReceivingRepository(),
  ) {}

  async createGoodsReceivedNote(dto: CreateGrnDTO) {
    const preparedItems: PreparedItem[] = [];

    for (const item of dto.items) {
      const damagedQuantity = item.damagedQuantity ?? 0;
      const totalArrived = item.receivedQuantity;

      if (damagedQuantity > totalArrived) {
        throw new ValidationError(
          `Damaged quantity (${damagedQuantity}) cannot exceed total received quantity (${totalArrived}) for SKU: ${item.sku}`,
        );
      }

      const expected = await this.receivingRepo.findExpectedDelivery(
        dto.purchaseOrderId,
        item.sku,
      );

      const sellableQuantity = totalArrived - damagedQuantity;
      const orderedQuantity = expected
        ? expected.quantityExpected - expected.quantityReceivedSoFar
        : 0;

      let discrepancyType: DiscrepancyType = "NONE";
      if (totalArrived < orderedQuantity) discrepancyType = "SHORTAGE";
      else if (totalArrived > orderedQuantity) discrepancyType = "OVERAGE";

      preparedItems.push({
        expectedDeliveryId: expected?.id ?? null,
        sku: item.sku,
        orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        damagedQuantity,
        conditionNotes: item.conditionNotes,
        discrepancyType,
        sellableQuantity,
      });
    }

    if (preparedItems.every((i) => i.expectedDeliveryId === null)) {
      throw new NotFoundError(
        `No expected delivery on file for purchase order ${dto.purchaseOrderId}. Has it been approved in Procurement yet?`,
      );
    }

    const hasDiscrepancy = preparedItems.some(
      (i) => i.discrepancyType !== "NONE" || i.damagedQuantity > 0,
    );

    const expectedUpdates = preparedItems
      .filter(
        (i): i is PreparedItem & { expectedDeliveryId: string } =>
          i.expectedDeliveryId !== null,
      )
      .map((i) => ({
        id: i.expectedDeliveryId,
        additionalReceived: i.receivedQuantity,
      }));

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

    for (const item of preparedItems) {
      if (item.sellableQuantity > 0) {
        await publishGoodsReceived({
          grnId: grn.id,
          purchaseOrderId: dto.purchaseOrderId,
          sku: item.sku,
          quantity: item.sellableQuantity,
        });
      }
    }

    return {
      ...grn,
      items: items.map((dbItem, idx) => ({
        ...dbItem,
        discrepancyType: preparedItems[idx].discrepancyType,
        sellableQuantity: preparedItems[idx].sellableQuantity,
      })),
    };
  }

  async getGrnById(id: string) {
    const result = await this.receivingRepo.findGrnById(id);
    if (!result) {
      throw new NotFoundError("Goods Received Note not found");
    }
    return { ...result.grn, items: result.items };
  }

  async listGrns(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.receivingRepo.findAllGrns(page, limit),
      this.receivingRepo.countGrns(),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listExpectedDeliveries() {
    return this.receivingRepo.findAllExpectedDeliveries();
  }
}
