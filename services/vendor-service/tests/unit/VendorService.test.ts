import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendorService } from "../../src/services/VendorService.js";
import { VendorRepository } from "../../src/repositories/VendorRepository.js";
import { NotFoundError } from "../../src/types.js";

vi.mock("../../src/repositories/VendorRepository.js");

describe("VendorService", () => {
  let vendorService: VendorService;
  let mockVendorRepo: {
    findAll: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorRepo = {
      findAll: vi.fn(),
      count: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    vendorService = new VendorService(
      mockVendorRepo as unknown as VendorRepository,
    );
  });

  describe("getAllVendors", () => {
    it("should return a paginated list of vendors with default page/limit", async () => {
      const mockVendors = [
        { id: "123e4567-e89b-12d3-a456-426614174000", name: "Acme Corp" },
        { id: "123e4567-e89b-12d3-a456-426614174001", name: "Global Supply" },
      ];

      mockVendorRepo.findAll.mockResolvedValue(mockVendors);
      mockVendorRepo.count.mockResolvedValue(2);

      const result = await vendorService.getAllVendors();

      expect(result).toEqual({
        data: mockVendors,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
      expect(mockVendorRepo.findAll).toHaveBeenCalledWith(1, 20);
      expect(mockVendorRepo.count).toHaveBeenCalledTimes(1);
    });

    it("should forward custom page and limit to the repository", async () => {
      mockVendorRepo.findAll.mockResolvedValue([]);
      mockVendorRepo.count.mockResolvedValue(0);

      const result = await vendorService.getAllVendors(2, 10);

      expect(mockVendorRepo.findAll).toHaveBeenCalledWith(2, 10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe("getVendorById", () => {
    it("should return a vendor when a valid ID exists", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174000";
      const mockVendor = {
        id: vendorId,
        name: "Acme Corp",
        contactEmail: "test@acme.com",
        contactPhone: "+1234567890",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
        status: "APPROVED",
      };

      mockVendorRepo.findById.mockResolvedValue(mockVendor);

      const result = await vendorService.getVendorById(vendorId);

      expect(result).toEqual(mockVendor);
      expect(mockVendorRepo.findById).toHaveBeenCalledWith(vendorId);
    });

    it("should throw NotFoundError if vendor does not exist", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174999";
      mockVendorRepo.findById.mockResolvedValue(null);

      await expect(vendorService.getVendorById(vendorId)).rejects.toThrow(
        NotFoundError,
      );
      await expect(vendorService.getVendorById(vendorId)).rejects.toThrow(
        "Vendor not found",
      );
    });
  });

  describe("createVendor", () => {
    it("should successfully create a new vendor", async () => {
      const newVendorData = {
        name: "Global Supplies",
        contactEmail: "info@globalsupplies.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 15",
        leadTimeDays: 3,
      };

      const createdVendor = {
        id: "uuid-123",
        ...newVendorData,
        status: "PENDING",
      };
      mockVendorRepo.create.mockResolvedValue(createdVendor);

      const result = await vendorService.createVendor(newVendorData);

      expect(result).toEqual(createdVendor);
      expect(mockVendorRepo.create).toHaveBeenCalledWith(newVendorData);
    });
  });

  describe("updateVendor", () => {
    it("should update an existing vendor successfully", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174000";
      const existingVendor = { id: vendorId, name: "Old Name" };
      const updatePayload = { name: "New Name" };
      const updatedVendor = { ...existingVendor, ...updatePayload };

      mockVendorRepo.findById.mockResolvedValue(existingVendor);
      mockVendorRepo.update.mockResolvedValue(updatedVendor);

      const result = await vendorService.updateVendor(vendorId, updatePayload);

      expect(result).toEqual(updatedVendor);
      expect(mockVendorRepo.findById).toHaveBeenCalledWith(vendorId);
      expect(mockVendorRepo.update).toHaveBeenCalledWith(
        vendorId,
        updatePayload,
      );
    });

    it("should throw NotFoundError when attempting to update a non-existent vendor", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174000";
      mockVendorRepo.findById.mockResolvedValue(null);

      await expect(
        vendorService.updateVendor(vendorId, { name: "Test" }),
      ).rejects.toThrow(NotFoundError);
      expect(mockVendorRepo.update).not.toHaveBeenCalled();
    });
  });
});
