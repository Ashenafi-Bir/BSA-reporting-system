import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Fetches the Key Balance Sheet (MK001) totals for the given end date.
 * The SQL already returns values divided by 1,000,000 (Millions of Birr).
 */
export async function fetchKeyBalanceSheet(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchKeyBalanceSheet');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchKeyBalanceSheet');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Key Balance Sheet data up to ${endDateStr}`);

  const query = `
    WITH latest_balance_date AS (
      SELECT MAX(as_on_date) AS as_on_date
      FROM FCUBSLIVE.balance_sheet
      WHERE as_on_date <= TO_DATE(:endDate, 'DD-MON-YYYY')
    )
    SELECT
      /* Total Asset */
      SUM(CASE WHEN (
        b.account_code IN ('1010101','1010102','1010103','1010104','1010201','1010202','1010203') OR
        b.account_code IN ('1020101','1020102','1020103') OR
        b.account_code LIKE '10203%' OR b.account_code LIKE '10206%' OR
        b.account_code LIKE '10204%' OR b.account_code LIKE '10302%' OR
        b.account_code LIKE '10301%' OR b.account_code LIKE '1050%'  OR
        b.account_code IN ('1040308','1040313','1040314') OR
        b.account_code LIKE '10404%' OR b.account_code LIKE '10406%' OR
        b.account_code LIKE '10407%' OR b.account_code LIKE '10408%' OR
        b.account_code LIKE '10707%' OR
        b.account_code LIKE '10401%' OR b.account_code LIKE '10402%' OR
        b.account_code IN ('1020104','1020105') OR
        b.account_code LIKE '10702%' OR b.account_code LIKE '10703%' OR
        b.account_code LIKE '10704%' OR b.account_code LIKE '1110%'  OR
        b.account_code LIKE '1080%'  OR b.account_code LIKE '1090%'  OR
        b.account_code LIKE '10706%' OR b.account_code LIKE '1100%'  OR
        b.account_code LIKE '1120%'
      ) THEN b.total_amount / 1000000 END) AS "Total Asset",

      /* Total Loan and Bonds (loans + bonds) */
      SUM(CASE WHEN (
        b.account_code LIKE '1050%' OR
        b.account_code IN ('1030105','1030106')
      ) THEN b.total_amount / 1000000 END) AS "Loan and Bonds",

      /* Of which Bonds */
      SUM(CASE WHEN (
        b.account_code IN ('1030105','1030106')
      ) THEN b.total_amount / 1000000 END) AS "Off which Bonds",

      /* Total Deposits */
      SUM(CASE WHEN (
        b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%' OR
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%' OR
        b.account_code LIKE '20103%'
      ) THEN b.total_amount / 1000000 END) AS "Total Deposits",

      /* Demand and Current Deposit */
      SUM(CASE WHEN (
        b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%'
      ) THEN b.total_amount / 1000000 END) AS "Demand and Current Deposit",

      /* Saving Deposit */
      SUM(CASE WHEN (
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%'
      ) THEN b.total_amount / 1000000 END) AS "Saving Deposit",

      /* Time / Fixed Deposit */
      SUM(CASE WHEN (
        b.account_code LIKE '20103%'
      ) THEN b.total_amount / 1000000 END) AS "Time/Fixed Deposit",

      /* Total Capital and Reserve */
      SUM(CASE WHEN (
        b.account_code IN ('3010101','3010102')
      ) THEN b.total_amount / 1000000 END) AS "Total Capital and Reserve"
    FROM FCUBSLIVE.balance_sheet b
    JOIN latest_balance_date lbd ON b.as_on_date = lbd.as_on_date
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });
  if (!result.rows.length) {
    logger.warn('No Key Balance Sheet row returned.');
    return {};
  }

  logger.info('Fetched Key Balance Sheet data (amounts in Millions of Birr).');
  return result.rows[0];
}

/* ------------------------------------------------------------------ */
function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}