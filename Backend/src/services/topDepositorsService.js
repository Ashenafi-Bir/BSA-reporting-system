import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

export async function fetchTopDepositorsData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching top depositors data as of ${endDateStr}`);

  const query = `
    WITH eligible_accounts AS (
        SELECT
            C.CUST_AC_NO AS ACC,
            C.CUST_NO
        FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
        WHERE C.RECORD_STAT = 'O'
    ),
    latest_dates AS (
        SELECT
            A.ACC,
            MAX(A.VAL_DT) AS VAL_DT
        FROM FCUBSLIVE.ACTB_VD_BAL A
        JOIN eligible_accounts E
          ON E.ACC = A.ACC
        WHERE A.VAL_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
        GROUP BY A.ACC
    ),
    base_data AS (
        SELECT
            B.CUST_NO,
            A.ACC,
            A.LCY_BAL,
            CASE SUBSTR(A.ACC, 11, 1)
                WHEN '1' THEN 'DEMAND'
                WHEN '2' THEN 'SAVING'
                WHEN '3' THEN 'FIXED'
                WHEN '4' THEN 'DEMAND'
                WHEN '5' THEN 'DEMAND'
            END AS DTYPE
        FROM FCUBSLIVE.ACTB_VD_BAL A
        JOIN latest_dates L
          ON L.ACC = A.ACC
         AND L.VAL_DT = A.VAL_DT
        JOIN FCUBSLIVE.STTM_CUST_ACCOUNT B
          ON B.CUST_AC_NO = A.ACC
        WHERE B.RECORD_STAT = 'O'
          AND (
                SUBSTR(A.ACC,11,1) IN ('1','2','3')
                OR (SUBSTR(A.ACC,11,1) = '4' AND A.LCY_BAL > 0)
                OR (SUBSTR(A.ACC,11,1) = '5' AND A.BRN <> '000')
              )
    ),
    customer_totals AS (
        SELECT
            CUST_NO,
            SUM(CASE WHEN DTYPE = 'DEMAND' THEN LCY_BAL ELSE 0 END) AS DEMAND,
            SUM(CASE WHEN DTYPE = 'SAVING' THEN LCY_BAL ELSE 0 END) AS SAVING,
            SUM(CASE WHEN DTYPE = 'FIXED' THEN LCY_BAL ELSE 0 END) AS FIXED,
            SUM(LCY_BAL) AS TOTAL_BALANCE
        FROM base_data
        GROUP BY CUST_NO
    ),
    ranked_customers AS (
        SELECT
            CUST_NO,
            DEMAND,
            SAVING,
            FIXED,
            TOTAL_BALANCE,
            ROW_NUMBER() OVER (ORDER BY TOTAL_BALANCE DESC, CUST_NO) AS RN
        FROM customer_totals
    ),
    report_data AS (
        SELECT
            RN,
            CUST_NO,
            DEMAND,
            SAVING,
            FIXED,
            TOTAL_BALANCE,
            'CUSTOMER' AS ROW_TYPE
        FROM ranked_customers
        WHERE RN <= 20
        UNION ALL
        SELECT
            10 AS RN,
            NULL AS CUST_NO,
            SUM(DEMAND) AS DEMAND,
            SUM(SAVING) AS SAVING,
            SUM(FIXED) AS FIXED,
            SUM(TOTAL_BALANCE) AS TOTAL_BALANCE,
            'TOP 10 SUBTOTAL' AS ROW_TYPE
        FROM ranked_customers
        WHERE RN <= 10
        UNION ALL
        SELECT
            20 AS RN,
            NULL AS CUST_NO,
            SUM(DEMAND) AS DEMAND,
            SUM(SAVING) AS SAVING,
            SUM(FIXED) AS FIXED,
            SUM(TOTAL_BALANCE) AS TOTAL_BALANCE,
            'TOP 20 SUBTOTAL' AS ROW_TYPE
        FROM ranked_customers
        WHERE RN <= 20
    )
    SELECT
        CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN TO_CHAR(R.RN) ELSE NULL END AS RANK,
        CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN R.CUST_NO ELSE R.ROW_TYPE END AS CUST_NO,
        CASE WHEN R.ROW_TYPE = 'CUSTOMER' THEN C.CUSTOMER_NAME1 ELSE NULL END AS CUSTNAME,
        R.DEMAND,
        R.SAVING,
        R.FIXED,
        R.TOTAL_BALANCE AS TOTAL
    FROM report_data R
    LEFT JOIN FCUBSLIVE.STTM_CUSTOMER C ON C.CUSTOMER_NO = R.CUST_NO
    ORDER BY
        CASE
            WHEN R.RN <= 10 AND R.ROW_TYPE = 'CUSTOMER' THEN 1
            WHEN R.ROW_TYPE = 'TOP 10 SUBTOTAL' THEN 2
            WHEN R.RN > 10 AND R.RN <= 20 AND R.ROW_TYPE = 'CUSTOMER' THEN 3
            WHEN R.ROW_TYPE = 'TOP 20 SUBTOTAL' THEN 4
        END,
        R.RN
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });
  return result.rows;
}

function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day = String(date.getDate()).padStart(2,'0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}