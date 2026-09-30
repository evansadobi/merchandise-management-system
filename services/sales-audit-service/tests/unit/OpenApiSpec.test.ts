import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

describe("Sales Audit OpenAPI spec", () => {
  it("includes the reconciliation endpoints and event contract", () => {
    const spec = YAML.parse(
      readFileSync(join(process.cwd(), "openapi.yaml"), "utf8"),
    );

    expect(
      spec.paths["/api/sales-audit/registers/{registerId}/reconciliation"],
    ).toBeDefined();
    expect(spec.paths["/api/sales-audit/registers"]).toBeDefined();
    expect(spec.components.schemas.DayClosedEvent).toBeDefined();
    expect(spec["x-events"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "DayClosed" })]),
    );
  });
});
