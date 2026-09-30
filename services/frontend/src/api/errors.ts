export class ApiError extends Error {
  status: number;
  service: string;
  details?: unknown;

  constructor(
    service: string,
    status: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.service = service;
    this.details = details;
  }
}
