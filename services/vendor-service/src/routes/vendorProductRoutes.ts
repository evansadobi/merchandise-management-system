import { Router } from "express";
import { VendorProductController } from "../controllers/VendorProductController.js";
import {
  validateUuidParam,
  validateSkuParam,
  validateStatusQuery,
  validateCreateProduct,
  validateUpdateProduct,
} from "../middlewares/productValidation.js";

const router = Router();
const controller = new VendorProductController();

router.get(
  "/sku/:sku/suppliers",
  validateSkuParam,
  validateStatusQuery,
  controller.getSuppliersForSku,
);
router.get("/:vendorId/products", validateUuidParam, controller.getByVendorId);
router.post(
  "/:vendorId/products",
  validateUuidParam,
  validateCreateProduct,
  controller.createProduct,
);
router.patch(
  "/products/:id",
  validateUuidParam,
  validateUpdateProduct,
  controller.updateProduct,
);
router.delete("/products/:id", validateUuidParam, controller.deleteProduct);

export default router;
