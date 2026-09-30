import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
});

import { FinancialsService } from "../../src/services/FinancialsService.js";
import { FinancialsRepository } from "../../src/repositories/FinancialsRepository.js";

vi.mock("../../src/repositories/FinancialsRepository.js");

describe("FinancialsService", () => {
  let service: FinancialsService;
  let mockRepo: {
    listLedgers: ReturnType<typeof vi.fn>;
    getLedgerById: ReturnType<typeof vi.fn>;
    createLedgerEntry: ReturnType<typeof vi.fn>;
    updateLedgerBalance: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      listLedgers: vi.fn(),
      getLedgerById: vi.fn(),
      createLedgerEntry: vi.fn(),
      updateLedgerBalance: vi.fn(),
    };

    service = new FinancialsService(
      mockRepo as unknown as FinancialsRepository,
    );
  });

  it("updates the ledger balance when a journal entry is posted", async () => {
    mockRepo.getLedgerById.mockResolvedValue([
      { ledgerId: "CASH", balance: "1000.00", currency: "KES" },
    ]);
    mockRepo.createLedgerEntry.mockResolvedValue({
      id: "entry-1",
      ledgerId: "CASH",
      entryType: "DEBIT",
      amount: "50.00",
      currency: "KES",
      description: "Daily sales",
    });
    mockRepo.updateLedgerBalance.mockResolvedValue({
      ledgerId: "CASH",
      balance: "1050.00",
    });

    const result = await service.createLedgerEntry({
      ledgerId: "CASH",
      entryType: "DEBIT",
      amount: "50.00",
      currency: "KES",
      description: "Daily sales",
    });

    expect(mockRepo.updateLedgerBalance).toHaveBeenCalledWith(
      "CASH",
      "50.00",
      "DEBIT",
    );
    expect(result).toMatchObject({ ledgerId: "CASH", amount: "50.00" });
  });
});
