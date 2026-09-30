import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
});

import { RetailSalesService } from "../../src/services/RetailSalesService.js";
import { RetailSalesRepository } from "../../src/repositories/RetailSalesRepository.js";

vi.mock("../../src/repositories/RetailSalesRepository.js");

describe("RetailSalesService", () => {
  let service: RetailSalesService;
  let mockRepo: {
    createSale: ReturnType<typeof vi.fn>;
    findBySaleId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      createSale: vi.fn(),
      findBySaleId: vi.fn(),
      list: vi.fn(),
    };

    service = new RetailSalesService(
      mockRepo as unknown as RetailSalesRepository,
    );
  });

  it("creates a sale when the payload is valid", async () => {
    mockRepo.createSale.mockResolvedValue({
      saleId: "SALE-1001",
      storeId: "STORE-01",
      registerId: "REG-01",
      customerId: "CUST-01",
      sku: "SKU-123",
      quantity: 2,
      unitPrice: "250.00",
      totalAmount: "500.00",
      paymentMethod: "CARD",
      status: "COMPLETED",
    });

    const result = await service.createSale({
      saleId: "SALE-1001",
      storeId: "STORE-01",
      registerId: "REG-01",
      customerId: "CUST-01",
      sku: "SKU-123",
      quantity: 2,
      unitPrice: "250.00",
      totalAmount: "500.00",
      paymentMethod: "CARD",
    });

    expect(mockRepo.createSale).toHaveBeenCalledWith({
      saleId: "SALE-1001",
      storeId: "STORE-01",
      registerId: "REG-01",
      customerId: "CUST-01",
      sku: "SKU-123",
      quantity: 2,
      unitPrice: "250.00",
      totalAmount: "500.00",
      paymentMethod: "CARD",
    });
    expect(result).toMatchObject({
      saleId: "SALE-1001",
      totalAmount: "500.00",
    });
  });

  it("rejects creating a duplicate sale id", async () => {
    mockRepo.findBySaleId.mockResolvedValue([
      {
        saleId: "SALE-1001",
      },
    ]);

    await expect(
      service.createSale({
        saleId: "SALE-1001",
        storeId: "STORE-01",
        registerId: "REG-01",
        customerId: "CUST-01",
        sku: "SKU-123",
        quantity: 2,
        unitPrice: "250.00",
        totalAmount: "500.00",
        paymentMethod: "CARD",
      }),
    ).rejects.toThrow("already exists");

    expect(mockRepo.createSale).not.toHaveBeenCalled();
  });
});
