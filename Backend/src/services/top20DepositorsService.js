import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Fetches Top 20 Depositors data as of a given end date.
 * Returns: { top10, top11to20, top10Subtotal, top20Subtotal, allRows }
 *
 * Note: dataFetcher.length === 1 → buildReportPayload passes only endDate.
 */
export async function fetchTop20DepositorsData(endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchTop20DepositorsData');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Top 20 Depositors data as of ${endDateStr}`);

  // OPTIMIZED: single scan of ACTB_VD_BAL using ROW_NUMBER window,
  // instead of the original MAX() + re-join (which read the table twice).
  const query = `
    WITH latest_account_balance AS (
      SELECT
        A.ACC,
        A.LCY_BAL,
        A.BRN,
        B.CUST_NO,
        ROW_NUMBER() OVER (
          PARTITION BY A.ACC
          ORDER BY A.VAL_DT DESC
        ) AS RN
      FROM FCUBSLIVE.ACTB_VD_BAL A
      JOIN FCUBSLIVE.STTM_CUST_ACCOUNT B
        ON B.CUST_AC_NO = A.ACC
      WHERE B.RECORD_STAT = 'O'
        AND A.VAL_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    eligible_latest AS (
      SELECT
        CUST_NO,
        LCY_BAL,
        CASE SUBSTR(ACC, 11, 1)
          WHEN '1' THEN 'DEMAND'
          WHEN '2' THEN 'SAVING'
          WHEN '3' THEN 'FIXED'
          WHEN '4' THEN 'DEMAND'
          WHEN '5' THEN 'DEMAND'
        END AS DTYPE
      FROM latest_account_balance
      WHERE RN = 1
        AND (
          SUBSTR(ACC, 11, 1) IN ('1','2','3')
          OR (SUBSTR(ACC, 11, 1) = '4' AND LCY_BAL > 0)
          OR (SUBSTR(ACC, 11, 1) = '5' AND BRN <> '000')
        )
    ),
    customer_totals AS (
      SELECT
        CUST_NO,
        SUM(CASE WHEN DTYPE = 'DEMAND' THEN LCY_BAL ELSE 0 END) AS DEMAND,
        SUM(CASE WHEN DTYPE = 'SAVING' THEN LCY_BAL ELSE 0 END) AS SAVING,
        SUM(CASE WHEN DTYPE = 'FIXED'  THEN LCY_BAL ELSE 0 END) AS FIXED,
        SUM(LCY_BAL) AS TOTAL_BALANCE
      FROM eligible_latest
      GROUP BY CUST_NO
    ),
    ranked_customers AS (
      SELECT CUST_NO, DEMAND, SAVING, FIXED, TOTAL_BALANCE,
             ROW_NUMBER() OVER (ORDER BY TOTAL_BALANCE DESC, CUST_NO) AS RN
      FROM customer_totals
    ),
    report_data AS (
      SELECT RN, CUST_NO, DEMAND, SAVING, FIXED, TOTAL_BALANCE, 'CUSTOMER' AS ROW_TYPE
      FROM ranked_customers WHERE RN <= 20

      UNION ALL

      SELECT 10 AS RN, NULL AS CUST_NO,
             SUM(DEMAND), SUM(SAVING), SUM(FIXED), SUM(TOTAL_BALANCE),
             'TOP 10 SUBTOTAL' AS ROW_TYPE
      FROM ranked_customers WHERE RN <= 10

      UNION ALL

      SELECT 20 AS RN, NULL AS CUST_NO,
             SUM(DEMAND), SUM(SAVING), SUM(FIXED), SUM(TOTAL_BALANCE),
             'TOP 20 SUBTOTAL' AS ROW_TYPE
      FROM ranked_customers WHERE RN <= 20
    )
    SELECT
      CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN TO_CHAR(R.RN) ELSE NULL END AS RANK,
      CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN R.CUST_NO ELSE R.ROW_TYPE END AS CUST_NO,
      CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN C.CUSTOMER_NAME1 ELSE NULL END AS CUSTNAME,
      NVL(R.DEMAND, 0)        AS DEMAND,
      NVL(R.SAVING, 0)        AS SAVING,
      NVL(R.FIXED, 0)         AS FIXED,
      NVL(R.TOTAL_BALANCE, 0) AS TOTAL,
      0                       AS DAYS_LEFT
    FROM report_data R
    LEFT JOIN FCUBSLIVE.STTM_CUSTOMER C ON C.CUSTOMER_NO = R.CUST_NO
    ORDER BY
      CASE
        WHEN R.RN <= 10 AND R.ROW_TYPE = 'CUSTOMER' THEN 1
        WHEN R.ROW_TYPE = 'TOP 10 SUBTOTAL'           THEN 2
        WHEN R.RN > 10 AND R.RN <= 20 AND R.ROW_TYPE = 'CUSTOMER' THEN 3
        WHEN R.ROW_TYPE = 'TOP 20 SUBTOTAL'           THEN 4
      END,
      R.RN
  `;

  const startTs = Date.now();
  const result = await executeOracleQuery(query, { endDate: endDateStr });
  logger.info(
    `Top 20 Depositors query completed in ${Date.now() - startTs} ms`
  );

  const allRows = (result.rows || []).map((row) => {
    const custNo = row.CUST_NO;
    const rowType =
      custNo === 'TOP 10 SUBTOTAL' ? 'TOP 10 SUBTOTAL'
      : custNo === 'TOP 20 SUBTOTAL' ? 'TOP 20 SUBTOTAL'
      : 'CUSTOMER';

    return {
      rank: row.RANK ? parseInt(row.RANK, 10) : null,
      custNo,
      custName: row.CUSTNAME || '',
      demand: parseFloat(row.DEMAND) || 0,
      saving: parseFloat(row.SAVING) || 0,
      fixed: parseFloat(row.FIXED) || 0,
      total: parseFloat(row.TOTAL) || 0,
      daysLeft: parseInt(row.DAYS_LEFT, 10) || 0,
      rowType,
    };
  });

  const customers = allRows.filter((r) => r.rowType === 'CUSTOMER');
  const top10 = customers.filter((r) => r.rank !== null && r.rank <= 10);
  const top11to20 = customers.filter(
    (r) => r.rank !== null && r.rank > 10 && r.rank <= 20
  );
  const top10Subtotal = allRows.find((r) => r.rowType === 'TOP 10 SUBTOTAL') || null;
  const top20Subtotal = allRows.find((r) => r.rowType === 'TOP 20 SUBTOTAL') || null;

  logger.info(
    `Fetched Top 20 Depositors: ${top10.length} top-10, ${top11to20.length} top-11..20`
  );

  return { top10, top11to20, top10Subtotal, top20Subtotal, allRows };
}

function formatOracleDate(date) {
  const months = [
    'JAN','FEB','MAR','APR','MAY','JUN',
    'JUL','AUG','SEP','OCT','NOV','DEC',
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}