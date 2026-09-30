import { BadRequestError, NotFoundError } from "../types.js";
import { FinancialsRepository } from "../repositories/FinancialsRepository.js";

export class FinancialsService {
  constructor(
    private readonly financialsRepository: FinancialsRepository = new FinancialsRepository(),
  ) {}

  async listLedgers() {
    return await this.financialsRepository.listLedgers();
  }

  async getLedgerById(ledgerId: string) {
    const rows = await this.financialsRepository.getLedgerById(ledgerId);
    if (!rows[0]) {
      throw new NotFoundError(`Ledger ${ledgerId} was not found.`);
    }
    return rows[0];
  }

  async ensureLedger(
    ledgerId: string,
    name: string,
    type: string,
    currency = "KES",
  ) {
    const existing = await this.financialsRepository.getLedgerById(ledgerId);
    if (existing[0]) {
      return existing[0];
    }

    const created = await this.financialsRepository.createLedger({
      ledgerId,
      name,
      type,
      currency,
      balance: "0.00",
    });

    if (!created) {
      throw new BadRequestError(`Unable to create ledger ${ledgerId}.`);
    }

    return created;
  }

  async createLedgerEntry(input: {
    ledgerId: string;
    entryType: string;
    amount: string;
    currency: string;
    description: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    if (
      !input.ledgerId ||
      !input.entryType ||
      !input.amount ||
      !input.currency
    ) {
      throw new BadRequestError("Ledger entry is missing required values.");
    }

    const normalizedEntryType = input.entryType.toUpperCase();
    if (!/^(DEBIT|CREDIT)$/.test(normalizedEntryType)) {
      throw new BadRequestError("entryType must be DEBIT or CREDIT.");
    }

    const ledger = await this.getLedgerById(input.ledgerId);
    if (!ledger) {
      throw new NotFoundError(`Ledger ${input.ledgerId} was not found.`);
    }

    const record = await this.financialsRepository.createLedgerEntry({
      ...input,
      entryType: normalizedEntryType,
    });

    if (!record) {
      throw new BadRequestError("Unable to create ledger entry.");
    }

    await this.financialsRepository.updateLedgerBalance(
      input.ledgerId,
      input.amount,
      normalizedEntryType as "DEBIT" | "CREDIT",
    );

    return record;
  }
}
