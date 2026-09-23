import { VendorProductRepository } from "../repositories/VendorProductRepository.js";
import { VendorRepository } from "../repositories/VendorRepository.js";
import { NotFoundError } from "../types.js";
import type { VendorStatus } from "../types.js";

export class VendorProductService {
  constructor(
    private productRepo = new VendorProductRepository(),
    private vendorRepo = new VendorRepository(),
  ) {}

  async getProductsByVendorId(vendorId: string) {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return await this.productRepo.findByVendorId(vendorId);
  }

  async getSuppliersForSku(sku: string, status?: VendorStatus) {
    return await this.productRepo.findSuppliersBySkuAndStatus(sku, status);
  }

  async createProduct(
    vendorId: string,
    data: { sku: string; unitCost: string },
  ) {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return await this.productRepo.create({ vendorId, ...data });
  }

  async updateProduct(
    id: string,
    updates: Partial<{ sku: string; unitCost: string }>,
  ) {
    const existing = await this.productRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Vendor product not found");
    }
    return await this.productRepo.update(id, updates);
  }

  async deleteProduct(id: string) {
    const deleted = await this.productRepo.delete(id);
    if (!deleted) {
      throw new NotFoundError("Vendor product not found");
    }
    return deleted;
  }
}
