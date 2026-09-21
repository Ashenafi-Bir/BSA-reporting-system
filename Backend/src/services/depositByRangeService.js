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

/* ---------- Account-code buckets (same codes as MD002) ---------- */
const DEMAND_CODES = [
  '101',
  '115','116','114','103','104','105','108','109','110','111','112','113',
  '117','118','119','501','502','503','122','123','124','125','126','127',
  '107',
  '102',
  '401','402','403','404','405','406','407','408','409','410','411','412','413',
];

const SAVING_CODES = [
  '207','206','211','202','209','203','210','213','241','242',
  '212','214','216','217','220','225','226','221','222','224',
  '201','215','219','227','228','208','218','223','205','230',
  '231','232','233','234','235','236','237','238','239','240',
  '243','244','245','246','247','248','249','229',
  '204',
];

const TIME_CODES = ['302', '303', '305', '301', '304'];

const demandSqlList = DEMAND_CODES.map(c => `'${c}'`).join(',');
const savingSqlList = SAVING_CODES.map(c => `'${c}'`).join(',');
const timeSqlList   = TIME_CODES.map(c => `'${c}'`).join(',');

/* ---------- Range definitions ----------
 * Ranges apply only to POSITIVE balances (> 0). Negative balances
 * (overdrafts, dormant, contra accounts) are excluded — same pattern
 * as MD002's "Other" bucket which uses "AND A.LCY_CLOSING_BAL > 0".
 */
const RANGES = [
  { key: 'RANGE1', cond: 'A.LCY_CLOSING_BAL > 0 AND A.LCY_CLOSING_BAL <= 100000' },
  { key: 'RANGE2', cond: 'A.LCY_CLOSING_BAL > 100000 AND A.LCY_CLOSING_BAL <= 1000000' },
  { key: 'RANGE3', cond: 'A.LCY_CLOSING_BAL > 1000000' },
  { key: 'TOTAL',  cond: 'A.LCY_CLOSING_BAL > 0' },
];

const TYPES = [
  { key: 'DEMAND', sqlList: demandSqlList },
  { key: 'SAVING', sqlList: savingSqlList },
  { key: 'TIME',   sqlList: timeSqlList   },
];

/* Build 36 SQL aggregate columns (3 types × 4 ranges × 3 metrics) */
const sqlFields = [];
for (const type of TYPES) {
  for (const range of RANGES) {
    sqlFields.push(
      `SUM(CASE WHEN A.ACC_CODE IN (${type.sqlList}) AND ${range.cond} THEN A.LCY_CLOSING_BAL END) AS ${type.key}_${range.key}_AMOUNT`
    );
    sqlFields.push(
      `COUNT(DISTINCT CASE WHEN A.ACC_CODE IN (${type.sqlList}) AND ${range.cond} THEN SUBSTR(A.ACCOUNT,4,7) END) AS ${type.key}_${range.key}_DEPOSITORS`
    );
    sqlFields.push(
      `COUNT(CASE WHEN A.ACC_CODE IN (${type.sqlList}) AND ${range.cond} THEN A.ACCOUNT END) AS ${type.key}_${range.key}_ACCOUNTS`
    );
  }
}
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

  const query = `
    WITH eligible_accounts AS (
      SELECT C.CUST_AC_NO AS ACC
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C'
             AND C.MAKER_DT_STAMP > TO_DATE(:endDate, 'DD-MON-YYYY'))
    ),
    latest_dates AS (
      SELECT A.ACCOUNT, MAX(A.BKG_DATE) AS BKG_DATE
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY A
      JOIN eligible_accounts C ON C.ACC = A.ACCOUNT
      WHERE A.BKG_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
      GROUP BY A.ACCOUNT
    ),
    base_data AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.LCY_CLOSING_BAL,
        SUBSTR(A.ACCOUNT, 11, 3) AS ACC_CODE
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY A
      JOIN latest_dates L
        ON L.ACCOUNT = A.ACCOUNT AND L.BKG_DATE = A.BKG_DATE
      WHERE A.BRANCH_CODE <> '000' and  A.BRANCH_CODE < '600'
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      'Urban' AS URBAN_RURAL,
      ${sqlFieldsBlock}
    FROM base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });

  const regionData = {};
  for (const region of TARGET_REGIONS) {
    regionData[region] = emptyLocation();
  }

  // Straight copy from SQL -> JS structure. No recomputation.
  for (const row of result.rows) {
    const rawRegion = String(row.BREGION || '').toUpperCase().trim();
    const region = REGION_NAME_MAP[rawRegion];
    if (!region) continue;

    const urban = regionData[region].urban;

    for (const type of ['DEMAND', 'SAVING', 'TIME']) {
      const typeKey = type.toLowerCase();           // demand / saving / time
      for (const rangeKey of ['RANGE1', 'RANGE2', 'RANGE3', 'TOTAL']) {
        const prefix = `${type}_${rangeKey}`;
        const targetKey = rangeKey.toLowerCase();   // range1 / range2 / range3 / total
        urban[typeKey][targetKey] = {
          amount:     amt(row[`${prefix}_AMOUNT`]),
          depositors: cnt(row[`${prefix}_DEPOSITORS`]),
          accounts:   cnt(row[`${prefix}_ACCOUNTS`]),
        };
      }
    }
  }

  logger.info(
    `Fetched Deposit-by-Range data for ${Object.keys(regionData).length} regions (amounts in Millions of Birr).`
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