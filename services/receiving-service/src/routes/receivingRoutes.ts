import { Router } from "express";
import { ReceivingController } from "../controllers/ReceivingController.js";
import {
  validateUuidParam,
  validateCreateGrn,
} from "../middlewares/receivingValidation.js";

const router = Router();
const controller = new ReceivingController();

router.get("/expected-deliveries", controller.listExpectedDeliveries);

router.get("/grn", controller.listGrns);
router.get("/grn/:id", validateUuidParam, controller.getGrnById);
router.post("/grn", validateCreateGrn, controller.createGrn);

export const receivingRoutes = router;
