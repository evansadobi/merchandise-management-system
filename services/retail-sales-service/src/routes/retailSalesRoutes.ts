import { Router } from "express";
import { RetailSalesController } from "../controllers/RetailSalesController.js";
import { RetailSalesService } from "../services/RetailSalesService.js";

const router = Router();
const controller = new RetailSalesController(new RetailSalesService());

router.get("/sales", controller.listSales);
router.post("/sales", controller.createSale);
router.get("/sales/:saleId", controller.getSaleById);

export { router as retailSalesRoutes };
