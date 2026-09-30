import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReceivingService } from "../../src/services/ReceivingService.js";
import { ReceivingRepository } from "../../src/repositories/ReceivingRepository.js";
import { ProcurementServiceClient } from "../../src/clients/ProcurementServiceClient.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../src/types.js";

vi.mock("../../src/repositories/ReceivingRepository.js");
vi.mock("../../src/clients/ProcurementServiceClient.js");
vi.mock("../../src/events/eventPublisher.js", () => ({
  publishGoodsReceived: vi.fn().mockResolvedValue(undefined),
}));

import { publishGoodsReceived } from "../../src/events/eventPublisher.js";

describe("ReceivingService", () => {
  let service: ReceivingService;
  let mockReceivingRepo: any;
  let mockProcurementClient: any;

  const poId = "3596af77-0ceb-40a7-859c-f373cc6325b5";
  const supplierId = "4eb2b9f7-c20b-4238-a985-0d277130288b";

  beforeEach(() => {
    vi.clearAllMocks();
    mockReceivingRepo = {
      createGrnWithItems: vi.fn(),
      findGrnById: vi.fn(),
      findAllGrns: vi.fn(),
      countGrns: vi.fn(),
      findAllExpectedDeliveries: vi.fn(),
    };
    mockProcurementClient = {
      getPurchaseOrder: vi.fn(),
      recordReceipt: vi.fn(),
    };

    service = new ReceivingService(
      mockReceivingRepo as unknown as ReceivingRepository,
      mockProcurementClient as unknown as ProcurementServiceClient,
    );
  });

  describe("createGoodsReceivedNote", () => {
    const dto = {
      purchaseOrderId: poId,
      supplierId,
      receivedBy: "Dock Clerk",
      items: [
        {
          sku: "BOLT-STEEL-M8",
          receivedQuantity: 20,
          damagedQuantity: 2,
          conditionNotes: "2 units damaged",
        },
      ],
    };

    it("successfully calculates live ordered quantity, sets expectedDeliveryId to null, and syncs sellable quantity", async () => {
      mockProcurementClient.getPurchaseOrder.mockResolvedValue({
        id: poId,
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
        quantityReceived: 0,
        status: "APPROVED",
      });

      const mockGrn = {
        id: "grn-1",
        purchaseOrderId: poId,
        supplierId,
        receivedBy: "Dock Clerk",
        status: "DISCREPANCY",
      };
      const mockItems = [
        {
          id: "item-1",
          grnId: "grn-1",
          expectedDeliveryId: null,
          sku: "BOLT-STEEL-M8",
          orderedQuantity: 50,
          receivedQuantity: 20,
          damagedQuantity: 2,
          conditionNotes: "2 units damaged",
        },
      ];

      mockReceivingRepo.createGrnWithItems.mockResolvedValue({
        grn: mockGrn,
        items: mockItems,
      });

      const result = await service.createGoodsReceivedNote(dto);

      expect(mockProcurementClient.getPurchaseOrder).toHaveBeenCalledWith(poId);
      expect(mockReceivingRepo.createGrnWithItems).toHaveBeenCalled();
      expect(mockProcurementClient.recordReceipt).toHaveBeenCalledWith(
        poId,
        18,
      );
      expect(publishGoodsReceived).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 18 }),
      );
      expect(result.items?.[0]?.expectedDeliveryId).toBeNull();
      expect(result.items?.[0]?.sellableQuantity).toBe(18);
      expect(result.items?.[0]?.discrepancyType).toBe("SHORTAGE");
    });

    it("throws ConflictError when PO is still in DRAFT status", async () => {
      mockProcurementClient.getPurchaseOrder.mockResolvedValue({
        id: poId,
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
        quantityReceived: 0,
        status: "DRAFT",
      });

      await expect(service.createGoodsReceivedNote(dto)).rejects.toThrow(
        ConflictError,
      );
      expect(mockReceivingRepo.createGrnWithItems).not.toHaveBeenCalled();
    });

    it("throws ValidationError when damagedQuantity exceeds receivedQuantity", async () => {
      mockProcurementClient.getPurchaseOrder.mockResolvedValue({
        id: poId,
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
        quantityReceived: 0,
        status: "APPROVED",
      });

      const invalidDto = {
        ...dto,
        items: [
          { sku: "BOLT-STEEL-M8", receivedQuantity: 10, damagedQuantity: 15 },
        ],
      };

      await expect(service.createGoodsReceivedNote(invalidDto)).rejects.toThrow(
        ValidationError,
      );
    });

    it("keeps the GRN record even when procurement receipt sync fails", async () => {
      mockProcurementClient.getPurchaseOrder.mockResolvedValue({
        id: poId,
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
        quantityReceived: 0,
        status: "APPROVED",
      });
      mockProcurementClient.recordReceipt.mockRejectedValue(
        new Error("Procurement sync failed"),
      );

      const mockGrn = {
        id: "grn-1",
        purchaseOrderId: poId,
        supplierId,
        receivedBy: "Dock Clerk",
        status: "COMPLETE",
      };
      const mockItems = [
        {
          id: "item-1",
          grnId: "grn-1",
          expectedDeliveryId: null,
          sku: "BOLT-STEEL-M8",
          orderedQuantity: 50,
          receivedQuantity: 20,
          damagedQuantity: 2,
          conditionNotes: "2 units damaged",
        },
      ];
      mockReceivingRepo.createGrnWithItems.mockResolvedValue({
        grn: mockGrn,
        items: mockItems,
      });

      await expect(service.createGoodsReceivedNote(dto)).resolves.toMatchObject(
        {
          id: "grn-1",
          status: "COMPLETE",
        },
      );
      expect(mockReceivingRepo.createGrnWithItems).toHaveBeenCalled();
      expect(publishGoodsReceived).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 18 }),
      );
    });

    it("throws NotFoundError when PO does not exist in Procurement", async () => {
      mockProcurementClient.getPurchaseOrder.mockResolvedValue(null);

      await expect(service.createGoodsReceivedNote(dto)).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
