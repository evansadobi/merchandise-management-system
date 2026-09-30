import { Router } from "express";
import { SalesAuditController } from "../controllers/SalesAuditController.js";
import { SalesAuditService } from "../services/SalesAuditService.js";

const router = Router();
const controller = new SalesAuditController(new SalesAuditService());

router.get("/registers", controller.listReconciliations);
router.get(
  "/registers/:registerId/reconciliation",
  controller.getReconciliation,
);
router.post(
  "/registers/:registerId/reconciliation",
  controller.createReconciliation,
);

export { router as salesAuditRoutes };
