import { Router } from "express";
import { ProcurementController } from "../controllers/ProcurementController.js";
import {
  validateUuidParam,
  validateCreatePurchaseOrder,
  validateApprovePurchaseOrder,
  validateReceivePurchaseOrder,
} from "../middlewares/procurementValidation.js";

const router = Router();
const controller = new ProcurementController();

router.get("/", controller.getPurchaseOrders);
router.get("/:id", validateUuidParam, controller.getPurchaseOrderById);
router.post("/", validateCreatePurchaseOrder, controller.createPurchaseOrder);
router.patch(
  "/:id/approve",
  validateUuidParam,
  validateApprovePurchaseOrder,
  controller.approvePurchaseOrder,
);
router.patch(
  "/:id/receive",
  validateUuidParam,
  validateReceivePurchaseOrder,
  controller.receivePurchaseOrder,
);

export const procurementRoutes = router;
