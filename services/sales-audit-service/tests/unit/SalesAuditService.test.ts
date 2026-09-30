import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
});

import { SalesAuditService } from "../../src/services/SalesAuditService.js";
import { SalesAuditRepository } from "../../src/repositories/SalesAuditRepository.js";

vi.mock("../../src/repositories/SalesAuditRepository.js");

describe("SalesAuditService", () => {
  let service: SalesAuditService;
  let mockRepo: {
    createReconciliation: ReturnType<typeof vi.fn>;
    findByRegisterId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    upsertReconciliation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createReconciliation: vi.fn(),
      findByRegisterId: vi.fn(),
      list: vi.fn(),
      upsertReconciliation: vi.fn(),
    };

    service = new SalesAuditService(
      mockRepo as unknown as SalesAuditRepository,
    );
  });

  it("adds ItemSold totals into the register's expected total", async () => {
    mockRepo.findByRegisterId.mockResolvedValue([
      {
        id: "rec-1",
        registerId: "REG-02",
        storeId: "STORE-03",
        expectedTotal: "120.00",
        physicalTotal: "0.00",
        variance: "-120.00",
        status: "OPEN",
      },
    ]);
    mockRepo.upsertReconciliation.mockResolvedValue({
      id: "rec-1",
      registerId: "REG-02",
      storeId: "STORE-03",
      expectedTotal: "220.00",
      physicalTotal: "0.00",
      variance: "-220.00",
      status: "OPEN",
    });

    const result = await service.recordSale({
      registerId: "REG-02",
      storeId: "STORE-03",
      total: "100.00",
    });

    expect(mockRepo.upsertReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: "REG-02",
        storeId: "STORE-03",
        expectedTotal: "220.00",
        physicalTotal: "0.00",
        variance: "-220.00",
        status: "OPEN",
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.expectedTotal).toBe("220.00");
  });
});
