import { Router } from "express";
import { WarehouseController } from "../controllers/WarehouseController.js";
import {
  validateUuidParam,
  validateCreateZone,
  validateCreateAisle,
  validateCreateShelf,
  validateCreateBin,
  validateStartTask,
  validateCompletePutaway,
  validateCreateTransfer,
  validateSuggestBin,
} from "../middlewares/warehouseValidation.js";

const router = Router();
const controller = new WarehouseController();

router.get("/zones", controller.listZones);
router.post("/zones", validateCreateZone, controller.createZone);
router.get("/zones/:id/aisles", validateUuidParam, controller.listAislesByZone);

router.post("/aisles", validateCreateAisle, controller.createAisle);
router.post("/shelves", validateCreateShelf, controller.createShelf);

router.post("/bins", validateCreateBin, controller.createBin);
router.get("/bins/available", controller.findAvailableBins);
router.get("/bins/utilization", controller.getUtilization);
router.get("/bins/:id", validateUuidParam, controller.getBinById);

router.get("/putaway/tasks", controller.listPutawayTasks);
router.post(
  "/putaway/tasks/:id/start",
  validateUuidParam,
  validateStartTask,
  controller.startPutawayTask,
);
router.post(
  "/putaway/tasks/:id/complete",
  validateUuidParam,
  validateCompletePutaway,
  controller.completePutawayTask,
);
router.post("/putaway/suggest", validateSuggestBin, controller.suggestBin);

router.get("/picking/tasks", controller.listPickingTasks);
router.post(
  "/picking/tasks/:id/start",
  validateUuidParam,
  validateStartTask,
  controller.startPickingTask,
);
router.post(
  "/picking/tasks/:id/complete",
  validateUuidParam,
  controller.completePickingTask,
);

router.get("/transfers", controller.listTransfers);
router.post("/transfers", validateCreateTransfer, controller.createTransfer);
router.get("/transfers/:id", validateUuidParam, controller.getTransferById);
router.post(
  "/transfers/:id/complete",
  validateUuidParam,
  controller.completeTransfer,
);

export const warehouseRoutes = router;
