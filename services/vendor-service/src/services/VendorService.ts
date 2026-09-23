import { VendorRepository } from "../repositories/VendorRepository.js";
import { NotFoundError, type VendorStatus } from "../types.js";

export class VendorService {
  constructor(private vendorRepo: VendorRepository = new VendorRepository()) {}

  async getAllVendors(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.vendorRepo.findAll(page, limit),
      this.vendorRepo.count(),
    ]);

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

  async getVendorById(id: string) {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  }

  async createVendor(data: {
    name: string;
    contactEmail: string;
    contactPhone: string;
    paymentTerms: string;
    leadTimeDays: number;
  }) {
    return await this.vendorRepo.create(data);
  }

  async updateVendor(
    id: string,
    updates: Partial<{
      name: string;
      contactEmail: string;
      contactPhone: string;
      paymentTerms: string;
      leadTimeDays: number;
      status: VendorStatus;
    }>,
  ) {
    await this.getVendorById(id);
    return await this.vendorRepo.update(id, updates);
  }

  async deleteVendor(id: string) {
    await this.getVendorById(id);
    return await this.vendorRepo.delete(id);
  }
}
