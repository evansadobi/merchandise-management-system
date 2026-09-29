import { WarehouseRepository } from "../repositories/WarehouseRepository.js";
import { InventoryServiceClient } from "../clients/InventoryServiceClient.js";
import {
  publishPutawayTaskCreated,
  publishStockPlaced,
} from "../events/eventPublisher.js";
import { NotFoundError, BadRequestError, ConflictError } from "../types.js";

const DEFAULT_WAREHOUSE = "MAIN_WAREHOUSE";

type ZoneCode = "FAST" | "MID" | "BULK";

export class WarehouseService {
  constructor(
    private warehouseRepo: WarehouseRepository = new WarehouseRepository(),
    private inventoryClient: InventoryServiceClient = new InventoryServiceClient(),
  ) {}

  async createZone(data: {
    warehouseId: string;
    code: ZoneCode;
    description?: string;
  }) {
    if (!["FAST", "MID", "BULK"].includes(data.code)) {
      throw new BadRequestError(`Invalid zone code: ${data.code}`);
    }
    try {
      const zone = await this.warehouseRepo.createZone(data);
      if (!zone) {
        throw new ConflictError("Zone already exists for this warehouse");
      }
      return zone;
    } catch (err) {
      if (this.isUniqueViolation(err, "zones_warehouse_code_unique")) {
        throw new ConflictError(
          `Zone ${data.code} already exists for warehouse ${data.warehouseId}`,
        );
      }
      throw err;
    }
  }

  async listZones(warehouseId: string) {
    return this.warehouseRepo.findZonesByWarehouse(warehouseId);
  }

  async listAislesByZone(zoneId: string) {
    const zone = await this.warehouseRepo.findZoneById(zoneId);
    if (!zone) throw new NotFoundError(`Zone ${zoneId} not found`);
    return this.warehouseRepo.findAislesByZone(zoneId);
  }

  async createAisle(data: { zoneId: string; code: string }) {
    const zone = await this.warehouseRepo.findZoneById(data.zoneId);
    if (!zone) throw new NotFoundError(`Zone ${data.zoneId} not found`);
    try {
      const aisle = await this.warehouseRepo.createAisle(data);
      if (!aisle) {
        throw new ConflictError("Aisle already exists in this zone");
      }
      return aisle;
    } catch (err) {
      if (this.isUniqueViolation(err, "aisles_zone_code_unique")) {
        throw new ConflictError(
          `Aisle ${data.code} already exists in zone ${data.zoneId}`,
        );
      }
      throw err;
    }
  }

  async createShelf(data: { aisleId: string; code: string }) {
    try {
      const shelf = await this.warehouseRepo.createShelf(data);
      if (!shelf) {
        throw new ConflictError("Shelf already exists in this aisle");
      }
      return shelf;
    } catch (err) {
      if (this.isUniqueViolation(err, "shelves_aisle_code_unique")) {
        throw new ConflictError(
          `Shelf ${data.code} already exists in aisle ${data.aisleId}`,
        );
      }
      throw err;
    }
  }

  async createBin(data: {
    shelfId: string;
    binCode: string;
    capacityUnits: number;
  }) {
    const path = await this.resolveShelfPath(data.shelfId);
    const fullCode = `${path.zoneCode}-${path.aisleCode}-${path.shelfCode}-${data.binCode}`;

    try {
      const bin = await this.warehouseRepo.createBin({
        shelfId: data.shelfId,
        binCode: data.binCode,
        fullCode,
        capacityUnits: data.capacityUnits,
      });
      if (!bin) {
        throw new ConflictError("Bin already exists in this shelf");
      }
      return bin;
    } catch (err) {
      if (
        this.isUniqueViolation(err, "bins_shelf_bin_unique") ||
        this.isUniqueViolation(err, "bins_full_code_unique")
      ) {
        throw new ConflictError(
          `Bin ${fullCode} already exists (or duplicate binCode in shelf)`,
        );
      }
      throw err;
    }
  }

  async getBinById(id: string) {
    const bin = await this.warehouseRepo.findBinWithPath(id);
    if (!bin) throw new NotFoundError(`Bin ${id} not found`);
    return bin;
  }

  async findAvailableBins(params: {
    warehouseId: string;
    zone?: ZoneCode | undefined;
    minCapacity: number;
  }) {
    if (params.zone) {
      const bin = await this.warehouseRepo.findFirstAvailableBinInZone(
        params.warehouseId,
        params.zone,
        params.minCapacity,
      );
      return bin ? [bin] : [];
    }
    const bin = await this.warehouseRepo.findAnyAvailableBin(
      params.warehouseId,
      params.minCapacity,
    );
    return bin ? [bin] : [];
  }

  async getUtilizationReport(warehouseId: string) {
    return this.warehouseRepo.getUtilizationReport(warehouseId);
  }

  async suggestBin(params: {
    sku: string;
    quantity: number;
    warehouseId?: string;
  }) {
    const warehouseId = params.warehouseId ?? DEFAULT_WAREHOUSE;

    const attributes = await this.inventoryClient.getSkuAttributes(params.sku);
    const zone = this.zoneForVelocity(attributes?.salesVelocity ?? null);

    const primary = await this.warehouseRepo.findFirstAvailableBinInZone(
      warehouseId,
      zone,
      params.quantity,
    );

    if (primary) {
      return {
        bin: primary,
        zone,
        reason: `Zone ${zone} chosen for salesVelocity=${attributes?.salesVelocity ?? "null"}; bin ${primary.fullCode} has ${primary.capacityUnits - primary.currentUtilization} units free.`,
      };
    }

    const fallback = await this.warehouseRepo.findAnyAvailableBin(
      warehouseId,
      params.quantity,
    );

    if (fallback) {
      console.warn(
        `[suggestBin] Zone ${zone} full for SKU ${params.sku} qty=${params.quantity}; falling back to ${fallback.zoneCode}/${fallback.fullCode}`,
      );
      return {
        bin: fallback,
        zone,
        reason: `Preferred zone ${zone} full; fell back to ${fallback.fullCode} in zone ${fallback.zoneCode}.`,
      };
    }

    console.error(
      `[suggestBin] No bin anywhere in ${warehouseId} has capacity for SKU ${params.sku} qty=${params.quantity}.`,
    );
    return {
      bin: null,
      zone,
      reason: `No bin with ${params.quantity} free units found anywhere in ${warehouseId}. Manual intervention required.`,
    };
  }

  private zoneForVelocity(velocity: string | null): ZoneCode {
    switch ((velocity ?? "").toUpperCase()) {
      case "HIGH":
        return "FAST";
      case "LOW":
        return "BULK";
      case "MEDIUM":
      default:
        return "MID";
    }
  }

  private async resolveShelfPath(shelfId: string) {
    const path = await this.warehouseRepo.findShelfPath(shelfId);
    if (!path) throw new NotFoundError(`Shelf ${shelfId} not found`);
    return path;
  }

  private isUniqueViolation(err: unknown, constraintName: string): boolean {
    if (!(err instanceof Error)) return false;

    const messages: string[] = [err.message];
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error) messages.push(cause.message);

    return messages.some((m) => m.includes(constraintName));
  }

  async handleGoodsReceived(data: {
    grnId: string;
    purchaseOrderId: string;
    sku: string;
    quantity: number;
    locationId?: string | undefined;
  }) {
    const warehouseId = data.locationId ?? DEFAULT_WAREHOUSE;

    const suggestion = await this.suggestBin({
      sku: data.sku,
      quantity: data.quantity,
      warehouseId,
    });

    const task = await this.warehouseRepo.createPutawayTask({
      grnId: data.grnId,
      purchaseOrderId: data.purchaseOrderId,
      sku: data.sku,
      quantity: data.quantity,
      suggestedBinId: suggestion.bin?.id ?? null,
    });

    if (!task) {
      throw new Error(`Failed to create putaway task for GRN ${data.grnId}`);
    }

    await publishPutawayTaskCreated({
      taskId: task.id,
      sku: task.sku,
      quantity: task.quantity,
      suggestedBinCode: suggestion.bin?.fullCode ?? null,
    });

    return task;
  }

  async listPutawayTasks(filter: {
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
    assignedTo?: string | undefined;
  }) {
    return this.warehouseRepo.findPutawayTasks(filter);
  }

  async startPutawayTask(id: string, assignedTo?: string) {
    const task = await this.warehouseRepo.findPutawayTaskById(id);
    if (!task) throw new NotFoundError(`Putaway task ${id} not found`);

    const updated = await this.warehouseRepo.startPutawayTask(id, assignedTo);
    if (!updated) {
      throw new ConflictError(
        `Cannot start task ${id}: it is already ${task.status}`,
      );
    }
    return updated;
  }

  async completePutawayTask(id: string, actualBinId: string) {
    const task = await this.warehouseRepo.findPutawayTaskById(id);
    if (!task) throw new NotFoundError(`Putaway task ${id} not found`);
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw new ConflictError(
        `Cannot complete task ${id}: it is ${task.status}`,
      );
    }

    const bin = await this.warehouseRepo.findBinById(actualBinId);
    if (!bin) throw new NotFoundError(`Bin ${actualBinId} not found`);

    const remaining = bin.capacityUnits - bin.currentUtilization;
    if (remaining < task.quantity) {
      throw new BadRequestError(
        `Bin ${bin.fullCode} has only ${remaining} free units; task needs ${task.quantity}`,
      );
    }

    const completed = await this.warehouseRepo.completePutawayTask(
      id,
      actualBinId,
    );
    if (!completed) {
      throw new ConflictError(
        `Task ${id} could not be completed (state changed)`,
      );
    }

    await publishStockPlaced({
      sku: completed.sku,
      warehouseId: DEFAULT_WAREHOUSE,
      binCode: bin.fullCode,
      quantity: completed.quantity,
    });

    return completed;
  }

  async listPickingTasks(filter: {
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
    assignedTo?: string | undefined;
  }) {
    return this.warehouseRepo.findPickingTasks(filter);
  }

  async startPickingTask(id: string, assignedTo?: string) {
    const task = await this.warehouseRepo.findPickingTaskById(id);
    if (!task) throw new NotFoundError(`Picking task ${id} not found`);

    const updated = await this.warehouseRepo.startPickingTask(id, assignedTo);
    if (!updated) {
      throw new ConflictError(
        `Cannot start task ${id}: it is already ${task.status}`,
      );
    }
    return updated;
  }

  async completePickingTask(id: string) {
    const task = await this.warehouseRepo.findPickingTaskById(id);
    if (!task) throw new NotFoundError(`Picking task ${id} not found`);
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw new ConflictError(
        `Cannot complete task ${id}: it is ${task.status}`,
      );
    }

    const updated = await this.warehouseRepo.completePickingTask(id);
    if (!updated) {
      throw new ConflictError(
        `Task ${id} could not be completed (state changed)`,
      );
    }
    return updated;
  }

  async createTransfer(data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    items: { sku: string; quantity: number }[];
  }) {
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestError(
        "Source and destination warehouses must differ",
      );
    }
    if (data.items.length === 0) {
      throw new BadRequestError("At least one transfer item is required");
    }

    const transfer = await this.warehouseRepo.createTransfer(data);

    for (const item of transfer.items) {
      try {
        await this.warehouseRepo.createPickingTask({
          referenceId: transfer.id,
          sku: item.sku,
          quantity: item.quantity,
        });
      } catch (err) {
        if (this.isUniqueViolation(err, "picking_tasks_transfer_sku_unique")) {
          continue;
        }
        throw err;
      }
    }

    return transfer;
  }

  async getTransferById(id: string) {
    const transfer = await this.warehouseRepo.findTransferById(id);
    if (!transfer) throw new NotFoundError(`Transfer ${id} not found`);
    return transfer;
  }

  async listTransfers(filter?: { status?: string | undefined }) {
    return this.warehouseRepo.findTransfers(filter);
  }

  async completeTransfer(id: string) {
    const transfer = await this.getTransferById(id);
    if (transfer.status !== "PENDING") {
      throw new ConflictError(
        `Cannot complete transfer ${id}: it is already ${transfer.status}`,
      );
    }

    for (const item of transfer.items) {
      try {
        await this.inventoryClient.transferStock({
          sku: item.sku,
          fromLocationId: transfer.fromWarehouseId,
          toLocationId: transfer.toWarehouseId,
          quantity: item.quantity,
        });
      } catch (err) {
        await this.warehouseRepo.markTransferCancelled(id);
        console.error(
          `Transfer ${id} failed on SKU ${item.sku}:`,
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    }

    const completed = await this.warehouseRepo.markTransferComplete(id);
    if (!completed) {
      throw new ConflictError(`Transfer ${id} could not be marked complete`);
    }
    return completed;
  }
}
