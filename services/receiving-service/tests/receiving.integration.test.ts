import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../app";

describe("Receiving Service Integration", () => {
  it("should return health check status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "UP",
      service: "receiving-service",
    });
  });

  it("should validate incoming payload format and fail on missing fields", async () => {
    const response = await request(app).post("/api/receiving").send({
      receivedBy: "John Doe",
      items: [],
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
