import { fetchKeyBalanceSheet } from '../../services/keyBalanceSheetService.js';

/* ------------------------------------------------------------------ */
const cid = (n) => `107_${String(n).padStart(5, '0')}`;

/**
 * Each entry maps a BSA code to a value that comes DIRECTLY from the SQL.
 * Oracle preserves the quoted mixed-case aliases ("Total Asset", etc.),
 * so the key we look up is exactly the alias string.
 */
const FIELD_DEFS = [
  { n: 1, d: 'Total assets',               sql: 'Total Asset' },
  { n: 2, d: 'Total loans and bonds',      sql: 'Loan and Bonds' },
  { n: 3, d: 'Of which bonds',             sql: 'Off which Bonds' },
  { n: 4, d: 'Demand/Current deposits',    sql: 'Demand and Current Deposit' },
  { n: 5, d: 'Saving deposits',            sql: 'Saving Deposit' },
  { n: 6, d: 'Time/Fixed deposits',        sql: 'Time/Fixed Deposit' },
  { n: 7, d: 'Total capital & reserves',   sql: 'Total Capital and Reserve' },
  { n: 8, d: 'Total deposits',             sql: 'Total Deposits' },
];

/* ------------------------------------------------------------------ */
function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Oracle sometimes returns aliases uppercased even for quoted identifiers,
 * depending on the driver version. This helper checks a few casings so we
 * never accidentally miss the value.
 */
function pick(row, alias) {
  if (row == null) return 0;
  if (alias in row) return toNum(row[alias]);
  const upper = alias.toUpperCase();
  if (upper in row) return toNum(row[upper]);
  // Case-insensitive match as last resort
  const target = alias.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === target) return toNum(row[k]);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'Key Balance SheetMK001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchKeyBalanceSheet,

  // Fixed template — always emit all 8 codes
  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const row = rawData || {};

    return FIELD_DEFS.map(def => ({
      code: cid(def.n),
      description: def.d,
      source: 'calculated',
      calculation: () => pick(row, def.sql),
    }));
  },
};