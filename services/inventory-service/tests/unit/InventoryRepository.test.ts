import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../src/db/db.js", () => ({ db }));

import { InventoryRepository } from "../../src/repositories/InventoryRepository.js";

describe("InventoryRepository.receiveOnOrderStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a stock row when the SKU/location is not yet present", async () => {
    const repo = new InventoryRepository();

    const insertedRow = {
      sku: "SKU-200",
      locationId: "MAIN_WAREHOUSE",
      quantityOnHand: 30,
      quantityOnOrder: 0,
    };

    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedRow]),
        }),
      }),
    });

    const result = await repo.receiveOnOrderStock(
      "SKU-200",
      "MAIN_WAREHOUSE",
      15,
    );

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual(insertedRow);
  });
});
