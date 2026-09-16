import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController.js";

const router = Router();
const controller = new InventoryController();

router.get("/low-stock", controller.getLowStockItems);

router.get("/", controller.getItems);
router.get("/id/:id", controller.getItemById);
router.get("/sku/:sku", controller.getItemsBySku);
router.post("/", controller.createItem);
router.patch("/:sku/stock", controller.adjustStock);

export const inventoryRoutes = router;
