import { Router } from "express";
import { VendorProductController } from "../controllers/VendorProductController.js";

const router = Router();
const productController = new VendorProductController();

router.get("/sku/:sku/suppliers", productController.getSuppliersForSku);

router.get("/:vendorId/products", productController.getByVendorId);
router.post("/:vendorId/products", productController.createProduct);
router.delete("/products/:id", productController.deleteProduct);

export default router;
