import { fetchFinancialAssetsBalanceSheet } from '../../services/financialAssetsBalanceSheetService.js';

/* ------------------------------------------------------------------ */
/*  Code generator:  n → 'FABS001_NNNNN'                              */
/* ------------------------------------------------------------------ */
const cid = (n) => `FABS001_${String(n).padStart(5, '0')}`;

/**
 * Field definitions for FASDBSFABS001 (163 fields).
 *   calc.sql       → read a direct value from the raw SQL row
 *   calc.add/sub   → sum/subtract other fields (by their numeric index `n`)
 *   (no calc)      → 0
 *
 * Forward references are resolved by the memoised resolver in buildFields().
 */
const FIELD_DEFS = [
  /* =================== 1. ASSETS =================== */
  { n: 1,   d: 'Financial Assets (Sum 2 -6)',                          calc: { add: [2, 5, 17, 41, 61] } },
  { n: 2,   d: 'CASH ON HAND (2.1+2.2)',                              calc: { sql: 'CASH_ON_HAND' } },
  { n: 3,   d: 'Foreign currency',                                     calc: { sql: 'FOREIGN_CURRENCY' } },
  { n: 4,   d: 'Local currency',                                       calc: { sql: 'LOCAL_CURRENCY' } },

  /* 3. Deposits with banks */
  { n: 5,   d: 'DEPOSITS WITH BANKS (3.1+3.2+3.3)',                    calc: { sql: 'DEPOSIT_WITH_BANKS' } },
  { n: 6,   d: 'Deposits with NBE(sum 3.1.1-3.1.4)',                   calc: { sql: 'DEPOSITS_WITH_NBE' } },
  { n: 7,   d: 'Reserve account',                                      calc: { sql: 'RESERVE_ACCOUNT' } },
  { n: 8,   d: 'Payment and settlement  account',                      calc: { sql: 'PAYMENT_AND_SETTLEMENT' } },
  { n: 9,   d: 'Cash issue account',                                   calc: { sql: 'ISSUE_ACCOUNT_WITH_NBE' } },
  { n: 10,  d: 'Other' },
  { n: 11,  d: 'Domestic banks deposits (3.2.1+3.2.2)',                calc: { sql: 'DOMESTIC_BANKS_DEPOSITS' } },
  { n: 12,  d: 'Interest bearing',                                     calc: { sql: 'DOMESTIC_BANKS_DEPOSITS' } },
  { n: 13,  d: 'Non-interest bearing' },
  { n: 14,  d: 'Foreign banks deposits(3.3.1+3.3.2)',                  calc: { sql: 'FOREIGN_BANKS_DEPOSITS' } },
  { n: 15,  d: 'Interest bearing',                                     calc: { sql: 'FOREIGN_BANKS_DEPOSITS' } },
  { n: 16,  d: 'Non-interest bearing' },

  /* 4. Investments */
  { n: 17,  d: 'INVESTMENTS (4.1+4.2)',                                calc: { sql: 'INVESTMENT' } },
  { n: 18,  d: 'Short-term Investments(sum 4.1.1-4.1.3)',              calc: { add: [19, 20, 21, 22] } },
  { n: 19,  d: 'Treasury bills' },
  { n: 20,  d: 'Discount on short-term securities' },
  { n: 21,  d: 'OMO' },
  { n: 22,  d: 'Other short-term securities',                          calc: { sql: 'OTHER_SHORT_TERM_SECURITIES' } },
  { n: 23,  d: 'Long-term Investments (4.2.1 + 4.2.2)',                calc: { add: [24, 34] } },
  { n: 24,  d: 'Securities (sum 4.2.1.1 - 4.2.1.5)',                   calc: { add: [25, 26, 27, 28, 32, 33] } },
  { n: 25,  d: 'NBE bills' },
  { n: 26,  d: 'Treasury bond' },
  { n: 27,  d: 'DBE Bonds',                                            calc: { sql: 'DBE_BOND' } },
  { n: 28,  d: 'Bonds (sum 4.2.1.3.1-4.2.1.3.3)',                      calc: { add: [29, 30, 31] } },
  { n: 29,  d: 'Federal government',                                   calc: { sql: 'FEDERAL_GOVERNMENT_BOND' } },
  { n: 30,  d: 'Regional government' },
  { n: 31,  d: 'Corporate Bonds' },
  { n: 32,  d: 'Discount on other long-term securities' },
  { n: 33,  d: 'Other long-term securities' },
  { n: 34,  d: 'Equity participation (4.2.2.1 + 4.2.2.2)',             calc: { add: [35, 40] } },
  { n: 35,  d: 'Local (sum 4.2.2.1.1-4.2.2.1.4)',                      calc: { add: [36, 37, 38, 39] } },
  { n: 36,  d: 'In Affiliated institutions' },
  { n: 37,  d: 'In banks' },
  { n: 38,  d: 'In non bank financial institutions',                   calc: { sql: 'IN_NON_BANK_FI' } },
  { n: 39,  d: 'In other sectors' },
  { n: 40,  d: 'Foreign' },

  /* 5. Loans and advances */
  { n: 41,  d: 'LOANS AND ADVANCES (NET)(5.1-5.2)',                    calc: { add: [42], sub: [58] } },
  { n: 42,  d: 'Total Loans & Advances (5.1.1+5.1.2+5.1.3)',           calc: { sql: 'TOTAL_LOAN_ADVANCES' } },
  { n: 43,  d: 'Inter bank loans (5.1.1.1+5.1.1.2)' },
  { n: 44,  d: 'Commercial banks loan' },
  { n: 45,  d: 'Interbank money market' },
  { n: 46,  d: 'Other commercial banks loan' },
  { n: 47,  d: 'Development bank' },
  { n: 48,  d: 'Non-inter bank loans (sum 5.1.2.1-5.1.2.8)',           calc: { sql: 'NON_INTER_BANK_LOAN' } },
  { n: 49,  d: 'NBE' },
  { n: 50,  d: 'Federal government' },
  { n: 51,  d: 'Regional government' },
  { n: 52,  d: 'Public entreprises' },
  { n: 53,  d: 'Cooperatives' },
  { n: 54,  d: 'Private sector' },
  { n: 55,  d: 'Loans & advances in litigation' },
  { n: 56,  d: 'Others' },
  { n: 57,  d: 'Non bank Financial Institution' },
  { n: 58,  d: 'Provisions for loans and advances (5.2.1+5.2.2)',      calc: { sql: 'PROVISION_LOAN_ADVANCE' } },
  { n: 59,  d: 'Provisions for performing loans and advances' },
  { n: 60,  d: 'Specific provisions for loan losses' },

  /* 6. Other financial assets */
  { n: 61,  d: 'OTHER FINANCIAL ASSETS (Net)  [(sum 6.1-6.4) -(6.5)]', calc: { add: [62, 63, 64, 65, 68], sub: [71] } },
  { n: 62,  d: 'Sundry debtors',                                       calc: { sql: 'SUNDRY_DEBTORS' } },
  { n: 63,  d: 'Suspense accounts' },
  { n: 64,  d: 'Accounts Receviable' },
  { n: 65,  d: 'Un-cleared effects (6.3.1+6.3.2)',                     calc: { sql: 'UNCLEARED_EFFECT' } },
  { n: 66,  d: 'Foreign',                                              calc: { sql: 'FOREIGN_UNCLEARED' } },
  { n: 67,  d: 'Local',                                                calc: { sql: 'LOCAL_UNCLEARED' } },
  { n: 68,  d: 'Other accounts(6.4.1+6.4.2)',                          calc: { add: [69, 70] } },
  { n: 69,  d: "Customers' liabilities for L/C & acceptances as per contra" },
  { n: 70,  d: 'Other' },
  { n: 71,  d: 'Provisions for other financial assets' },

  /* 7-11. Non-financial assets */
  { n: 72,  d: 'NON-FINANCIAL ASSETS (Sum 8-11)',                      calc: { sql: 'NON_FINANCIAL_ASSET' } },
  { n: 73,  d: 'FIXED ASSETS (Net)  (8.1– 8.2)',                       calc: { add: [74], sub: [80] } },
  { n: 74,  d: 'Gross fixed assets (sum 8.1.1- 8.1.5)',                calc: { sql: 'GROSS_FIXED_ASSET' } },
  { n: 75,  d: 'Premises',                                             calc: { sql: 'PREMISES' } },
  { n: 76,  d: 'Vehicles',                                             calc: { sql: 'VEHICLES' } },
  { n: 77,  d: 'Furniture & fittings',                                 calc: { sql: 'FURNITURE_FITTINGS' } },
  { n: 78,  d: 'Office & other equipments',                            calc: { sql: 'OFFICE_EQUIPMENTS' } },
  { n: 79,  d: 'Other properties',                                     calc: { sql: 'OTHER_PROPERTIES' } },
  { n: 80,  d: 'Accumulated depreciation',                             calc: { sql: 'ACCUMULATED_DEPRECIATION' } },
  { n: 81,  d: 'Suplies stock Accounts',                               calc: { sql: 'SUPPLIES_STOCK' } },
  { n: 82,  d: 'OTHER NON-FINANCIAL ASSETS' },
  { n: 83,  d: 'INTANGIBLE  ASSET(Net) [(11.1+11.2)-(11.3)]',          calc: { add: [84, 85], sub: [86] } },
  { n: 84,  d: 'Software',                                             calc: { sql: 'SOFTWARE' } },
  { n: 85,  d: 'Other' },
  { n: 86,  d: 'Accumulated Amortization',                             calc: { sql: 'ACCUMULATED_AMORTIZATION' } },
  { n: 87,  d: 'TOTAL ASSETS (1+7)',                                   calc: { add: [1, 72] } },

  /* =================== LIABILITIES =================== */
  { n: 88,  d: 'LIABILITIES (sum 14-20)',                              calc: { sql: 'LIABILITIES' } },
  { n: 89,  d: 'TOTAL DEPOSITS (sum 14.1-14.3)',                       calc: { sql: 'TOTAL_DEPOSITS' } },
  { n: 90,  d: 'Demand/current deposits (sum 14.1.1-14.1.14)',         calc: { sql: 'DEMAND_CURRENT_DEPOSITS' } },
  { n: 91,  d: 'Federal  government' },
  { n: 92,  d: 'Regional government' },
  { n: 93,  d: 'Public enterprises',                                   calc: { sql: 'PUBLIC_ENTERPRISE_DEMAND' } },
  { n: 94,  d: 'Domestic banks',                                       calc: { sql: 'DOMESTIC_BANKS_DEMAND' } },
  { n: 95,  d: 'Non-bank financial institutuions' },
  { n: 96,  d: 'Pension fund' },
  { n: 97,  d: 'Cooperatives & associations',                          calc: { sql: 'COOPERATIVES_ASSOCIATIONS_DEMAND' } },
  { n: 98,  d: 'Private   sector',                                     calc: { sql: 'PRIVATE_SECTOR_DEMAND' } },
  { n: 99,  d: 'Foreign banks' },
  { n: 100, d: 'N/R - foreign currency account',                       calc: { sql: 'NR_FCY_ACCOUNT' } },
  { n: 101, d: 'N/R - transferable birr account' },
  { n: 102, d: 'N/ R - non-transferable birr a/c',                     calc: { sql: 'NR_NON_TRANSFERABLE_BIRR' } },
  { n: 103, d: 'Resident foreign currency  a/c' },
  { n: 104, d: 'FCY retention a/c "A" & "B"',                          calc: { sql: 'FCY_RETENTION_ACCOUNT' } },
  { n: 105, d: 'Savings deposits (sum 14.2.1-14.2.7)',                 calc: { sql: 'SAVING_DEPOSIT' } },
  { n: 106, d: 'Federal Government' },
  { n: 107, d: 'Regional Government' },
  { n: 108, d: 'Public enterprises',                                   calc: { sql: 'SAVING_PUBLIC_ENTERPRISE' } },
  { n: 109, d: 'Domestic banks',                                       calc: { sql: 'SAVING_OTHER_COMMERCIAL_BANKS' } },
  { n: 110, d: 'Interbank money market' },
  { n: 111, d: 'Other commercial banks' },
  { n: 112, d: 'Non-bank financial institutions' },
  { n: 113, d: 'Pension fund',                                         calc: { sql: 'PENSION_FUND' } },
  { n: 114, d: 'Cooperatives & associations',                          calc: { sql: 'SAVING_COOPERATIVES' } },
  { n: 115, d: 'Private sector',                                       calc: { sql: 'SAVING_PRIVATE' } },
  { n: 116, d: 'Time/fixed (sum 14.3.1-14.3.7)',                       calc: { sql: 'TIME_FIXED' } },
  { n: 117, d: 'Government' },
  { n: 118, d: 'Public enterprises',                                   calc: { sql: 'TIME_PUBLIC_ENTERPRISE' } },
  { n: 119, d: 'Domestic banks',                                       calc: { sql: 'TIME_DOMESTIC_BANKS' } },
  { n: 120, d: 'Non-bank financial institutions' },
  { n: 121, d: 'Pension fund' },
  { n: 122, d: 'Cooperatives & associations',                          calc: { sql: 'TIME_COOPERATIVES' } },
  { n: 123, d: 'Private  sector',                                      calc: { sql: 'TIME_PRIVATE' } },

  /* Borrowings */
  { n: 124, d: 'BORROWINGS (15.1+15.2)',                               calc: { sql: 'BORROWINGS' } },
  { n: 125, d: 'Local (sum 15.1.1-15.1.3)',                            calc: { sql: 'LOCAL_BORROWINGS' } },
  { n: 126, d: 'Short term (sum 15.1.1.1-15.1.1.3)' },
  { n: 127, d: 'NBE' },
  { n: 128, d: 'Banks' },
  { n: 129, d: 'Non bank' },
  { n: 130, d: 'Medium term (sum 15.1.2.1-15.1.2.3)' },
  { n: 131, d: 'NBE' },
  { n: 132, d: 'Banks' },
  { n: 133, d: 'Non bank' },
  { n: 134, d: 'Long term (sum 15.1.3.1-15.1.3.3)',                    calc: { sql: 'LONG_TERM_BORROWINGS' } },
  { n: 135, d: 'NBE' },
  { n: 136, d: 'Banks',                                                calc: { sql: 'BANKS_BORROWINGS' } },
  { n: 137, d: 'Non bank' },
  { n: 138, d: 'Foreign borrowings(sum 15.2.1-15.2.3)' },
  { n: 139, d: 'Short term' },
  { n: 140, d: 'Medium term' },
  { n: 141, d: 'Long term' },

  /* Debt / creditors / other */
  { n: 142, d: 'DEBT SECURITIES ISSUED' },
  { n: 143, d: 'State dividend payable' },
  { n: 144, d: 'SUNDRY CREDITORS',                                     calc: { sql: 'SUNDRY_CREDITORS' } },
  { n: 145, d: 'Provision for taxation & other',                       calc: { sql: 'PROVISION_TAXATION' } },
  { n: 146, d: 'OTHER ACCOUNTS (sum 20.1-20.3)',                       calc: { sql: 'OTHER_ACCOUNT' } },
  { n: 147, d: 'L/C margin held',                                      calc: { sql: 'LC_MARGIN_HELD' } },
  { n: 148, d: "Bank's liabilities for L/C & acceptances as per  contra" },
  { n: 149, d: 'Others',                                               calc: { sql: 'OTHER_ACCOUNTS_OTHERS' } },

  /* Capital */
  { n: 150, d: 'CAPITAL & RESER. A/C (sum 21.1-21.5)',                 calc: { sql: 'CAPITAL_RESERVE' } },
  { n: 151, d: 'Paid up capital',                                      calc: { sql: 'PAIDUP_CAPITAL' } },
  { n: 152, d: 'Shares premium' },
  { n: 153, d: 'Legal Reserve',                                        calc: { sql: 'LEGAL_RESERVE' } },
  { n: 154, d: 'General reserves' },
  { n: 155, d: 'Retained Earnings' },
  { n: 156, d: 'Provisional profit/loss A/C',                          calc: { sql: 'PROVISIONAL_PL' } },
  { n: 157, d: 'Net Worth (21+21.6)',                                  calc: { sql: 'NET_WORTH' } },
  { n: 158, d: 'TOTAL LIABILITIES AND NET WORTH (=13+22)',             calc: { sql: 'TOTAL_LIABILITIES_NET_WORTH' } },

  /* Extra / extended fields */
  { n: 159, d: 'Trust fund client' },
  { n: 160, d: 'Accumulated Depreciation - Right of use assets' },
  { n: 161, d: 'Staff Loan Contra Account' },
  { n: 162, d: 'Total Contra Asset Account' },
  { n: 163, d: 'Statutory reserve for Impair' },
];

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default {
  reportKey: 'FASDBSFABS001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchFinancialAssetsBalanceSheet,

  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const raw = rawData || {};

    const defByN = new Map();
    FIELD_DEFS.forEach(def => defByN.set(def.n, def));

    const resolved   = {};
    const inProgress = new Set();

    const resolve = (n) => {
      if (Object.prototype.hasOwnProperty.call(resolved, n)) return resolved[n];
      if (inProgress.has(n)) return 0;

      const def = defByN.get(n);
      if (!def) return 0;

      inProgress.add(n);

      let val = 0;
      if (def.calc && def.calc.sql) {
        val = toNum(raw[def.calc.sql]);
      } else if (def.calc && (def.calc.add || def.calc.sub)) {
        let s = 0;
        for (const c of (def.calc.add || [])) s += resolve(c);
        for (const c of (def.calc.sub || [])) s -= resolve(c);
        val = s;
      } else {
        val = 0;
      }

      inProgress.delete(n);
      resolved[n] = val;
      return val;
    };

    // Pre-compute every field (recursively resolves dependencies)
    FIELD_DEFS.forEach(def => resolve(def.n));

    // Return in original order → ReturnItemsList stays ordered
    return FIELD_DEFS.map(def => ({
      code: cid(def.n),
      description: def.d,
      source: 'calculated',
      calculation: () => resolved[def.n],
    }));
  },
};