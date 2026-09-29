import { describe, it, expect, vi, beforeEach } from "vitest";
import { WarehouseService } from "../../src/services/WarehouseService.js";
import { WarehouseRepository } from "../../src/repositories/WarehouseRepository.js";
import { InventoryServiceClient } from "../../src/clients/InventoryServiceClient.js";

vi.mock("../../src/events/eventPublisher.js", () => ({
  publishPutawayTaskCreated: vi.fn().mockResolvedValue(undefined),
  publishStockPlaced: vi.fn().mockResolvedValue(undefined),
  stopEventPublisher: vi.fn().mockResolvedValue(undefined),
}));

function makeRepoMock() {
  return {
    findFirstAvailableBinInZone: vi.fn(),
    findAnyAvailableBin: vi.fn(),
    createPutawayTask: vi.fn(),
    findPutawayTaskById: vi.fn(),
  } as unknown as WarehouseRepository;
}

function makeInvMock() {
  return {
    getSkuAttributes: vi.fn(),
    transferStock: vi.fn(),
  } as unknown as InventoryServiceClient;
}

describe("WarehouseService.suggestBin", () => {
  let repo: WarehouseRepository;
  let inv: InventoryServiceClient;
  let service: WarehouseService;

  beforeEach(() => {
    repo = makeRepoMock();
    inv = makeInvMock();
    service = new WarehouseService(repo, inv);
  });

  it("maps HIGH velocity to FAST zone", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue({ salesVelocity: "HIGH" });
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue({
      id: "bin-fast-1",
      fullCode: "FAST-A-01-01",
      zoneCode: "FAST",
      capacityUnits: 100,
      currentUtilization: 0,
    });

    const result = await service.suggestBin({ sku: "X", quantity: 10 });

    expect(result.zone).toBe("FAST");
    expect(result.bin?.fullCode).toBe("FAST-A-01-01");
    expect(repo.findFirstAvailableBinInZone).toHaveBeenCalledWith(
      "MAIN_WAREHOUSE",
      "FAST",
      10,
    );
  });

  it("maps LOW velocity to BULK zone", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue({ salesVelocity: "LOW" });
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue({
      id: "bin-bulk-1",
      fullCode: "BULK-A-01-01",
      zoneCode: "BULK",
      capacityUnits: 1000,
      currentUtilization: 0,
    });

    const result = await service.suggestBin({ sku: "X", quantity: 500 });

    expect(result.zone).toBe("BULK");
    expect(repo.findFirstAvailableBinInZone).toHaveBeenCalledWith(
      "MAIN_WAREHOUSE",
      "BULK",
      500,
    );
  });

  it("maps MEDIUM velocity to MID zone", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue({
      salesVelocity: "MEDIUM",
    });
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue({
      id: "bin-mid-1",
      fullCode: "MID-A-01-01",
      zoneCode: "MID",
      capacityUnits: 200,
      currentUtilization: 0,
    });

    const result = await service.suggestBin({ sku: "X", quantity: 50 });
    expect(result.zone).toBe("MID");
  });

  it("defaults to MID when velocity is null", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue(null);
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue({
      id: "bin-mid-1",
      fullCode: "MID-A-01-01",
      zoneCode: "MID",
      capacityUnits: 200,
      currentUtilization: 0,
    });

    const result = await service.suggestBin({ sku: "X", quantity: 50 });

    expect(result.zone).toBe("MID");
    expect(result.reason).toMatch(/salesVelocity=null/);
  });

  it("falls back to any zone when the target zone is full", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue({ salesVelocity: "HIGH" });
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue(null);
    (repo.findAnyAvailableBin as any).mockResolvedValue({
      id: "bin-mid-1",
      fullCode: "MID-A-01-01",
      zoneCode: "MID",
      capacityUnits: 200,
      currentUtilization: 0,
    });

    const result = await service.suggestBin({ sku: "X", quantity: 200 });

    expect(result.bin?.fullCode).toBe("MID-A-01-01");
    expect(result.reason).toMatch(/fell back/i);
    expect(repo.findAnyAvailableBin).toHaveBeenCalled();
  });

  it("returns bin=null (not an error) when nothing fits anywhere", async () => {
    (inv.getSkuAttributes as any).mockResolvedValue({ salesVelocity: "HIGH" });
    (repo.findFirstAvailableBinInZone as any).mockResolvedValue(null);
    (repo.findAnyAvailableBin as any).mockResolvedValue(null);

    const result = await service.suggestBin({ sku: "X", quantity: 5000 });

    expect(result.bin).toBeNull();
    expect(result.zone).toBe("FAST");
    expect(result.reason).toMatch(/Manual intervention/);
  });
});
