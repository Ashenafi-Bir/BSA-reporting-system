import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Fetch the Top 20 Shareholders (subscribed + paid-up) as of endDate.
 * The provided SQL does NOT filter by date — the entire SHARE_* tables
 * represent the current standing. Dates are passed only to BSA for
 * reporting-window metadata.
 */
export async function fetchTop20ShareholdingData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchTop20ShareholdingData');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Top 20 Shareholding data as of ${endDateStr}`);

  const query = `
    WITH share_totals AS (
      SELECT
        B.CUST_NO,
        SUM(B.SUB_AMT) / 1000000 AS SH_SUBSCRIPTION,
        SUM(B.PAIDUP_AMT) / 1000000 AS PAIDUP_AMT
      FROM FCUBSLIVE.SHARE_SUBSCRIPTION_MASTER B
      GROUP BY B.CUST_NO
    ),
    top_20 AS (
      SELECT
        X.NAME,
        X.CUSTOMER,
        X.NO_OF_SHARES,
        S.SH_SUBSCRIPTION,
        S.PAIDUP_AMT
      FROM FCUBSLIVE.SHARE_CUSTOMER_LINKAGE X
      LEFT JOIN share_totals S
        ON S.CUST_NO = X.CUSTOMER
      WHERE X.NO_OF_SHARES > 0
      ORDER BY S.PAIDUP_AMT DESC NULLS LAST
      FETCH FIRST 20 ROWS ONLY
    ),
    grand_totals AS (
      SELECT
        SUM(SH.SUB_AMT) / 1000000 AS GRAND_TOTAL_SUB,
        SUM(SH.PAIDUP_AMT) / 1000000 AS GRAND_TOTAL_PAID
      FROM FCUBSLIVE.SHARE_SUBSCRIPTION_MASTER SH
    ),
    top_20_totals AS (
      SELECT
        SUM(SH_SUBSCRIPTION) AS TOP20_SUB,
        SUM(PAIDUP_AMT) AS TOP20_PAID
      FROM top_20
    )
    SELECT
      T.NAME,
      T.SH_SUBSCRIPTION,
      T.PAIDUP_AMT,
      (T.SH_SUBSCRIPTION / G.GRAND_TOTAL_SUB) * 100 AS PCT_SUB,
      (T.PAIDUP_AMT    / G.GRAND_TOTAL_PAID) * 100 AS PCT_PAID,
      G.GRAND_TOTAL_SUB - NVL(TT.TOP20_SUB,  0) AS REMAINING_TOTAL_SUB,
      G.GRAND_TOTAL_PAID - NVL(TT.TOP20_PAID, 0) AS REMAINING_TOTAL_PAID,
      G.GRAND_TOTAL_SUB,
      G.GRAND_TOTAL_PAID
    FROM top_20 T
    CROSS JOIN grand_totals G
    CROSS JOIN top_20_totals TT
    ORDER BY T.PAIDUP_AMT DESC NULLS LAST
  `;

  const result = await executeOracleQuery(query, {});
  const rows = result.rows || [];

  if (!rows.length) {
    logger.warn('No Top 20 Shareholding data returned.');
    return {
      shareholders: [],
      subtotalSub: 0,
      subtotalPaid: 0,
      remainingSub: 0,
      remainingPaid: 0,
      grandTotalSub: 0,
      grandTotalPaid: 0,
    };
  }

  const shareholders = rows.map(row => ({
    name:       row.NAME != null ? String(row.NAME) : '',
    subscribed: numOrZero(row.SH_SUBSCRIPTION),
    paidUp:     numOrZero(row.PAIDUP_AMT),
    pctSub:     numOrZero(row.PCT_SUB),
    pctPaid:    numOrZero(row.PCT_PAID),
  }));

  // Compute subtotals from the fetched rows to guarantee consistency
  const subtotalSub  = shareholders.reduce((s, r) => s + r.subscribed, 0);
  const subtotalPaid = shareholders.reduce((s, r) => s + r.paidUp, 0);

  // Grand totals are identical on every row (cross join) — take from row 0
  const grandTotalSub  = numOrZero(rows[0].GRAND_TOTAL_SUB);
  const grandTotalPaid = numOrZero(rows[0].GRAND_TOTAL_PAID);

  const remainingSub  = grandTotalSub  - subtotalSub;
  const remainingPaid = grandTotalPaid - subtotalPaid;

  logger.info(
    `Fetched ${shareholders.length} shareholders (grand total: ${grandTotalSub} subscribed / ${grandTotalPaid} paid-up).`
  );

  return {
    shareholders,
    subtotalSub,
    subtotalPaid,
    remainingSub,
    remainingPaid,
    grandTotalSub,
    grandTotalPaid,
  };
}

function numOrZero(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}