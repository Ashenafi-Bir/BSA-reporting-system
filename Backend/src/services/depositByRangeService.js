import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Map raw CBS region names (BRANCH_ADDR3) -> display names used in the JSON.
 * SNNP is intentionally null (dissolved into SWERS / CERS / SERS).
 */
const REGION_NAME_MAP = {
  'ADDIS ABABA': 'Addis Ababa',
  'ADDIS ABEBDA': 'Addis Ababa',
  'AFAR': 'Afar',
  'AMHARA': 'Amhara',
  'BENSHANGUL': 'Benishangul',
  'BENISHANGUL': 'Benishangul',
  'BENISHANGUL-GUMUZ': 'Benishangul',
  'BENISHANGUL GUMUZ': 'Benishangul',
  'DIRE DAWA': 'Dire Dawa',
  'DIREDAWA': 'Dire Dawa',
  'GAMBELLA': 'Gambela',
  'GAMBELA': 'Gambela',
  'HARARI': 'Harari',
  'OROMIA': 'Oromia',
  'OROMIYA': 'Oromia',
  'SOMALI': 'Somalia',
  'SOMALIA': 'Somalia',
  'TIGRAY': 'Tigray',
  'TIGRAY REGION': 'Tigray',
  'SIDAMA': 'Sidama',
  'SIDAMA REGION': 'Sidama',
  'SOUTH WEST ETHIOPIA': 'SWERS',
  'SOUTH WEST ETHIOPIA REGION': 'SWERS',
  'SOUTHWEST ETHIOPIA': 'SWERS',
  'CENTRAL ETHIOPIA': 'CERS',
  'CENTRAL ETHIOPIA REGION': 'CERS',
  'SOUTHERN ETHIOPIA': 'SERS',
  'SOUTH ETHIOPIA': 'SERS',
  'SOUTHERN ETHIOPIA REGION': 'SERS',
  'SNNP': null,
  'SOUTHERN NATIONS': null,
  'SOUTHERN NATIONS NATIONALITIES AND PEOPLES': null,
};

export const TARGET_REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray', 'Sidama',
  'SWERS', 'CERS', 'SERS',
];

const AMOUNT_DIVISOR = 1_000_000;

/* ------------------------------------------------------------------ */
/*  Classification — matches the reference SQL exactly.
 *    ACCOUNT_TYPE values from STTM_CUST_ACCOUNT:
 *      U → Demand / Current
 *      S → Saving
 *      Y → Term / Time Deposit
 * ------------------------------------------------------------------ */
const TYPES = [
  { key: 'DEMAND', acct: 'U' },
  { key: 'SAVING', acct: 'S' },
  { key: 'TIME',   acct: 'Y' },
];

const RANGES = [
  { key: 'RANGE1', band: 'UPTO_HUN'  },   // ≤ 100,000
  { key: 'RANGE2', band: 'UPTO_MIL'  },   // > 100,000 and ≤ 1,000,000
  { key: 'RANGE3', band: 'ABOVE_MIL' },   // > 1,000,000
];

/* ------------------------------------------------------------------ */
/*  Build 27 range aggregate columns (3 types × 3 ranges × 3 metrics)
 *  PLUS the reference query's grand-total columns (unchanged):
 *      TOTAL_BALANCE / TOTAL_DEPOSITOR / TOTAL_ACCOUNT
 * ------------------------------------------------------------------ */
const sqlFields = [];

for (const t of TYPES) {
  for (const r of RANGES) {
    sqlFields.push(
      `SUM(CASE WHEN A.ACCOUNT_TYPE = '${t.acct}' AND A.BAL_BAND = '${r.band}' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS ${t.key}_${r.key}_AMOUNT`,
      `COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = '${t.acct}' AND A.BAL_BAND = '${r.band}' THEN SUBSTR(A.ACCOUNT,4,7) END) AS ${t.key}_${r.key}_DEPOSITORS`,
      `COUNT(CASE WHEN A.ACCOUNT_TYPE = '${t.acct}' AND A.BAL_BAND = '${r.band}' THEN A.ACCOUNT END) AS ${t.key}_${r.key}_ACCOUNTS`
    );
  }
}

// Reference query's grand-total block — kept verbatim
sqlFields.push(
  `SUM(CASE WHEN A.ACCOUNT_TYPE IN ('Y','S','U') THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TOTAL_BALANCE`,
  `COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE IN ('Y','S','U') THEN SUBSTR(A.ACCOUNT,4,7) END) AS TOTAL_DEPOSITOR`,
  `COUNT(CASE WHEN A.ACCOUNT_TYPE IN ('Y','S','U') THEN A.ACCOUNT END) AS TOTAL_ACCOUNT`
);

const sqlFieldsBlock = sqlFields.join(',\n      ');

/* ------------------------------------------------------------------ */
/*  Empty structure                                                    */
/* ------------------------------------------------------------------ */
const emptyMetric = () => ({ amount: 0, depositors: 0, accounts: 0 });
const emptyRanges = () => ({
  range1: emptyMetric(),
  range2: emptyMetric(),
  range3: emptyMetric(),
  total:  emptyMetric(),
});
const emptyAccountType = () => ({
  demand: emptyRanges(),
  saving: emptyRanges(),
  time:   emptyRanges(),
});
const emptyLocation = () => ({
  urban: emptyAccountType(),
  rural: emptyAccountType(),
  grandTotal: emptyMetric(),   // <— comes from SQL Total_Balance / Total_Depositor / Total_Account
});

/* ------------------------------------------------------------------ */
function num(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
const amt = (v) => num(v) / AMOUNT_DIVISOR;
const cnt = (v) => num(v);

/* ------------------------------------------------------------------ */
/*  Main fetcher                                                       */
/* ------------------------------------------------------------------ */
export async function fetchDepositByRangeAndRegion(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchDepositByRangeAndRegion');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositByRangeAndRegion');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Deposit by Range & Region data up to ${endDateStr}`);

  /* This mirrors your reference query EXACTLY (same logic, same filters,
   * same grand-total block) — only the 27 per-range aggregates were added
   * on top so we can keep the existing structure. */
  const query = `
    WITH eligible_accounts AS (
      SELECT
        C.CUST_AC_NO,
        C.ACCOUNT_TYPE
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C'
             AND C.MAKER_DT_STAMP > TO_DATE(:endDate, 'DD-MON-YYYY') + 1)
    ),
    latest_balance AS (
      SELECT
        H.BRANCH_CODE,
        H.ACCOUNT,
        H.LCY_CLOSING_BAL,
        E.ACCOUNT_TYPE,
        ROW_NUMBER() OVER (
          PARTITION BY H.ACCOUNT
          ORDER BY H.BKG_DATE DESC
        ) AS RN
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY H
      JOIN eligible_accounts E
        ON E.CUST_AC_NO = H.ACCOUNT
      WHERE H.BKG_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    base_data AS (
      SELECT /*+ MATERIALIZE */
        L.BRANCH_CODE,
        L.ACCOUNT,
        L.LCY_CLOSING_BAL,
        L.ACCOUNT_TYPE,
        CASE
          WHEN L.LCY_CLOSING_BAL <= 100000  THEN 'UPTO_HUN'
          WHEN L.LCY_CLOSING_BAL <= 1000000 THEN 'UPTO_MIL'
          ELSE 'ABOVE_MIL'
        END AS BAL_BAND
      FROM latest_balance L
      WHERE L.RN = 1
        AND L.BRANCH_CODE <> '000'
        AND L.BRANCH_CODE < '600'
        AND L.LCY_CLOSING_BAL > 0
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      'Urban' AS "Urban/Rural",
      ${sqlFieldsBlock}
    FROM base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B
      ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });

  const regionData = {};
  for (const region of TARGET_REGIONS) {
    regionData[region] = emptyLocation();
  }

  for (const row of result.rows) {
    const rawRegion = String(row.BREGION || '').toUpperCase().trim();
    const region = REGION_NAME_MAP[rawRegion];
    if (!region) continue;

    const urban = regionData[region].urban;

    // 3 ranges × 3 types — pulled from the SQL range aggregates
    for (const type of ['DEMAND', 'SAVING', 'TIME']) {
      const typeKey = type.toLowerCase();   // demand / saving / time

      for (const rangeKey of ['RANGE1', 'RANGE2', 'RANGE3']) {
        const prefix = `${type}_${rangeKey}`;
        const targetKey = rangeKey.toLowerCase(); // range1 / range2 / range3
        urban[typeKey][targetKey] = {
          amount:     amt(row[`${prefix}_AMOUNT`]),
          depositors: cnt(row[`${prefix}_DEPOSITORS`]),
          accounts:   cnt(row[`${prefix}_ACCOUNTS`]),
        };
      }

      // Per-type totals are NOT in the reference SQL — still computed in JS
      // (R1 + R2 + R3), same as before.
      urban[typeKey].total = {
        amount:     urban[typeKey].range1.amount     + urban[typeKey].range2.amount     + urban[typeKey].range3.amount,
        depositors: urban[typeKey].range1.depositors + urban[typeKey].range2.depositors + urban[typeKey].range3.depositors,
        accounts:   urban[typeKey].range1.accounts   + urban[typeKey].range2.accounts   + urban[typeKey].range3.accounts,
      };
    }

    // Grand total — read DIRECTLY from the query (Total_Balance / Total_Depositor / Total_Account)
    regionData[region].grandTotal = {
      amount:     amt(row.TOTAL_BALANCE),
      depositors: cnt(row.TOTAL_DEPOSITOR),
      accounts:   cnt(row.TOTAL_ACCOUNT),
    };
  }

  logger.info(
    `Fetched Deposit-by-Range data for ${Object.keys(regionData).length} regions ` +
    `(amounts in Millions of Birr).`
  );
  return regionData;
}

/* ------------------------------------------------------------------ */
function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}