import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcurementService } from "../../src/services/ProcurementService.js";
import { ProcurementRepository } from "../../src/repositories/ProcurementRepository.js";
import { VendorServiceClient } from "../../src/clients/VendorServiceClient.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../src/types.js";

vi.mock("../../src/repositories/ProcurementRepository.js");
vi.mock("../../src/clients/VendorServiceClient.js");
vi.mock("../../src/events/eventPublisher.js", () => ({
  publishPurchaseOrderApproved: vi.fn().mockResolvedValue(undefined),
}));

import { publishPurchaseOrderApproved } from "../../src/events/eventPublisher.js";

describe("ProcurementService", () => {
  let service: ProcurementService;
  let mockRepo: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    recordReceipt: ReturnType<typeof vi.fn>;
  };
  let mockVendorClient: {
    getApprovedSuppliersForSku: ReturnType<typeof vi.fn>;
  };

  const vendorId = "4eb2b9f7-c20b-4238-a985-0d277130288b";
  const poId = "63d99c09-daeb-4683-a832-ffdcd2f60459";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      approve: vi.fn(),
      recordReceipt: vi.fn(),
    };
    mockVendorClient = {
      getApprovedSuppliersForSku: vi.fn(),
    };

    service = new ProcurementService(
      mockRepo as unknown as ProcurementRepository,
      mockVendorClient as unknown as VendorServiceClient,
    );
  });

  describe("getAllPurchaseOrders", () => {
    it("returns all purchase orders", async () => {
      const pos = [{ id: poId, sku: "BOLT-STEEL-M8" }];
      mockRepo.findAll.mockResolvedValue(pos);

      const result = await service.getAllPurchaseOrders();

      expect(result).toEqual(pos);
    });
  });

  describe("getPurchaseOrderById", () => {
    it("returns the PO when it exists", async () => {
      const po = { id: poId, sku: "BOLT-STEEL-M8" };
      mockRepo.findById.mockResolvedValue(po);

      const result = await service.getPurchaseOrderById(poId);

      expect(result).toEqual(po);
    });

    it("throws NotFoundError when the PO does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getPurchaseOrderById(poId)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("createPurchaseOrder", () => {
    const dto = { vendorId, sku: "BOLT-STEEL-M8", quantity: 50 };

    it("locks in unitCost and paymentTerms from Vendor Service, never from the client", async () => {
      mockVendorClient.getApprovedSuppliersForSku.mockResolvedValue([
        {
          vendorId,
          vendorName: "Acme Supplies Ltd",
          paymentTerms: "Net 30",
          leadTimeDays: 5,
          unitCost: "12.50",
        },
      ]);

      const created = {
        id: poId,
        ...dto,
        unitCost: "12.50",
        paymentTerms: "Net 30",
      };
      mockRepo.create.mockResolvedValue(created);

      const result = await service.createPurchaseOrder(dto);

      expect(mockVendorClient.getApprovedSuppliersForSku).toHaveBeenCalledWith(
        "BOLT-STEEL-M8",
      );
      expect(mockRepo.create).toHaveBeenCalledWith({
        vendorId,
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
        unitCost: "12.50",
        paymentTerms: "Net 30",
      });
      expect(result).toEqual(created);
    });

    it("throws ValidationError when the vendor is not an approved supplier for the SKU", async () => {
      mockVendorClient.getApprovedSuppliersForSku.mockResolvedValue([
        {
          vendorId: "some-other-vendor-id",
          vendorName: "A Different Vendor",
          paymentTerms: "Net 15",
          leadTimeDays: 3,
          unitCost: "10.00",
        },
      ]);

      await expect(service.createPurchaseOrder(dto)).rejects.toThrow(
        ValidationError,
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("propagates UpstreamServiceError when Vendor Service is unreachable", async () => {
      mockVendorClient.getApprovedSuppliersForSku.mockRejectedValue(
        new Error("network error"),
      );

      await expect(service.createPurchaseOrder(dto)).rejects.toThrow();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("approvePurchaseOrder", () => {
    it("approves a DRAFT PO and publishes the event", async () => {
      const draftPo = {
        id: poId,
        status: "DRAFT",
        sku: "BOLT-STEEL-M8",
        quantityOrdered: 50,
      };
      const approvedPo = {
        ...draftPo,
        status: "APPROVED",
        approvedBy: "Test User",
      };

      mockRepo.findById.mockResolvedValue(draftPo);
      mockRepo.approve.mockResolvedValue(approvedPo);

      const result = await service.approvePurchaseOrder(poId, "Test User");

      expect(mockRepo.approve).toHaveBeenCalledWith(poId, "Test User");
      expect(publishPurchaseOrderApproved).toHaveBeenCalledWith({
        id: poId,
        sku: "BOLT-STEEL-M8",
        quantity: 50,
      });
      expect(result).toEqual(approvedPo);
    });

    it("throws NotFoundError when the PO does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.approvePurchaseOrder(poId, "Test User"),
      ).rejects.toThrow(NotFoundError);
      expect(mockRepo.approve).not.toHaveBeenCalled();
    });

    it("throws ConflictError when the PO is not in DRAFT status", async () => {
      mockRepo.findById.mockResolvedValue({ id: poId, status: "APPROVED" });

      await expect(
        service.approvePurchaseOrder(poId, "Test User"),
      ).rejects.toThrow(ConflictError);
      expect(mockRepo.approve).not.toHaveBeenCalled();
    });

    it("throws ConflictError when a concurrent request already approved it (repo returns null)", async () => {
      mockRepo.findById.mockResolvedValue({ id: poId, status: "DRAFT" });
      mockRepo.approve.mockResolvedValue(null);

      await expect(
        service.approvePurchaseOrder(poId, "Test User"),
      ).rejects.toThrow(ConflictError);
      expect(publishPurchaseOrderApproved).not.toHaveBeenCalled();
    });
  });

  describe("receivePurchaseOrder", () => {
    it("records a partial receipt within the remaining quantity", async () => {
      const approvedPo = {
        id: poId,
        status: "APPROVED",
        quantityOrdered: 50,
        quantityReceived: 0,
      };
      const updated = {
        ...approvedPo,
        quantityReceived: 30,
        status: "PARTIALLY_RECEIVED",
      };

      mockRepo.findById.mockResolvedValue(approvedPo);
      mockRepo.recordReceipt.mockResolvedValue(updated);

      const result = await service.receivePurchaseOrder(poId, 30);

      expect(mockRepo.recordReceipt).toHaveBeenCalledWith(poId, 30);
      expect(result).toEqual(updated);
    });

    it("throws NotFoundError when the PO does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.receivePurchaseOrder(poId, 10)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws ConflictError when the PO is still DRAFT (not yet approved)", async () => {
      mockRepo.findById.mockResolvedValue({ id: poId, status: "DRAFT" });

      await expect(service.receivePurchaseOrder(poId, 10)).rejects.toThrow(
        ConflictError,
      );
      expect(mockRepo.recordReceipt).not.toHaveBeenCalled();
    });

    it("throws ValidationError when receiving more than the remaining open quantity", async () => {
      mockRepo.findById.mockResolvedValue({
        id: poId,
        status: "PARTIALLY_RECEIVED",
        quantityOrdered: 50,
        quantityReceived: 30,
      });

      await expect(service.receivePurchaseOrder(poId, 30)).rejects.toThrow(
        ValidationError,
      );
      expect(mockRepo.recordReceipt).not.toHaveBeenCalled();
    });

    it("throws ConflictError when the repository blocks the update due to a concurrent change", async () => {
      mockRepo.findById.mockResolvedValue({
        id: poId,
        status: "APPROVED",
        quantityOrdered: 50,
        quantityReceived: 0,
      });
      mockRepo.recordReceipt.mockResolvedValue(null);

      await expect(service.receivePurchaseOrder(poId, 30)).rejects.toThrow(
        ConflictError,
      );
    });
  });
});
