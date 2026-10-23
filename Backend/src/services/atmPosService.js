import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

const AMOUNT_DIVISOR = 1_000_000;

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
export async function fetchAtmPosQuarterly(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchAtmPosQuarterly');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchAtmPosQuarterly');
  }

  const startDateStr = formatOracleDate(startDate);
  const endDateStr   = formatOracleDate(endDate);
  logger.info(`Fetching Quarterly ATM/POS data from ${startDateStr} to ${endDateStr}`);

  const query = `
    WITH card_accounts_all AS (
      SELECT ATM_ACC_NO
      FROM FCUBSLIVE.SWTM_CARD_DETAILS
    ),
    card_accounts_active AS (
      SELECT ATM_ACC_NO
      FROM FCUBSLIVE.SWTM_CARD_DETAILS
      WHERE RECORD_STAT = 'O'
    ),
    filtered_txns AS (
      SELECT
        e.AC_NO,
        e.TRN_CODE,
        e.TRN_REF_NO,
        e.LCY_AMOUNT
      FROM FCUBSLIVE.ACVW_ALL_AC_ENTRIES e
      WHERE e.TRN_DT >= TO_DATE(:startDate, 'DD-MON-YYYY')
        AND e.TRN_DT <  TO_DATE(:endDate, 'DD-MON-YYYY') + 1
        AND e.AUTH_ID = 'FLEXSWITCH'
        AND e.AMOUNT_TAG = 'TXN_AMT'
        AND e.CUST_GL = 'A'
        AND e.TRN_CODE IN ('ACW', 'PPM')
    ),
    aggregated_txns AS (
      SELECT
        COUNT(DISTINCT CASE
          WHEN f.TRN_CODE = 'ACW' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_active)
          THEN f.AC_NO END) AS ATM_USERS,
        COUNT(DISTINCT CASE
          WHEN f.TRN_CODE = 'PPM' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_active)
          THEN f.AC_NO END) AS POS_USERS,
        COUNT(DISTINCT CASE
          WHEN f.TRN_CODE = 'ACW' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_all)
          THEN f.TRN_REF_NO END) AS ATM_TXNS,
        COUNT(DISTINCT CASE
          WHEN f.TRN_CODE = 'PPM' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_all)
          THEN f.TRN_REF_NO END) AS POS_TXNS,
        SUM(CASE
          WHEN f.TRN_CODE = 'ACW' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_all)
          THEN f.LCY_AMOUNT ELSE 0 END) AS ATM_AMOUNT,
        SUM(CASE
          WHEN f.TRN_CODE = 'PPM' AND f.AC_NO IN (SELECT ATM_ACC_NO FROM card_accounts_all)
          THEN f.LCY_AMOUNT ELSE 0 END) AS POS_AMOUNT
      FROM filtered_txns f
    )
    SELECT
      (SELECT COUNT(*) FROM FCUBSLIVE.SWTM_TERMINAL_DETAILS WHERE CHANNEL = 'ATM') AS ATM_COUNT,
      (SELECT COUNT(*) FROM FCUBSLIVE.SWTM_TERMINAL_DETAILS WHERE CHANNEL = 'POS') AS POS_COUNT,
      (SELECT COUNT(*) FROM card_accounts_active) AS DEBIT_CARD_COUNT,
      a.*
    FROM aggregated_txns a
  `;

  const result = await executeOracleQuery(query, {
    startDate: startDateStr,
    endDate:   endDateStr,
  });

  const row = (result.rows && result.rows[0]) || {};

  logger.info(
    `Fetched ATM/POS data: ATM=${cnt(row.ATM_COUNT)}, POS=${cnt(row.POS_COUNT)}, Cards=${cnt(row.DEBIT_CARD_COUNT)}`
  );

  return {
    atm: {
      machines:     cnt(row.ATM_COUNT),
      users:        cnt(row.ATM_USERS),
      transactions: cnt(row.ATM_TXNS),
      amount:       amt(row.ATM_AMOUNT),   // millions of Birr
    },
    pos: {
      machines:     cnt(row.POS_COUNT),
      users:        cnt(row.POS_USERS),
      transactions: cnt(row.POS_TXNS),
      amount:       amt(row.POS_AMOUNT),
    },
    card: {
      machines:     cnt(row.DEBIT_CARD_COUNT),                     // N/A for cards
      users:        0,
      transactions: 0,                       // not tracked separately
      amount:       0,                       // not tracked separately
    },
  };
}

/* ------------------------------------------------------------------ */
function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}