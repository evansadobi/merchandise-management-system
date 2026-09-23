import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendorProductService } from "../../src/services/VendorProductService.js";
import { VendorProductRepository } from "../../src/repositories/VendorProductRepository.js";
import { VendorRepository } from "../../src/repositories/VendorRepository.js";
import { NotFoundError } from "../../src/types.js";

vi.mock("../../src/repositories/VendorProductRepository.js");
vi.mock("../../src/repositories/VendorRepository.js");

describe("VendorProductService", () => {
  let vendorProductService: VendorProductService;
  let mockProductRepo: {
    findByVendorId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findSuppliersBySkuAndStatus: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockVendorRepo: {
    findById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo = {
      findByVendorId: vi.fn(),
      findById: vi.fn(),
      findSuppliersBySkuAndStatus: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockVendorRepo = {
      findById: vi.fn(),
    };

    vendorProductService = new VendorProductService(
      mockProductRepo as unknown as VendorProductRepository,
      mockVendorRepo as unknown as VendorRepository,
    );
  });

  describe("getProductsByVendorId", () => {
    it("should return products when vendor exists", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174000";
      const mockVendor = { id: vendorId, name: "Acme Corp" };
      const mockProducts = [
        { id: "prod-1", sku: "SKU-001", unitCost: "10.00", vendorId },
      ];

      mockVendorRepo.findById.mockResolvedValue(mockVendor);
      mockProductRepo.findByVendorId.mockResolvedValue(mockProducts);

      const result = await vendorProductService.getProductsByVendorId(vendorId);

      expect(result).toEqual(mockProducts);
      expect(mockVendorRepo.findById).toHaveBeenCalledWith(vendorId);
      expect(mockProductRepo.findByVendorId).toHaveBeenCalledWith(vendorId);
    });

    it("should throw NotFoundError if the parent vendor does not exist", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174999";
      mockVendorRepo.findById.mockResolvedValue(null);

      await expect(
        vendorProductService.getProductsByVendorId(vendorId),
      ).rejects.toThrow(NotFoundError);
      await expect(
        vendorProductService.getProductsByVendorId(vendorId),
      ).rejects.toThrow("Vendor not found");
      expect(mockProductRepo.findByVendorId).not.toHaveBeenCalled();
    });
  });

  describe("createProduct", () => {
    it("should successfully create a product when vendor exists", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174000";
      const mockVendor = { id: vendorId, name: "Acme Corp" };
      const productData = { sku: "SKU-XYZ", unitCost: "25.50" };
      const createdProduct = { id: "prod-new", vendorId, ...productData };

      mockVendorRepo.findById.mockResolvedValue(mockVendor);
      mockProductRepo.create.mockResolvedValue(createdProduct);

      const result = await vendorProductService.createProduct(
        vendorId,
        productData,
      );

      expect(result).toEqual(createdProduct);
      expect(mockProductRepo.create).toHaveBeenCalledWith({
        vendorId,
        ...productData,
      });
    });

    it("should throw NotFoundError if parent vendor does not exist during creation", async () => {
      const vendorId = "123e4567-e89b-12d3-a456-426614174999";
      mockVendorRepo.findById.mockResolvedValue(null);

      await expect(
        vendorProductService.createProduct(vendorId, {
          sku: "SKU-XYZ",
          unitCost: "10.00",
        }),
      ).rejects.toThrow(NotFoundError);
      expect(mockProductRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("updateProduct", () => {
    it("should update an existing product", async () => {
      const productId = "prod-123";
      const existingProduct = {
        id: productId,
        sku: "SKU-OLD",
        unitCost: "10.00",
      };
      const updates = { unitCost: "15.00" };
      const updatedProduct = { ...existingProduct, ...updates };

      mockProductRepo.findById.mockResolvedValue(existingProduct);
      mockProductRepo.update.mockResolvedValue(updatedProduct);

      const result = await vendorProductService.updateProduct(
        productId,
        updates,
      );

      expect(result).toEqual(updatedProduct);
      expect(mockProductRepo.update).toHaveBeenCalledWith(productId, updates);
    });

    it("should throw NotFoundError when updating a non-existent product", async () => {
      const productId = "prod-999";
      mockProductRepo.findById.mockResolvedValue(null);

      await expect(
        vendorProductService.updateProduct(productId, { unitCost: "5.00" }),
      ).rejects.toThrow(NotFoundError);
      expect(mockProductRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteProduct", () => {
    it("should delete an existing product successfully", async () => {
      const productId = "prod-123";
      const existingProduct = { id: productId, sku: "SKU-123" };

      mockProductRepo.delete.mockResolvedValue(existingProduct);

      const result = await vendorProductService.deleteProduct(productId);

      expect(result).toEqual(existingProduct);
      expect(mockProductRepo.delete).toHaveBeenCalledWith(productId);
    });

    it("should throw NotFoundError if product to delete does not exist", async () => {
      const productId = "prod-999";
      mockProductRepo.delete.mockResolvedValue(null);

      await expect(
        vendorProductService.deleteProduct(productId),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
