import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { VendorController } from "../../src/controllers/VendorController.js";
import { createMockUniqueViolationError } from "../helpers/mockDb.js";

vi.mock("../../src/repositories/VendorRepository.js", () => {
  return {
    VendorRepository: vi.fn().mockImplementation(function () {
      return {
        findAll: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      };
    }),
  };
});

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("VendorController", () => {
  let controller: VendorController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new VendorController();
  });

  describe("getVendorById", () => {
    it("returns 400 for a malformed UUID instead of hitting the repository", async () => {
      const req = { params: { id: "not-a-uuid" } } as unknown as Request;
      const res = mockRes();

      await controller.getVendorById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid vendor ID format",
      });
      expect(controller["vendorRepo"].findById).not.toHaveBeenCalled();
    });

    it("returns 404 when a validly-formatted UUID has no matching vendor", async () => {
      const validUuid = "4eb2b9f7-c20b-4238-a985-0d277130288b";
      const req = { params: { id: validUuid } } as unknown as Request;
      const res = mockRes();

      vi.mocked(controller["vendorRepo"].findById).mockResolvedValue(null);

      await controller.getVendorById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Vendor not found" });
    });

    it("returns 200 with the vendor when found", async () => {
      const validUuid = "4eb2b9f7-c20b-4238-a985-0d277130288b";
      const req = { params: { id: validUuid } } as unknown as Request;
      const res = mockRes();
      const vendor = {
        id: validUuid,
        name: "Acme Supplies Ltd",
        contactEmail: "sales@acme.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
        status: "APPROVED" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(controller["vendorRepo"].findById).mockResolvedValue(vendor);

      await controller.getVendorById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(vendor);
    });
  });

  describe("createVendor", () => {
    const validBody = {
      name: "Acme Supplies Ltd",
      contactEmail: "sales@acme.com",
      contactPhone: "+254712345678",
      paymentTerms: "Net 30",
      leadTimeDays: 5,
    };

    it("returns 400 when name is missing", async () => {
      const req = { body: { ...validBody, name: "" } } as Request;
      const res = mockRes();

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Vendor name is required",
      });
    });

    it("returns 400 for an invalid email format", async () => {
      const req = {
        body: { ...validBody, contactEmail: "not-an-email" },
      } as Request;
      const res = mockRes();

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid contact email",
      });
    });

    it("returns 400 when contactPhone is missing (required, not optional)", async () => {
      const { contactPhone, ...bodyWithoutPhone } = validBody;
      const req = { body: bodyWithoutPhone } as Request;
      const res = mockRes();

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Contact phone is required",
      });
    });

    it("returns 400 for an invalid phone format", async () => {
      const req = { body: { ...validBody, contactPhone: "abc" } } as Request;
      const res = mockRes();

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid contact phone format",
      });
    });

    it("returns 400 when leadTimeDays is negative", async () => {
      const req = { body: { ...validBody, leadTimeDays: -1 } } as Request;
      const res = mockRes();

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Lead time must be a non-negative integer",
      });
    });

    it("returns 201 and creates the vendor when the body is valid", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();
      const created = {
        id: "new-id",
        ...validBody,
        status: "APPROVED" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(controller["vendorRepo"].create).mockResolvedValue(created);

      await controller.createVendor(req, res);

      expect(controller["vendorRepo"].create).toHaveBeenCalledWith(validBody);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("returns 409 (not 500) when the repository throws a Drizzle-wrapped unique violation", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      const drizzleWrappedError = createMockUniqueViolationError(
        "vendors_contact_email_unique",
      );
      vi.mocked(controller["vendorRepo"].create).mockRejectedValue(
        drizzleWrappedError,
      );

      await controller.createVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "A vendor with this email already exists",
      });
      expect(res.status).not.toHaveBeenCalledWith(500);
    });
  });
});
