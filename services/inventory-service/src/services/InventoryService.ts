import { InventoryRepository } from "../repositories/InventoryRepository.js";
import { publishStockLow } from "../events/eventPublisher.js";
import { BadRequestError, NotFoundError } from "../types.js";

export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
  ) {}

  async listItems(page = 1, limit = 20) {
    const data = await this.inventoryRepository.findAll(page, limit);
    const total = await this.inventoryRepository.count();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getItemById(id: string) {
    const item = await this.inventoryRepository.findById(id);
    if (!item) {
      throw new NotFoundError(`Inventory item with id ${id} not found.`);
    }
    return item;
  }

  async getItemsBySku(sku: string) {
    const rows = await this.inventoryRepository.findBySku(sku);
    if (!rows.length) {
      throw new NotFoundError(`No inventory rows found for SKU ${sku}.`);
    }
    return rows;
  }

  async getLowStockItems() {
    return await this.inventoryRepository.findLowStock();
  }

  async createItem(data: {
    productName: string;
    sku: string;
    locationId?: string;
    quantityOnHand?: number;
    unitValue?: string;
    reorderLevel?: number;
  }) {
    return await this.inventoryRepository.create(data);
  }

  async adjustStock(sku: string, delta: number, locationId = "MAIN_WAREHOUSE") {
    const updated = await this.inventoryRepository.adjustOnHand(
      sku,
      locationId,
      delta,
    );

    if (!updated) {
      const existing = await this.inventoryRepository.findBySkuAndLocation(
        sku,
        locationId,
      );

      if (existing === undefined) {
        throw new BadRequestError(
          `Cannot adjust stock for SKU ${sku} below zero at ${locationId}.`,
        );
      }

      if (!existing) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} at location ${locationId} not found.`,
        );
      }

      throw new BadRequestError(
        `Cannot adjust stock for SKU ${sku} below zero at ${locationId}.`,
      );
    }

    if (Number(updated.quantityOnHand) <= Number(updated.reorderLevel)) {
      await publishStockLow({
        sku,
        locationId,
        quantityOnHand: Number(updated.quantityOnHand),
        reorderLevel: Number(updated.reorderLevel),
      });
    }

    return updated;
  }

  async reserveStock(
    sku: string,
    quantity: number,
    locationId = "MAIN_WAREHOUSE",
  ) {
    const updated = await this.inventoryRepository.allocate(
      sku,
      locationId,
      quantity,
    );

    if (!updated) {
      const existing = await this.inventoryRepository.findBySkuAndLocation(
        sku,
        locationId,
      );

      if (existing === undefined) {
        const available = 0;
        throw new BadRequestError(
          `Insufficient available stock for SKU ${sku} (available: ${available})`,
        );
      }

      if (!existing) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} at location ${locationId} not found.`,
        );
      }

      const available = Math.max(
        Number(existing.quantityOnHand) - Number(existing.quantityAllocated),
        0,
      );

      throw new BadRequestError(
        `Insufficient available stock for SKU ${sku} (available: ${available})`,
      );
    }

    return updated;
  }

  async releaseReservation(
    sku: string,
    quantity: number,
    locationId = "MAIN_WAREHOUSE",
  ) {
    const updated = await this.inventoryRepository.releaseAllocation(
      sku,
      locationId,
      quantity,
    );

    if (!updated) {
      throw new NotFoundError(
        `Inventory item for SKU ${sku} at location ${locationId} not found.`,
      );
    }

    return updated;
  }

  async commitSale(
    sku: string,
    quantity: number,
    locationId = "MAIN_WAREHOUSE",
  ) {
    const updated = await this.inventoryRepository.commitSale(
      sku,
      locationId,
      quantity,
    );

    if (!updated) {
      const existing = await this.inventoryRepository.findBySkuAndLocation(
        sku,
        locationId,
      );

      if (existing === undefined) {
        throw new BadRequestError(
          `Insufficient on-hand stock to sell ${quantity} units of SKU ${sku}.`,
        );
      }

      if (!existing) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} at location ${locationId} not found.`,
        );
      }

      throw new BadRequestError(
        `Insufficient on-hand stock to sell ${quantity} units of SKU ${sku}.`,
      );
    }

    if (Number(updated.quantityOnHand) <= Number(updated.reorderLevel)) {
      await publishStockLow({
        sku,
        locationId,
        quantityOnHand: Number(updated.quantityOnHand),
        reorderLevel: Number(updated.reorderLevel),
      });
    }

    return updated;
  }

  async updateAttributes(
    sku: string,
    attributes: {
      weightKg?: string;
      volumeCm3?: number;
      salesVelocity?: "HIGH" | "MEDIUM" | "LOW";
    },
    locationId = "MAIN_WAREHOUSE",
  ) {
    const updated = await this.inventoryRepository.updateAttributes(
      sku,
      locationId,
      attributes,
    );

    if (!updated) {
      throw new NotFoundError(
        `Inventory item for SKU ${sku} at location ${locationId} not found.`,
      );
    }

    return updated;
  }

  async transferStock(
    sku: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
  ) {
    if (fromLocationId === toLocationId) {
      throw new BadRequestError("fromLocationId and toLocationId must differ");
    }
    if (quantity <= 0) {
      throw new BadRequestError("quantity must be positive");
    }

    const source = await this.inventoryRepository.findBySkuAndLocation(
      sku,
      fromLocationId,
    );
    if (!source) {
      throw new NotFoundError(
        `Inventory item for SKU ${sku} at location ${fromLocationId} not found.`,
      );
    }

    const available =
      Number(source.quantityOnHand) - Number(source.quantityAllocated);
    if (quantity > available) {
      throw new BadRequestError(
        `Insufficient On Hand for SKU ${sku} at location ${fromLocationId} (available: ${available}).`,
      );
    }

    return await this.inventoryRepository.transferStock(
      sku,
      fromLocationId,
      toLocationId,
      quantity,
    );
  }

  async deleteItem(id: string) {
    const deleted = await this.inventoryRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Inventory item with id ${id} not found.`);
    }
    return deleted;
  }

  async findStockLevel(sku: string, locationId: string) {
    return await this.inventoryRepository.findStockLevel(sku, locationId);
  }

  async checkStock(sku: string, locationId: string, requestedQuantity: number) {
    const stock = await this.inventoryRepository.findStockLevel(
      sku,
      locationId,
    );
    if (!stock) {
      return {
        stock: null,
        isAvailable: false,
      };
    }

    const available = Math.max(
      Number(stock.quantityOnHand) - Number(stock.quantityAllocated),
      0,
    );

    return {
      stock,
      isAvailable: requestedQuantity > 0 && available >= requestedQuantity,
    };
  }

  async batchCheckStock(
    items: Array<{
      sku: string;
      locationId: string;
      requestedQuantity: number;
    }>,
  ) {
    return await Promise.all(
      items.map(async (item) => {
        const result = await this.checkStock(
          item.sku,
          item.locationId,
          item.requestedQuantity,
        );

        return {
          sku: item.sku,
          stock: result.stock,
          isAvailable: result.isAvailable,
        };
      }),
    );
  }

  async reserveForSale(
    saleId: string,
    sku: string,
    locationId: string,
    quantity: number,
  ) {
    const result = await this.inventoryRepository.reserveForSale(
      saleId,
      sku,
      locationId,
      quantity,
    );

    if (result.kind === "reserved" || result.kind === "already_reserved") {
      return {
        reserved: true,
        stock: result.level,
        failureReason: "",
      };
    }

    return {
      reserved: false,
      stock: result.level,
      failureReason: "Insufficient stock available for reservation.",
    };
  }

  async releaseForSale(saleId: string, sku: string, locationId: string) {
    const result = await this.inventoryRepository.releaseForSale(
      saleId,
      sku,
      locationId,
    );

    return {
      released: result.kind === "released",
      stock: result.level,
    };
  }

  async commitForSale(
    saleId: string,
    sku: string,
    locationId: string,
    quantity: number,
  ) {
    const result = await this.inventoryRepository.commitForSale(
      saleId,
      sku,
      locationId,
      quantity,
    );

    if (result.kind === "committed") {
      return {
        committed: true,
        stock: result.level,
        failureReason: "",
      };
    }

    if (result.kind === "quantity_mismatch") {
      return {
        committed: false,
        stock: null,
        failureReason: `Quantity mismatch. Reserved quantity is ${result.reserved}.`,
      };
    }

    if (result.kind === "no_reservation") {
      return {
        committed: false,
        stock: null,
        failureReason: "No active reservation found for this sale.",
      };
    }

    return {
      committed: false,
      stock: null,
      failureReason: "Insufficient stock available to commit the sale.",
    };
  }
}

export const inventoryService = new InventoryService();
