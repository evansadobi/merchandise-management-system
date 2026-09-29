import type { Request, Response, NextFunction } from "express";
import { WarehouseService } from "../services/WarehouseService.js";

export class WarehouseController {
  constructor(
    private warehouseService: WarehouseService = new WarehouseService(),
  ) {}

  listZones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId } = req.query;
      const zones = await this.warehouseService.listZones(
        (warehouseId as string) || "MAIN_WAREHOUSE",
      );
      return res.status(200).json(zones);
    } catch (error) {
      next(error);
    }
  };

  createZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = await this.warehouseService.createZone(req.body);
      return res.status(201).json(zone);
    } catch (error) {
      next(error);
    }
  };

  listAislesByZone = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const aisles = await this.warehouseService.listAislesByZone(id);
      return res.status(200).json(aisles);
    } catch (error) {
      next(error);
    }
  };

  createAisle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const aisle = await this.warehouseService.createAisle(req.body);
      return res.status(201).json(aisle);
    } catch (error) {
      next(error);
    }
  };

  createShelf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shelf = await this.warehouseService.createShelf(req.body);
      return res.status(201).json(shelf);
    } catch (error) {
      next(error);
    }
  };

  createBin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bin = await this.warehouseService.createBin(req.body);
      return res.status(201).json(bin);
    } catch (error) {
      next(error);
    }
  };

  getBinById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const bin = await this.warehouseService.getBinById(id);
      return res.status(200).json(bin);
    } catch (error) {
      next(error);
    }
  };

  findAvailableBins = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { zone, warehouseId, minCapacity } = req.query;
      const bins = await this.warehouseService.findAvailableBins({
        warehouseId: (warehouseId as string) || "MAIN_WAREHOUSE",
        zone: zone as "FAST" | "MID" | "BULK" | undefined,
        minCapacity: Number(minCapacity),
      });
      return res.status(200).json(bins);
    } catch (error) {
      next(error);
    }
  };

  getUtilization = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId } = req.query;
      const report = await this.warehouseService.getUtilizationReport(
        (warehouseId as string) || "MAIN_WAREHOUSE",
      );
      return res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  };

  listPutawayTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { status, assignedTo } = req.query;
      const tasks = await this.warehouseService.listPutawayTasks({
        status: status as
          | "PENDING"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED"
          | undefined,
        assignedTo: assignedTo as string | undefined,
      });
      return res.status(200).json(tasks);
    } catch (error) {
      next(error);
    }
  };

  startPutawayTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const { assignedTo } = req.body;
      const task = await this.warehouseService.startPutawayTask(id, assignedTo);
      return res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  };

  completePutawayTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const { actualBinId } = req.body;
      const task = await this.warehouseService.completePutawayTask(
        id,
        actualBinId,
      );
      return res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  };

  suggestBin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.warehouseService.suggestBin(req.body);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
  listPickingTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { status, assignedTo } = req.query;
      const tasks = await this.warehouseService.listPickingTasks({
        status: status as
          | "PENDING"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED"
          | undefined,
        assignedTo: assignedTo as string | undefined,
      });
      return res.status(200).json(tasks);
    } catch (error) {
      next(error);
    }
  };

  startPickingTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const { assignedTo } = req.body;
      const task = await this.warehouseService.startPickingTask(id, assignedTo);
      return res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  };

  completePickingTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const task = await this.warehouseService.completePickingTask(id);
      return res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  };

  listTransfers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      const transfers = await this.warehouseService.listTransfers({
        status: status as string | undefined,
      });
      return res.status(200).json(transfers);
    } catch (error) {
      next(error);
    }
  };

  createTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await this.warehouseService.createTransfer(req.body);
      return res.status(201).json(transfer);
    } catch (error) {
      next(error);
    }
  };

  getTransferById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const transfer = await this.warehouseService.getTransferById(id);
      return res.status(200).json(transfer);
    } catch (error) {
      next(error);
    }
  };

  completeTransfer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params as { id: string };
      const transfer = await this.warehouseService.completeTransfer(id);
      return res.status(200).json(transfer);
    } catch (error) {
      next(error);
    }
  };
}
