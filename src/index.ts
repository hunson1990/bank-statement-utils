export type DateFormat =
  | 'YYYY-MM-DD'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY';

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  currency?: string;
  reference?: string;
  raw?: Record<string, unknown>;
}

export interface FieldMapping {
  date: string | string[];
  description: string | string[];
  amount?: string | string[];
  debit?: string | string[];
  credit?: string | string[];
  balance?: string | string[];
  currency?: string | string[];
  reference?: string | string[];
}

export interface NormalizeOptions {
  mapping?: Partial<FieldMapping>;
  dateFormat?: DateFormat;
  defaultCurrency?: string;
  includeRaw?: boolean;
}

export interface BalanceIssue {
  index: number;
  expected: number;
  actual: number;
  difference: number;
}

const defaultMapping: FieldMapping = {
  date: ['date', 'transaction date', 'posting date', 'posted date', 'value date'],
  description: ['description', 'details', 'narrative', 'memo', 'transaction details'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'money out', 'paid out'],
  credit: ['credit', 'deposit', 'money in', 'paid in'],
  balance: ['balance', 'running balance', 'closing balance'],
  currency: ['currency', 'ccy'],
  reference: ['reference', 'reference number', 'transaction id'],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function candidates(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map(normalizeHeader);
}

function pick(row: Record<string, unknown>, names: string | string[] | undefined): unknown {
  const wanted = new Set(candidates(names));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key))) return value;
  }
  return undefined;
}

function mergeField(
  custom: string | string[] | undefined,
  fallback: string | string[],
): string[] {
  return [...candidates(custom), ...candidates(fallback)];
}

export function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const source = value.trim();
  const negative =
    /^\(.*\)$/.test(source) || /^-/.test(source) || /(?:\bDR\b|\bDEBIT\b)$/i.test(source);
  let cleaned = source
    .replace(/[()]/g, '')
    .replace(/(?:\bCR\b|\bDR\b|\bCREDIT\b|\bDEBIT\b)/gi, '')
    .replace(/[^\d.,+-]/g, '')
    .replace(/^[+-]/, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    cleaned = cleaned.replace(thousands, '').replace(decimal, '.');
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals === 2 ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return undefined;
  return negative ? -Math.abs(parsed) : parsed;
}

export function parseDate(value: unknown, format: DateFormat = 'YYYY-MM-DD'): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const match = value.trim().match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);
  if (!match) return undefined;
  const [, first, second, third] = match;
  let year: number;
  let month: number;
  let day: number;

  if (format === 'YYYY-MM-DD') {
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else if (format.startsWith('DD')) {
    day = Number(first);
    month = Number(second);
    year = Number(third);
  } else {
    month = Number(first);
    day = Number(second);
    year = Number(third);
  }
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return undefined;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function normalizeRow(
  row: Record<string, unknown>,
  options: NormalizeOptions = {},
): Transaction | undefined {
  const custom = options.mapping ?? {};
  const mapping: FieldMapping = {
    date: mergeField(custom.date, defaultMapping.date),
    description: mergeField(custom.description, defaultMapping.description),
    amount: mergeField(custom.amount, defaultMapping.amount!),
    debit: mergeField(custom.debit, defaultMapping.debit!),
    credit: mergeField(custom.credit, defaultMapping.credit!),
    balance: mergeField(custom.balance, defaultMapping.balance!),
    currency: mergeField(custom.currency, defaultMapping.currency!),
    reference: mergeField(custom.reference, defaultMapping.reference!),
  };

  const date = parseDate(pick(row, mapping.date), options.dateFormat);
  const descriptionValue = pick(row, mapping.description);
  const description = descriptionValue == null ? '' : String(descriptionValue).trim();
  let amount = parseAmount(pick(row, mapping.amount));

  if (amount === undefined) {
    const debit = parseAmount(pick(row, mapping.debit)) ?? 0;
    const credit = parseAmount(pick(row, mapping.credit)) ?? 0;
    amount = Math.abs(credit) - Math.abs(debit);
  }
  if (!date || !description || !Number.isFinite(amount)) return undefined;

  const balance = parseAmount(pick(row, mapping.balance));
  const currencyValue = pick(row, mapping.currency);
  const referenceValue = pick(row, mapping.reference);
  return {
    date,
    description,
    amount,
    ...(balance !== undefined ? { balance } : {}),
    ...(currencyValue || options.defaultCurrency
      ? { currency: String(currencyValue ?? options.defaultCurrency).trim().toUpperCase() }
      : {}),
    ...(referenceValue ? { reference: String(referenceValue).trim() } : {}),
    ...(options.includeRaw ? { raw: row } : {}),
  };
}

export function normalizeRows(
  rows: Array<Record<string, unknown>>,
  options: NormalizeOptions = {},
): Transaction[] {
  return rows.flatMap((row) => {
    const transaction = normalizeRow(row, options);
    return transaction ? [transaction] : [];
  });
}

export function validateRunningBalances(
  transactions: Transaction[],
  tolerance = 0.01,
): BalanceIssue[] {
  const issues: BalanceIssue[] = [];
  for (let index = 1; index < transactions.length; index += 1) {
    const previous = transactions[index - 1]?.balance;
    const current = transactions[index]?.balance;
    if (previous === undefined || current === undefined) continue;
    const expected = previous + transactions[index].amount;
    const difference = current - expected;
    if (Math.abs(difference) > tolerance) {
      issues.push({ index, expected, actual: current, difference });
    }
  }
  return issues;
}
