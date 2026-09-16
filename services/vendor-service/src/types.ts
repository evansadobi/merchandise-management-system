export interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: string;
  createdAt: Date;
}

export interface CreateVendorDTO {
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
}
