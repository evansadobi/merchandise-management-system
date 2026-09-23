import { InventoryRepository } from "../repositories/InventoryRepository.js";
import { publishStockLow } from "../events/eventPublisher.js";
import { NotFoundError, BadRequestError } from "../types.js";

const DEFAULT_LOCATION = "MAIN_WAREHOUSE";

export class InventoryService {
  constructor(
    private inventoryRepo: InventoryRepository = new InventoryRepository(),
  ) {}

  private resolveLocation(locationId?: string) {
    return locationId && locationId.trim() !== ""
      ? locationId.trim()
      : DEFAULT_LOCATION;
  }

  async listItems(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.inventoryRepo.findAll(page, limit),
      this.inventoryRepo.count(),
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

  async getItemById(id: string) {
    const item = await this.inventoryRepo.findById(id);
    if (!item) {
      throw new NotFoundError(`Inventory item with id ${id} not found`);
    }
    return item;
  }

  async getItemsBySku(sku: string) {
    const items = await this.inventoryRepo.findBySku(sku);
    if (items.length === 0) {
      throw new NotFoundError(
        `No inventory record found for SKU ${sku} at any location`,
      );
    }
    return items;
  }

  async getLowStockItems() {
    return this.inventoryRepo.findLowStock();
  }

  async createItem(data: {
    productName: string;
    sku: string;
    locationId?: string | undefined;
    quantityOnHand?: number | undefined;
    unitValue?: string | undefined;
    reorderLevel?: number | undefined;
  }) {
    return this.inventoryRepo.create(data);
  }

  async adjustStock(sku: string, delta: number, locationId?: string) {
    const resolvedLocationId = this.resolveLocation(locationId);

    const updated = await this.inventoryRepo.adjustOnHand(
      sku,
      resolvedLocationId,
      delta,
    );

    if (!updated) {
      const existing = await this.inventoryRepo.findBySkuAndLocation(
        sku,
        resolvedLocationId,
      );
      if (!existing) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} not found at location ${resolvedLocationId}`,
        );
      }
      throw new BadRequestError(
        `Cannot reduce On Hand below zero (current: ${existing.quantityOnHand})`,
      );
    }

    await this.checkAndPublishLowStock(updated);
    return updated;
  }

  async reserveStock(sku: string, quantity: number, locationId?: string) {
    const resolvedLocationId = this.resolveLocation(locationId);

    const updated = await this.inventoryRepo.allocate(
      sku,
      resolvedLocationId,
      quantity,
    );

    if (!updated) {
      const existing = await this.inventoryRepo.findBySkuAndLocation(
        sku,
        resolvedLocationId,
      );
      if (!existing) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} not found at location ${resolvedLocationId}`,
        );
      }
      const available = existing.quantityOnHand - existing.quantityAllocated;
      throw new BadRequestError(
        `Insufficient available stock for SKU ${sku} (available: ${available})`,
      );
    }

    return updated;
  }

  async releaseReservation(sku: string, quantity: number, locationId?: string) {
    const resolvedLocationId = this.resolveLocation(locationId);

    const updated = await this.inventoryRepo.releaseAllocation(
      sku,
      resolvedLocationId,
      quantity,
    );
    if (!updated) {
      throw new NotFoundError(
        `Inventory item for SKU ${sku} not found at location ${resolvedLocationId}`,
      );
    }
    return updated;
  }

  async commitSale(sku: string, quantity: number, locationId?: string) {
    const resolvedLocationId = this.resolveLocation(locationId);

    const updated = await this.inventoryRepo.commitSale(
      sku,
      resolvedLocationId,
      quantity,
    );

    if (!updated) {
      throw new BadRequestError(
        `Cannot commit sale for SKU ${sku}: insufficient On Hand quantity`,
      );
    }

    await this.checkAndPublishLowStock(updated);
    return updated;
  }

  async deleteItem(id: string) {
    const deleted = await this.inventoryRepo.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Inventory item with id ${id} not found`);
    }
    return deleted;
  }

  private async checkAndPublishLowStock(item: {
    sku: string;
    locationId: string;
    quantityOnHand: number;
    reorderLevel: number;
  }) {
    if (item.quantityOnHand <= item.reorderLevel) {
      await publishStockLow({
        sku: item.sku,
        locationId: item.locationId,
        quantityOnHand: item.quantityOnHand,
        reorderLevel: item.reorderLevel,
      });
    }
  }
}
