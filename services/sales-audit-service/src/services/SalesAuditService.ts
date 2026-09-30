import { BadRequestError, NotFoundError } from "../types.js";
import { SalesAuditRepository } from "../repositories/SalesAuditRepository.js";

function decimalSum(a: string | number, b: string | number) {
  const total = Number(a) + Number(b);
  return total.toFixed(2);
}

export class SalesAuditService {
  constructor(
    private readonly salesAuditRepository: SalesAuditRepository = new SalesAuditRepository(),
  ) {}

  async createReconciliation(input: {
    registerId: string;
    storeId: string;
    expectedTotal: string;
    physicalTotal: string;
    variance: string;
    managerName?: string | null;
    explanation?: string | null;
  }) {
    if (!input.registerId || !input.storeId) {
      throw new BadRequestError(
        "Register reconciliation requires registerId and storeId.",
      );
    }

    return await this.salesAuditRepository.createReconciliation(input);
  }

  async recordSale(input: {
    registerId: string;
    storeId: string;
    total: string | number;
    managerName?: string | null;
    explanation?: string | null;
  }) {
    if (!input.registerId || !input.storeId) {
      throw new BadRequestError(
        "Sale reconciliation requires registerId and storeId.",
      );
    }

    const existing = await this.salesAuditRepository.findByRegisterId(
      input.registerId,
    );
    const current = existing[0];

    const nextExpectedTotal = decimalSum(
      current?.expectedTotal ?? "0.00",
      input.total,
    );
    const nextPhysicalTotal = current?.physicalTotal ?? "0.00";
    const nextVariance = decimalSum(
      nextPhysicalTotal,
      -Number(nextExpectedTotal),
    );

    return await this.salesAuditRepository.upsertReconciliation({
      registerId: input.registerId,
      storeId: input.storeId,
      expectedTotal: nextExpectedTotal,
      physicalTotal: nextPhysicalTotal,
      variance: nextVariance,
      status: current?.status ?? "OPEN",
      managerName: input.managerName ?? current?.managerName ?? null,
      explanation: input.explanation ?? current?.explanation ?? null,
    });
  }

  async getReconciliation(registerId: string) {
    const results =
      await this.salesAuditRepository.findByRegisterId(registerId);
    if (!results[0]) {
      throw new NotFoundError(`No reconciliation for register ${registerId}.`);
    }
    return results[0];
  }

  async listReconciliations() {
    return await this.salesAuditRepository.list();
  }
}
