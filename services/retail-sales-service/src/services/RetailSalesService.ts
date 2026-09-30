import { eq } from "drizzle-orm";
import { RetailSalesRepository } from "../repositories/RetailSalesRepository.js";
import { BadRequestError, ConflictError, NotFoundError } from "../types.js";

export class RetailSalesService {
  constructor(
    private readonly retailSalesRepository: RetailSalesRepository = new RetailSalesRepository(),
  ) {}

  async createSale(input: {
    saleId: string;
    storeId: string;
    registerId: string;
    customerId: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
    paymentMethod: string;
  }) {
    if (!input.saleId || !input.sku || input.quantity <= 0) {
      throw new BadRequestError("Sale request is missing required values.");
    }

    const existing =
      (await this.retailSalesRepository.findBySaleId(input.saleId)) ?? [];
    if (Array.isArray(existing) && existing.length > 0) {
      throw new ConflictError(`Sale ${input.saleId} already exists.`);
    }

    return await this.retailSalesRepository.createSale(input);
  }

  async getSaleById(saleId: string) {
    const records =
      (await this.retailSalesRepository.findBySaleId(saleId)) ?? [];
    if (!Array.isArray(records) || !records[0]) {
      throw new NotFoundError(`Sale ${saleId} was not found.`);
    }
    return records[0];
  }

  async listSales(page = 1, limit = 20) {
    const data = await this.retailSalesRepository.list(page, limit);
    return { data, pagination: { page, limit, total: data.length } };
  }
}
