import { fetchMonthlyBalanceSheet } from '../../services/monthlyBalanceSheetService.js';

/* ------------------------------------------------------------------ */
const cid = (n) => `110_${String(n).padStart(5, '0')}`;

/**
 * Field definitions.
 *   calc.sql       → pull a direct value from the raw SQL row by alias
 *   calc.add/sub   → sum / subtract fieldMap values (using 110_xxxxx codes)
 *   (no calc)      → 0
 */
const FIELD_DEFS = [
  /* ---------- 1. Financial Assets ---------- */
  { n: 1,  d: 'Financial Assets (Sum 2 - 6)',  calc: { add: [2, 5, 17, 38, 56] } },
  { n: 2,  d: 'CASH ON HAND (2.1+2.2)',        calc: { sql: 'CASH_ON_HAND' } },
  { n: 3,  d: 'Foreign currency',              calc: { sql: 'FOREIGN_CURRENCY' } },
  { n: 4,  d: 'Local currency',                calc: { sql: 'LOCAL_CURRENCY' } },

  /* ---------- 3. Deposits with banks ---------- */
  { n: 5,  d: 'DEPOSITS WITH BANKS (3.1+3.2+3.3)', calc: { sql: 'DEPOSIT_WITH_BANKS' } },
  { n: 6,  d: 'Deposits with NBE',             calc: { sql: 'DEPOSITS_WITH_NBE' } },
  { n: 7,  d: 'Reserve account',               calc: { sql: 'RESERVE_ACCOUNT' } },
  { n: 8,  d: 'Payment and settlement account',calc: { sql: 'PAYMENT_AND_SETTLEMENT' } },
  { n: 9,  d: 'Cash issue account',            calc: { sql: 'ISSUE_ACCOUNT_WITH_NBE' } },
  { n: 10, d: 'Other (Deposits with NBE)',     /* 0 */ },
  { n: 11, d: 'Domestic banks deposits',       calc: { sql: 'DOMESTIC_BANKS_DEPOSITS' } },
  { n: 12, d: 'Interest bearing (domestic)',   calc: { sql: 'DOMESTIC_BANKS_DEPOSITS' } },
  { n: 13, d: 'Non-interest bearing (domestic)' /* 0 */ },
  { n: 14, d: 'Foreign banks deposits',        calc: { sql: 'FOREIGN_BANKS_DEPOSITS' } },
  { n: 15, d: 'Interest bearing (foreign)',    calc: { sql: 'FOREIGN_BANKS_DEPOSITS' } },
  { n: 16, d: 'Non-interest bearing (foreign)' /* 0 */ },

  /* ---------- 4. Investments ---------- */
  { n: 17, d: 'INVESTMENTS (4.1+4.2)',         calc: { sql: 'INVESTMENT' } },
  { n: 18, d: 'Short-term Investments',        calc: { sql: 'SHORT_TERM_INVESTMENTS' } },
  { n: 19, d: 'Treasury bills' /* 0 */ },
  { n: 20, d: 'Discount on short-term securities' /* 0 */ },
  { n: 21, d: 'Other short-term securities',   calc: { sql: 'OTHER_SHORT_TERM_SECURITIES' } },
  { n: 22, d: 'Securities',                    calc: { sql: 'SECURITIES' } },
  { n: 23, d: 'NBE bills' /* 0 */ },
  { n: 24, d: 'DBE Bonds',                     calc: { sql: 'DBE_BOND' } },
  { n: 25, d: 'Bonds',                         calc: { sql: 'BONDS' } },
  { n: 26, d: 'Federal government',            calc: { sql: 'FEDERAL_GOVERNMENT_BOND' } },
  { n: 27, d: 'Regional government' /* 0 */ },
  { n: 28, d: 'Corporate Bonds' /* 0 */ },
  { n: 29, d: 'Discount on other long-term securities' /* 0 */ },
  { n: 30, d: 'Other long-term securities' /* 0 */ },
  { n: 31, d: 'Equity participation',          calc: { sql: 'EQUITY_PARTICIPATION' } },
  { n: 32, d: 'Local (equity)',                calc: { sql: 'LOCAL_EQUITY' } },
  { n: 33, d: 'In Affiliated institutions' /* 0 */ },
  { n: 34, d: 'In banks' /* 0 */ },
  { n: 35, d: 'In non bank financial institutions', calc: { sql: 'IN_NON_BANK_FI' } },
  { n: 36, d: 'In other sectors' /* 0 */ },
  { n: 37, d: 'Foreign (equity)' /* 0 */ },

  /* ---------- 5. Loans and advances ---------- */
  { n: 38, d: 'LOANS AND ADVANCES (NET)',      calc: { add: [39], sub: [53] } },
  { n: 39, d: 'Total Loans & Advances',        calc: { sql: 'TOTAL_LOAN_ADVANCES' } },
  { n: 40, d: 'Inter bank loans' /* 0 */ },
  { n: 41, d: 'Commercial banks' /* 0 */ },
  { n: 42, d: 'Development bank' /* 0 */ },
  { n: 43, d: 'Non-inter bank loans',          calc: { sql: 'NON_INTER_BANK_LOAN' } },
  { n: 44, d: 'NBE (non-inter)' /* 0 */ },
  { n: 45, d: 'Federal government (loans)' /* 0 */ },
  { n: 46, d: 'Regional government (loans)' /* 0 */ },
  { n: 47, d: 'Public enterprises (loans)' /* 0 */ },
  { n: 48, d: 'Cooperatives (loans)' /* 0 */ },
  { n: 49, d: 'Private sector (loans)' /* 0 */ },
  { n: 50, d: 'Loans & advances in litigation' /* 0 */ },
  { n: 51, d: 'Others (loans)' /* 0 */ },
  { n: 52, d: 'Non bank Financial Institution (loans)' /* 0 */ },
  { n: 53, d: 'Provisions for loans and advances', calc: { sql: 'PROVISION_LOAN_ADVANCE' } },
  { n: 54, d: 'Provisions for performing loans' /* 0 */ },
  { n: 55, d: 'Specific provisions for loan losses' /* 0 */ },

  /* ---------- 6. Other financial assets ---------- */
  { n: 56, d: 'OTHER FINANCIAL ASSETS (Net)',  calc: { add: [57, 58, 59, 62], sub: [65] } },
  { n: 57, d: 'Sundry debtors',                calc: { sql: 'SUNDRY_DEBTORS' } },
  { n: 58, d: 'Suspense accounts' /* 0 */ },
  { n: 59, d: 'Un-cleared effects',            calc: { sql: 'UNCLEARED_EFFECT' } },
  { n: 60, d: 'Foreign (uncleared)',           calc: { sql: 'FOREIGN_UNCLEARED' } },
  { n: 61, d: 'Local (uncleared)',             calc: { sql: 'LOCAL_UNCLEARED' } },
  { n: 62, d: 'Other accounts',                calc: { add: [63, 64] } },
  { n: 63, d: "Customers' liabilities for L/C" /* 0 */ },
  { n: 64, d: 'Other (financial)' /* 0 */ },
  { n: 65, d: 'Provisions for other financial assets' /* 0 */ },

  /* ---------- 7-11. Non-financial assets ---------- */
  { n: 66, d: 'NON-FINANCIAL ASSETS',          calc: { sql: 'NON_FINANCIAL_ASSET' } },
  { n: 67, d: 'FIXED ASSETS (Net)',            calc: { sql: 'FIXED_ASSET_NET' } },
  { n: 68, d: 'Gross fixed assets',            calc: { sql: 'GROSS_FIXED_ASSET' } },
  { n: 69, d: 'Premises',                      calc: { sql: 'PREMISES' } },
  { n: 70, d: 'Vehicles',                      calc: { sql: 'VEHICLES' } },
  { n: 71, d: 'Furniture & fittings',          calc: { sql: 'FURNITURE_FITTINGS' } },
  { n: 72, d: 'Office & other equipments',     calc: { sql: 'OFFICE_EQUIPMENTS' } },
  { n: 73, d: 'Other properties',              calc: { sql: 'OTHER_PROPERTIES' } },
  { n: 74, d: 'Accumulated depreciation',      calc: { sql: 'ACCUMULATED_DEPRECIATION' } },
  { n: 75, d: 'SUPPLIES STOCK ACCOUNT',        calc: { sql: 'SUPPLIES_STOCK' } },
  { n: 76, d: 'OTHER NON-FINANCIAL ASSETS' /* 0 */ },
  { n: 77, d: 'INTANGIBLE ASSET (Net)',        calc: { sql: 'INTANGIBLE_ASSET' } },
  { n: 78, d: 'Software',                      calc: { sql: 'SOFTWARE' } },
  { n: 79, d: 'Other (intangible)' /* 0 */ },
  { n: 80, d: 'Accumulated Amortization' /* 0 */ },
  { n: 81, d: 'TOTAL ASSETS',                  calc: { add: [1, 66] } },

  /* ---------- Liabilities & Capital ---------- */
  { n: 82, d: 'LIABILITIES & CAPITAL' /* 0 */ },
  { n: 83, d: 'LIABILITIES',                   calc: { sql: 'LIABILITIES' } },
  { n: 84, d: 'TOTAL DEPOSITS',                calc: { sql: 'TOTAL_DEPOSITS' } },
  { n: 85, d: 'Demand/current deposits',       calc: { sql: 'DEMAND_CURRENT_DEPOSITS' } },
  { n: 86, d: 'Federal government (demand)' /* 0 */ },
  { n: 87, d: 'Regional government (demand)' /* 0 */ },
  { n: 88, d: 'Public enterprises (demand)',   calc: { sql: 'PUBLIC_ENTERPRISE_DEMAND' } },
  { n: 89, d: 'Non-bank financial institutions (demand)' /* 0 */ },
  { n: 90, d: 'Pension fund (demand)' /* 0 */ },
  { n: 91, d: 'Cooperatives & associations (demand)', calc: { sql: 'COOPERATIVES_ASSOCIATIONS_DEMAND' } },
  { n: 92, d: 'Private sector (demand)',       calc: { sql: 'PRIVATE_SECTOR_DEMAND' } },
  { n: 93, d: 'Foreign banks (demand)' /* 0 */ },
  { n: 94, d: 'N/R - foreign currency account', calc: { sql: 'NR_FCY_ACCOUNT' } },
  { n: 95, d: 'N/R - transferable birr account' /* 0 */ },
  { n: 96, d: 'N/R - non-transferable birr a/c', calc: { sql: 'NR_NON_TRANSFERABLE_BIRR' } },
  { n: 97, d: 'Resident foreign currency a/c' /* 0 */ },
  { n: 98, d: 'FCY retention a/c "A" & "B"',   calc: { sql: 'FCY_RETENTION_ACCOUNT' } },

  { n: 99,  d: 'Savings deposits',              calc: { sql: 'SAVING_DEPOSIT' } },
  { n: 100, d: 'Government (savings)' /* 0 */ },
  { n: 101, d: 'Public enterprises (savings)',  calc: { sql: 'SAVING_PUBLIC_ENTERPRISE' } },
  { n: 102, d: 'Domestic banks (savings)',      calc: { sql: 'SAVING_OTHER_COMMERCIAL_BANKS' } },
  { n: 103, d: 'Non-bank financial institutions (savings)' /* 0 */ },
  { n: 104, d: 'Pension fund (savings)',        calc: { sql: 'PENSION_FUND' } },
  { n: 105, d: 'Cooperatives & associations (savings)', calc: { sql: 'SAVING_COOPERATIVES' } },
  { n: 106, d: 'Private sector (savings)',      calc: { sql: 'SAVING_PRIVATE' } },

  { n: 107, d: 'Time/fixed',                    calc: { sql: 'TIME_FIXED' } },
  { n: 108, d: 'Government (time)' /* 0 */ },
  { n: 109, d: 'Public enterprises (time)',     calc: { sql: 'TIME_PUBLIC_ENTERPRISE' } },
  { n: 110, d: 'Domestic banks (time)',         calc: { sql: 'TIME_DOMESTIC_BANKS' } },
  { n: 111, d: 'Non-bank financial institutions (time)' /* 0 */ },
  { n: 112, d: 'Pension fund (time)' /* 0 */ },
  { n: 113, d: 'Cooperatives & associations (time)', calc: { sql: 'TIME_COOPERATIVES' } },
  { n: 114, d: 'Private sector (time)',         calc: { sql: 'TIME_PRIVATE' } },

  { n: 115, d: 'BORROWINGS',                    calc: { sql: 'BORROWINGS' } },
  { n: 116, d: 'Local (borrowings)',            calc: { sql: 'LOCAL_BORROWINGS' } },
  { n: 117, d: 'Short term' /* 0 */ },
  { n: 118, d: 'NBE (short)' /* 0 */ },
  { n: 119, d: 'Banks (short)' /* 0 */ },
  { n: 120, d: 'Non bank (short)' /* 0 */ },
  { n: 121, d: 'Medium term' /* 0 */ },
  { n: 122, d: 'NBE (medium)' /* 0 */ },
  { n: 123, d: 'Banks (medium)' /* 0 */ },
  { n: 124, d: 'Non bank (medium)' /* 0 */ },
  { n: 125, d: 'Long term (borrowings)',        calc: { sql: 'LONG_TERM_BORROWINGS' } },
  { n: 126, d: 'NBE (long)' /* 0 */ },
  { n: 127, d: 'Banks (long)',                  calc: { sql: 'BANKS_BORROWINGS' } },
  { n: 128, d: 'Non bank (long)' /* 0 */ },
  { n: 129, d: 'Foreign borrowings' /* 0 */ },
  { n: 130, d: 'Short term (foreign)' /* 0 */ },
  { n: 131, d: 'Medium term (foreign)' /* 0 */ },
  { n: 132, d: 'Long term (foreign)' /* 0 */ },

  { n: 133, d: 'DEBT SECURITIES ISSUED' /* 0 */ },
  { n: 134, d: 'State dividend payable' /* 0 */ },
  { n: 135, d: 'SUNDRY CREDITORS',              calc: { sql: 'SUNDRY_CREDITORS' } },
  { n: 136, d: 'Provision for taxation & other', calc: { sql: 'PROVISION_TAXATION' } },
  { n: 137, d: 'OTHER ACCOUNTS',                calc: { sql: 'OTHER_ACCOUNT' } },
  { n: 138, d: 'L/C margin held',               calc: { sql: 'LC_MARGIN_HELD' } },
  { n: 139, d: "Bank's liabilities for L/C" /* 0 */ },
  { n: 140, d: 'Others (other accounts)',       calc: { sql: 'OTHER_ACCOUNTS_OTHERS' } },

  { n: 141, d: 'CAPITAL & RESER. A/C',          calc: { sql: 'CAPITAL_RESERVE' } },
  { n: 142, d: 'Paid up capital',               calc: { sql: 'PAIDUP_CAPITAL' } },
  { n: 143, d: 'Legal reserves',                calc: { sql: 'LEGAL_RESERVE' } },
  { n: 144, d: 'General reserves' /* 0 */ },
  { n: 145, d: 'Retained Earnings' /* 0 */ },
  { n: 146, d: 'Provisional profit/loss A/C',   calc: { sql: 'PROVISIONAL_PL' } },
  { n: 147, d: 'Net Worth',                     calc: { sql: 'NET_WORTH' } },
  { n: 148, d: 'TOTAL LIABILITIES AND NET WORTH', calc: { sql: 'TOTAL_LIABILITIES_NET_WORTH' } },
  { n: 149, d: 'Long-term Investments',         calc: { sql: 'LONG_TERM_INVESTMENT' } },
  { n: 150, d: 'Domestic banks (equity)' /* 0 */ },
  { n: 151, d: 'Shares premium' /* 0 */ },
];

/* ------------------------------------------------------------------ */
function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'MB001MB001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchMonthlyBalanceSheet,

  // The balance sheet is a fixed template — always include all 151 codes
  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const raw = rawData || {};

    return FIELD_DEFS.map(def => {
      const code = cid(def.n);
      const description = def.d;

      let calculation;
      if (def.calc && def.calc.sql) {
        const key = def.calc.sql;
        calculation = () => toNum(raw[key]);
      } else if (def.calc && (def.calc.add || def.calc.sub)) {
        const adds = (def.calc.add || []).map(cid);
        const subs = (def.calc.sub || []).map(cid);
        calculation = (fieldMap) => {
          let s = 0;
          for (const c of adds) s += toNum(fieldMap[c]);
          for (const c of subs) s -= toNum(fieldMap[c]);
          return s;
        };
      } else {
        calculation = () => 0;
      }

      return {
        code,
        description,
        source: 'calculated',
        calculation,
      };
    });
  },
};