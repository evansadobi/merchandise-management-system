const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COST_PATTERN = /^\d+(\.\d{1,2})?$/;

export function validateUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

export function validateEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  return typeof phone === "string" && PHONE_REGEX.test(phone.trim());
}

export function validateCost(cost: string | number): boolean {
  const stringCost = typeof cost === "string" ? cost.trim() : String(cost);
  return COST_PATTERN.test(stringCost);
}
