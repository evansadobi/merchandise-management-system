import { Router } from "express";
import { FinancialsController } from "../controllers/FinancialsController.js";
import { FinancialsService } from "../services/FinancialsService.js";

const router = Router();
const controller = new FinancialsController(new FinancialsService());

router.get("/ledgers", controller.listLedgers);
router.get("/ledgers/:ledgerId", controller.getLedgerById);
router.post("/journal-entries", controller.createLedgerEntry);

export { router as financialsRoutes };
