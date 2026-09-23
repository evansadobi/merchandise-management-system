export enum VendorStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  SUSPENDED = "SUSPENDED",
  ARCHIVED = "ARCHIVED",
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: VendorStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateVendorDTO {
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
}
