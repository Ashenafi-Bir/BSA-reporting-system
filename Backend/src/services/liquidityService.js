import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

export async function fetchLiquidityData(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchLiquidityData');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchLiquidityData');
  }

  const startDateStr = formatOracleDate(startDate);
  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching liquidity data from ${startDateStr} to ${endDateStr}`);

  const query = `
    WITH date_range AS (
      SELECT TO_DATE(:startDate, 'DD-MON-YYYY') + LEVEL - 1 AS as_on_date
      FROM DUAL
      CONNECT BY LEVEL <= (TO_DATE(:endDate, 'DD-MON-YYYY') - TO_DATE(:startDate, 'DD-MON-YYYY') + 1)
    )
    SELECT
      dr.as_on_date,
      -- Demand Deposit (CURRENT accounts, excluding 3010106)
      COALESCE(SUM(CASE WHEN b.product_type = 'CURRENT' AND b.account_code <> '3010106' THEN b.lcy_amount END), 0) AS demand_deposit,
      -- Saving Deposit
      COALESCE(SUM(CASE WHEN b.product_type = 'SAVING' THEN b.lcy_amount END), 0) AS saving_deposit,
      -- Fixed Deposit
      COALESCE(SUM(CASE WHEN b.product_type = 'FIXED' THEN b.lcy_amount END), 0) AS fixed_deposit,
      -- Total Deposit
      COALESCE(SUM(CASE WHEN b.product_type IN ('FIXED','SAVING','CURRENT') AND b.account_code <> '3010106' THEN b.lcy_amount END), 0) AS total_deposit,
      -- Uncleared effect Foreign
      COALESCE(SUM(CASE WHEN b.account_code IN ('1040201','1040211') THEN b.lcy_amount END), 0) AS uncleared_effect_foreign,
      -- Reserve a/c wz NBE (1020101)
      COALESCE(SUM(CASE WHEN b.account_code = '1020101' THEN b.lcy_amount END), 0) AS reserve_ac_wz_nbe,
      -- Pyt & Sett (1020102)
      COALESCE(SUM(CASE WHEN b.account_code = '1020102' THEN b.lcy_amount END), 0) AS pyt_sett,
      -- Currency Issue a/c (1020103)
      COALESCE(SUM(CASE WHEN b.account_code = '1020103' THEN b.lcy_amount END), 0) AS currency_issue_ac,
      -- Cash local & foreign currency (10101%, 10102%)
      COALESCE(SUM(CASE WHEN b.account_code LIKE '10101%' OR b.account_code LIKE '10102%' THEN b.lcy_amount END), 0) AS cash_local_foreign_curr,
      -- Deposit wz NBE (1020101 + 1020102 + 1020103)
      COALESCE(SUM(CASE WHEN b.account_code IN ('1020101','1020102','1020103') THEN b.lcy_amount END), 0) AS deposit_wz_nbe,
      -- Deposit wz other local & foreign banks
      COALESCE(SUM(CASE WHEN b.account_code LIKE '10203%' OR b.account_code LIKE '10204%' OR b.account_code = '1030202' THEN b.lcy_amount END), 0) AS deposit_wz_other_banks,
      -- Treasury bill
      COALESCE(SUM(CASE WHEN b.account_code IN ('1030101','1030107') THEN b.lcy_amount END), 0) AS treasury_bill
    FROM date_range dr
    LEFT JOIN FCUBSLIVE.balance_sheet b ON dr.as_on_date = b.as_on_date
    GROUP BY dr.as_on_date
    ORDER BY dr.as_on_date
  `;

  const result = await executeOracleQuery(query, {
    startDate: startDateStr,
    endDate: endDateStr
  });

  const dailyData = result.rows.map(row => ({
    date: new Date(row.AS_ON_DATE),
    demandDeposit: parseFloat(row.DEMAND_DEPOSIT) || 0,
    savingDeposit: parseFloat(row.SAVING_DEPOSIT) || 0,
    fixedDeposit: parseFloat(row.FIXED_DEPOSIT) || 0,
    totalDeposit: parseFloat(row.TOTAL_DEPOSIT) || 0,
    unclearedEffectForeign: parseFloat(row.UNCLEARED_EFFECT_FOREIGN) || 0,
    reserveAcWzNBE: parseFloat(row.RESERVE_AC_WZ_NBE) || 0,
    pytSett: parseFloat(row.PYT_SETT) || 0,
    currencyIssueAc: parseFloat(row.CURRENCY_ISSUE_AC) || 0,
    cashLocalForeignCurr: parseFloat(row.CASH_LOCAL_FOREIGN_CURR) || 0,
    depositWzNBE: parseFloat(row.DEPOSIT_WZ_NBE) || 0,
    depositWzOtherBanks: parseFloat(row.DEPOSIT_WZ_OTHER_BANKS) || 0,
    treasuryBill: parseFloat(row.TREASURY_BILL) || 0,
  }));

  logger.info(`Fetched liquidity data for ${dailyData.length} days (exact).`);
  return dailyData;
}

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}