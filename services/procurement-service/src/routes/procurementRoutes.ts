import { Router } from "express";
import { ProcurementController } from "../controllers/ProcurementController.js";

const router = Router();
const controller = new ProcurementController();

router.get("/", controller.getPurchaseOrders);
router.get("/:id", controller.getPurchaseOrderById);
router.post("/", controller.createPurchaseOrder);
router.patch("/:id/approve", controller.approvePurchaseOrder);
router.patch("/:id/receive", controller.receivePurchaseOrder);

export const procurementRoutes = router;
