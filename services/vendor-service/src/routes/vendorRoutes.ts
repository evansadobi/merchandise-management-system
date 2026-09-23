import { Router } from "express";
import { VendorController } from "../controllers/VendorController.js";
import {
  validateUuidParam,
  validateCreateVendor,
  validateUpdateVendor,
} from "../middlewares/vendorValidation.js";

const router = Router();
const controller = new VendorController();

router.get("/", controller.getVendors);
router.get("/:id", validateUuidParam, controller.getVendorById);
router.post("/", validateCreateVendor, controller.createVendor);
router.patch(
  "/:id",
  validateUuidParam,
  validateUpdateVendor,
  controller.updateVendor,
);
router.delete("/:id", validateUuidParam, controller.deleteVendor);

export const vendorRoutes = router;
