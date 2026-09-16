import { vi } from "vitest";

export function createMockDb() {
  const db = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  Object.values(db).forEach((fn) => fn.mockReturnValue(db));

  return db;
}

export function createMockUniqueViolationError(constraintName: string) {
  const cause = {
    code: "23505",
    constraint: constraintName,
    detail: `Key already exists.`,
  };

  const error = new Error("Failed query") as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}
