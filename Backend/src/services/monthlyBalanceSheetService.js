import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * All monetary values from the balance_sheet SQL are divided by 1,000,000
 * so they land in "Millions of ETB" (matching the Excel template header).
 */
const AMOUNT_DIVISOR = 1_000_000;

export async function fetchMonthlyBalanceSheet(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchMonthlyBalanceSheet');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchMonthlyBalanceSheet');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Monthly Balance Sheet data up to ${endDateStr}`);

  // Same SQL as before — it returns RAW totals (not divided).
  // Division by 1,000,000 happens once, below, on the whole row.
  const query = `
    WITH latest_balance_date AS (
      SELECT MAX(as_on_date) AS as_on_date
      FROM FCUBSLIVE.balance_sheet
      WHERE as_on_date <= TO_DATE(:endDate, 'DD-MON-YYYY')
    )
    SELECT
      /* Cash on Hand */
      SUM(CASE WHEN b.account_code IN ('1010101','1010102','1010103','1010104','1010201','1010202','1010203') THEN b.total_amount END) AS CASH_ON_HAND,
      SUM(CASE WHEN b.account_code IN ('1010201','1010202','1010203') THEN b.total_amount END) AS FOREIGN_CURRENCY,
      SUM(CASE WHEN b.account_code IN ('1010101','1010102','1010103','1010104') THEN b.total_amount END) AS LOCAL_CURRENCY,

      /* Deposits with Banks */
      SUM(CASE WHEN (b.account_code IN ('1020101','1020102','1020103') OR b.account_code LIKE '10203%' OR b.account_code LIKE '10206%' OR b.account_code LIKE '10204%' OR b.account_code LIKE '10302%') THEN b.total_amount END) AS DEPOSIT_WITH_BANKS,
      SUM(CASE WHEN b.account_code IN ('1020101','1020102','1020103') THEN b.total_amount END) AS DEPOSITS_WITH_NBE,
      SUM(CASE WHEN b.account_code = '1020101' THEN b.total_amount END) AS RESERVE_ACCOUNT,
      SUM(CASE WHEN b.account_code = '1020102' THEN b.total_amount END) AS PAYMENT_AND_SETTLEMENT,
      SUM(CASE WHEN b.account_code = '1020103' THEN b.total_amount END) AS ISSUE_ACCOUNT_WITH_NBE,
      SUM(CASE WHEN (b.account_code LIKE '10203%' OR b.account_code LIKE '10206%') THEN b.total_amount END) AS DOMESTIC_BANKS_DEPOSITS,
      SUM(CASE WHEN (b.account_code LIKE '10204%' OR b.account_code LIKE '10302%') THEN b.total_amount END) AS FOREIGN_BANKS_DEPOSITS,

      /* Investments */
      SUM(CASE WHEN b.account_code LIKE '10301%' THEN b.total_amount END) AS INVESTMENT,
      SUM(CASE WHEN b.account_code = '1030107' THEN b.total_amount END) AS SHORT_TERM_INVESTMENTS,
      SUM(CASE WHEN b.account_code = '1030107' THEN b.total_amount END) AS OTHER_SHORT_TERM_SECURITIES,
      SUM(CASE WHEN b.account_code LIKE '10301%' AND b.account_code <> '1030107' THEN b.total_amount END) AS LONG_TERM_INVESTMENT,
      SUM(CASE WHEN b.account_code IN ('1030105','1030106') THEN b.total_amount END) AS SECURITIES,
      SUM(CASE WHEN b.account_code = '1030106' THEN b.total_amount END) AS DBE_BOND,
      SUM(CASE WHEN b.account_code = '1030105' THEN b.total_amount END) AS BONDS,
      SUM(CASE WHEN b.account_code = '1030105' THEN b.total_amount END) AS FEDERAL_GOVERNMENT_BOND,
      SUM(CASE WHEN b.account_code = '1030103' THEN b.total_amount END) AS EQUITY_PARTICIPATION,
      SUM(CASE WHEN b.account_code = '1030103' THEN b.total_amount END) AS LOCAL_EQUITY,
      SUM(CASE WHEN b.account_code = '1030103' THEN b.total_amount END) AS IN_NON_BANK_FI,

      /* Loans and Advances */
      SUM(CASE WHEN b.account_code LIKE '1050%' THEN b.total_amount END) AS TOTAL_LOAN_ADVANCES,
      SUM(CASE WHEN b.account_code LIKE '1050%' THEN b.total_amount END) AS NON_INTER_BANK_LOAN,
      SUM(CASE WHEN b.account_code = '2050101' THEN b.total_amount END) AS PROVISION_LOAN_ADVANCE,

      /* Other Financial Assets */
      SUM(CASE WHEN (b.account_code IN ('1040308','1040313','1040314') OR b.account_code LIKE '10404%' OR b.account_code LIKE '10406%' OR b.account_code LIKE '10407%' OR b.account_code LIKE '10408%' OR b.account_code LIKE '10707%') THEN b.total_amount END) AS SUNDRY_DEBTORS,
      SUM(CASE WHEN (b.account_code LIKE '10401%' OR b.account_code LIKE '10402%' OR b.account_code IN ('1020104','1020105')) THEN b.total_amount END) AS UNCLEARED_EFFECT,
      SUM(CASE WHEN b.account_code LIKE '10402%' THEN b.total_amount END) AS FOREIGN_UNCLEARED,
      SUM(CASE WHEN (b.account_code LIKE '10401%' OR b.account_code IN ('1020104','1020105')) THEN b.total_amount END) AS LOCAL_UNCLEARED,

      /* Non-Financial Assets */
      (SUM(CASE WHEN (b.account_code LIKE '10702%' OR b.account_code LIKE '10703%' OR b.account_code LIKE '10704%' OR b.account_code LIKE '1110%' OR b.account_code LIKE '1080%' OR b.account_code LIKE '1090%' OR b.account_code LIKE '10706%' OR b.account_code LIKE '1100%' OR b.account_code LIKE '1120%') THEN b.total_amount END)
       + SUM(CASE WHEN b.account_code LIKE '10405%' THEN b.total_amount END)
       + SUM(CASE WHEN (b.account_code LIKE '10705%' OR b.account_code LIKE '11301%') THEN b.total_amount END)
       - SUM(CASE WHEN b.account_code LIKE '20401%' THEN b.total_amount END)) AS NON_FINANCIAL_ASSET,
      (SUM(CASE WHEN (b.account_code LIKE '10702%' OR b.account_code LIKE '10703%' OR b.account_code LIKE '10704%' OR b.account_code LIKE '1110%' OR b.account_code LIKE '1080%' OR b.account_code LIKE '1090%' OR b.account_code LIKE '10706%' OR b.account_code LIKE '1100%' OR b.account_code LIKE '1120%') THEN b.total_amount END)
       - SUM(CASE WHEN b.account_code LIKE '20401%' THEN b.total_amount END)) AS FIXED_ASSET_NET,
      SUM(CASE WHEN (b.account_code LIKE '10702%' OR b.account_code LIKE '10703%' OR b.account_code LIKE '10704%' OR b.account_code LIKE '1110%' OR b.account_code LIKE '1080%' OR b.account_code LIKE '1090%' OR b.account_code LIKE '10706%' OR b.account_code LIKE '1100%' OR b.account_code LIKE '1120%') THEN b.total_amount END) AS GROSS_FIXED_ASSET,
      SUM(CASE WHEN (b.account_code LIKE '10702%' OR b.account_code LIKE '10703%' OR b.account_code LIKE '10704%') THEN b.total_amount END) AS PREMISES,
      SUM(CASE WHEN b.account_code LIKE '1110%' THEN b.total_amount END) AS VEHICLES,
      SUM(CASE WHEN b.account_code LIKE '1080%' THEN b.total_amount END) AS FURNITURE_FITTINGS,
      SUM(CASE WHEN b.account_code LIKE '1090%' THEN b.total_amount END) AS OFFICE_EQUIPMENTS,
      SUM(CASE WHEN (b.account_code LIKE '10706%' OR b.account_code LIKE '1100%' OR b.account_code LIKE '1120%') THEN b.total_amount END) AS OTHER_PROPERTIES,
      SUM(CASE WHEN b.account_code LIKE '20401%' THEN b.total_amount END) AS ACCUMULATED_DEPRECIATION,
      SUM(CASE WHEN b.account_code LIKE '10405%' THEN b.total_amount END) AS SUPPLIES_STOCK,
      SUM(CASE WHEN (b.account_code LIKE '10705%' OR b.account_code LIKE '11301%') THEN b.total_amount END) AS INTANGIBLE_ASSET,
      SUM(CASE WHEN (b.account_code LIKE '10705%' OR b.account_code LIKE '11301%') THEN b.total_amount END) AS SOFTWARE,

      /* Liabilities */
      SUM(CASE WHEN (
        b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%' OR
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%' OR
        b.account_code LIKE '20103%' OR b.account_code LIKE '20601%' OR b.account_code LIKE '203%' OR
        b.account_code IN ('2050104','2050105','2050106','2050107','2050108','2050109','2050110','2050111') OR
        b.account_code LIKE '20201%' OR b.account_code IN ('2010402','2010403','2010401')
      ) THEN b.total_amount END) AS LIABILITIES,

      /* Total Deposits */
      SUM(CASE WHEN (
        b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%' OR
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%' OR
        b.account_code LIKE '20103%'
      ) THEN b.total_amount END) AS TOTAL_DEPOSITS,

      /* Demand */
      SUM(CASE WHEN (b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%') THEN b.total_amount END) AS DEMAND_CURRENT_DEPOSITS,
      SUM(CASE WHEN (b.account_code = '2010101' OR b.account_code LIKE '2011%') THEN b.total_amount END) AS PUBLIC_ENTERPRISE_DEMAND,
      SUM(CASE WHEN b.account_code = '2010103' THEN b.total_amount END) AS COOPERATIVES_ASSOCIATIONS_DEMAND,
      SUM(CASE WHEN b.account_code IN ('2010104','2010126','2018005','2010127','2010128','2010129','2010130','2010131','2010132','2010133','2010136','2010137') THEN b.total_amount END) AS PRIVATE_SECTOR_DEMAND,
      SUM(CASE WHEN b.account_code IN ('2010113','2010114') THEN b.total_amount END) AS NR_FCY_ACCOUNT,
      SUM(CASE WHEN b.account_code IN ('2010119','2010120','2010121') THEN b.total_amount END) AS NR_NON_TRANSFERABLE_BIRR,
      SUM(CASE WHEN b.account_code IN ('2010116','2010117','2010118') THEN b.total_amount END) AS FCY_RETENTION_ACCOUNT,

      /* Saving */
      SUM(CASE WHEN (
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%'
      ) THEN b.total_amount END) AS SAVING_DEPOSIT,
      SUM(CASE WHEN b.account_code IN ('2010202','2010502') THEN b.total_amount END) AS SAVING_PUBLIC_ENTERPRISE,
      SUM(CASE WHEN b.account_code = '2010204' THEN b.total_amount END) AS SAVING_OTHER_COMMERCIAL_BANKS,
      SUM(CASE WHEN b.account_code = '2012001' THEN b.total_amount END) AS PENSION_FUND,
      SUM(CASE WHEN b.account_code IN ('2010203','2010206','2010207','2010503','2010504','2010506','2010603') THEN b.total_amount END) AS SAVING_COOPERATIVES,
      SUM(CASE WHEN (
        b.account_code IN ('2010201','2010501','2010505','2010601','2010604','2010208','2010209','2010701') OR
        b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR b.account_code LIKE '20130%' OR
        b.account_code LIKE '20140%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20150%' OR
        b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR b.account_code LIKE '20190%' OR
        b.account_code LIKE '20211%'
      ) THEN b.total_amount END) AS SAVING_PRIVATE,

      /* Time */
      SUM(CASE WHEN b.account_code LIKE '20103%' THEN b.total_amount END) AS TIME_FIXED,
      SUM(CASE WHEN b.account_code = '2010302' THEN b.total_amount END) AS TIME_PUBLIC_ENTERPRISE,
      SUM(CASE WHEN b.account_code = '2010304' THEN b.total_amount END) AS TIME_DOMESTIC_BANKS,
      SUM(CASE WHEN b.account_code = '2010303' THEN b.total_amount END) AS TIME_COOPERATIVES,
      SUM(CASE WHEN b.account_code = '2010301' THEN b.total_amount END) AS TIME_PRIVATE,

      /* Borrowings */
      SUM(CASE WHEN b.account_code LIKE '20601%' THEN b.total_amount END) AS BORROWINGS,
      SUM(CASE WHEN b.account_code LIKE '20601%' THEN b.total_amount END) AS LOCAL_BORROWINGS,
      SUM(CASE WHEN b.account_code LIKE '20601%' THEN b.total_amount END) AS LONG_TERM_BORROWINGS,
      SUM(CASE WHEN b.account_code IN ('2060103','2060104') THEN b.total_amount END) AS BANKS_BORROWINGS,

      /* Creditors / Other accounts */
      SUM(CASE WHEN b.account_code LIKE '203%' THEN b.total_amount END) AS SUNDRY_CREDITORS,
      SUM(CASE WHEN b.account_code IN ('2050104','2050105','2050106','2050107','2050108','2050109','2050110','2050111') THEN b.total_amount END) AS PROVISION_TAXATION,
      SUM(CASE WHEN (b.account_code LIKE '20201%' OR b.account_code IN ('2010402','2010403','2010401')) THEN b.total_amount END) AS OTHER_ACCOUNT,
      SUM(CASE WHEN b.account_code = '2010401' THEN b.total_amount END) AS LC_MARGIN_HELD,
      SUM(CASE WHEN (b.account_code LIKE '20201%' OR b.account_code IN ('2010402','2010403')) THEN b.total_amount END) AS OTHER_ACCOUNTS_OTHERS,

      /* Capital */
      SUM(CASE WHEN b.account_code IN ('3010101','3010102') THEN b.total_amount END) AS CAPITAL_RESERVE,
      SUM(CASE WHEN b.account_code = '3010101' THEN b.total_amount END) AS PAIDUP_CAPITAL,
      SUM(CASE WHEN b.account_code = '3010102' THEN b.total_amount END) AS LEGAL_RESERVE,
      SUM(CASE WHEN b.account_code = '3010111' THEN b.total_amount END) AS PROVISIONAL_PL,
      SUM(CASE WHEN b.account_code IN ('3010111','3010101','3010102') THEN b.total_amount END) AS NET_WORTH,

      /* Total Liabilities + Net Worth */
      SUM(CASE WHEN (
        b.account_code LIKE '20101%' OR b.account_code LIKE '20180%' OR b.account_code LIKE '2011%' OR
        b.account_code LIKE '20102%' OR b.account_code LIKE '20105%' OR b.account_code LIKE '20106%' OR
        b.account_code LIKE '20107%' OR b.account_code LIKE '20108%' OR b.account_code LIKE '20109%' OR
        b.account_code LIKE '20120%' OR b.account_code LIKE '20130%' OR b.account_code LIKE '20140%' OR
        b.account_code LIKE '20150%' OR b.account_code LIKE '20160%' OR b.account_code LIKE '20170%' OR
        b.account_code LIKE '20190%' OR b.account_code LIKE '20141%' OR b.account_code LIKE '20211%' OR
        b.account_code LIKE '20103%' OR b.account_code LIKE '20601%' OR b.account_code LIKE '203%' OR
        b.account_code IN ('2050104','2050105','2050106','2050107','2050108','2050109','2050110','2050111') OR
        b.account_code LIKE '20201%' OR b.account_code IN ('2010402','2010403','2010401') OR
        b.account_code IN ('3010111','3010101','3010102')
      ) THEN b.total_amount END) AS TOTAL_LIABILITIES_NET_WORTH
    FROM FCUBSLIVE.balance_sheet b
    JOIN latest_balance_date lbd ON b.as_on_date = lbd.as_on_date
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });
  if (!result.rows.length) {
    logger.warn('No balance sheet row returned.');
    return {};
  }

  /* ------------------------------------------------------------------ */
  /*  Divide every numeric value by 1,000,000 — this matches the         */
  /*  original business SQL (each CASE has "/1000000"). The config then  */
  /*  builds its derived totals from already-divided numbers, so every   */
  /*  field ends up in "Millions of ETB".                                */
  /* ------------------------------------------------------------------ */
  const row = result.rows[0];
  const scaled = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      scaled[key] = 0;
      continue;
    }
    const n = typeof value === 'number' ? value : parseFloat(value);
    scaled[key] = Number.isFinite(n) ? n / AMOUNT_DIVISOR : 0;
  }

  logger.info('Fetched Monthly Balance Sheet data (amounts in Millions of ETB).');
  return scaled;
}

/* ------------------------------------------------------------------ */
function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}