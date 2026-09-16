import { Router } from "express";
import { VendorController } from "../controllers/VendorController.js";

const router = Router();
const controller = new VendorController();

router.get("/", controller.getVendors);
router.get("/:id", controller.getVendorById);
router.post("/", controller.createVendor);
router.patch("/:id", controller.updateVendor);

export const vendorRoutes = router;
