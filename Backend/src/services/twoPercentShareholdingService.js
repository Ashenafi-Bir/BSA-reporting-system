import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

export async function fetchTwoPercentShareholdingData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchTwoPercentShareholdingData');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching >=2% Shareholding data as of ${endDateStr}`);

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
      LEFT JOIN share_totals S ON S.CUST_NO = X.CUSTOMER
      WHERE X.NO_OF_SHARES > 0
      ORDER BY S.PAIDUP_AMT DESC NULLS LAST
      FETCH FIRST 20 ROWS ONLY
    ),
    grand_totals AS (
      SELECT
        SUM(SH.SUB_AMT) / 1000000 AS GRAND_TOTAL_SUB,
        SUM(SH.PAIDUP_AMT) / 1000000 AS GRAND_TOTAL_PAID
      FROM FCUBSLIVE.SHARE_SUBSCRIPTION_MASTER SH
    )
    SELECT
      T.NAME                                     AS SHAREHOLDER_NAME,
      1000                                       AS PER_VALUE,
      T.SH_SUBSCRIPTION                          AS SHARES_SUBSCRIBED,
      T.PAIDUP_AMT                               AS SHARES_PAID,
      T.SH_SUBSCRIPTION * 1000                   AS VALUE_SUBSCRIBED,
      T.PAIDUP_AMT      * 1000                   AS VALUE_PAID,
      (T.SH_SUBSCRIPTION * 1000) / G.GRAND_TOTAL_SUB * 100 AS PERCENT
    FROM top_20 T
    CROSS JOIN grand_totals G
    WHERE T.SH_SUBSCRIPTION / G.GRAND_TOTAL_SUB * 100 >= 2
    ORDER BY T.PAIDUP_AMT DESC NULLS LAST
  `;

  const result = await executeOracleQuery(query, {});
  const rows = result.rows || [];

  const shareholders = rows.map(row => ({
    name:             row.SHAREHOLDER_NAME != null ? String(row.SHAREHOLDER_NAME) : '',
    perValue:         numOrZero(row.PER_VALUE),
    sharesSubscribed: numOrZero(row.SHARES_SUBSCRIBED),
    sharesPaid:       numOrZero(row.SHARES_PAID),
    valueSubscribed:  numOrZero(row.VALUE_SUBSCRIBED),
    valuePaid:        numOrZero(row.VALUE_PAID),
    percent:          numOrZero(row.PERCENT),
  }));

  logger.info(`Fetched ${shareholders.length} shareholders with >=2% shareholding.`);
  return { shareholders };
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