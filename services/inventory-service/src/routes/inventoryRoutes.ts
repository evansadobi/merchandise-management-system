import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController.js";
import {
  validateUuidParam,
  validateSkuParam,
  validateCreateInventory,
  validateAdjustStock,
  validateReserveStock,
} from "../middlewares/inventoryValidation.js";

const router = Router();
const controller = new InventoryController();

router.get("/", controller.listItems);
router.get("/low-stock", controller.getLowStockItems);
router.get("/:id", validateUuidParam, controller.getItemById);
router.get("/sku/:sku", validateSkuParam, controller.getItemsBySku);
router.post("/", validateCreateInventory, controller.createItem);

router.patch(
  "/sku/:sku/adjust",
  validateSkuParam,
  validateAdjustStock,
  controller.adjustStock,
);
router.patch(
  "/sku/:sku/reserve",
  validateSkuParam,
  validateReserveStock,
  controller.reserveStock,
);
router.patch(
  "/sku/:sku/release",
  validateSkuParam,
  validateReserveStock,
  controller.releaseReservation,
);
router.patch(
  "/sku/:sku/commit-sale",
  validateSkuParam,
  validateReserveStock,
  controller.commitSale,
);

router.delete("/:id", validateUuidParam, controller.deleteItem);

export const inventoryRoutes = router;
