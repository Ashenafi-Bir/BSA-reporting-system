import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

const CURRENCIES = ['USD', 'EUR', 'CHF', 'GBP', 'JPY', 'DJF', 'KES', 'INR', 'DKK', 'SEK', 'SAR', 'CAD', 'AED', 'AUD', 'CNY', 'NOK', 'KWD', 'Others'];

// ============================================================
// RETRY WRAPPER FOR ORACLE QUERIES
// ============================================================
async function executeWithRetry(queryFn, maxRetries = 3, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      logger.warn(`Oracle query attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt < maxRetries) {
        logger.info(`⏳ Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        delayMs *= 1.5;
      }
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// HOLIDAY FUNCTIONS
// ============================================================

/**
 * Fetch the holiday string for a given month and year.
 * Returns a string of 'H' and 'W' where each character represents a day (1-indexed).
 */
async function getHolidayString(year, month) {
  const query = `
    SELECT HOLIDAY_LIST
    FROM FCUBSLIVE.STTM_LCL_HOLIDAY
    WHERE YEAR = :year
      AND MONTH = :month
      AND BRANCH_CODE = '000'
  `;
  const result = await executeOracleQuery(query, { year, month });
  if (!result.rows || result.rows.length === 0) {
    throw new Error(`No holiday data found for ${year}-${month}`);
  }
  return result.rows[0].HOLIDAY_LIST;
}

/**
 * Check if a given date is a holiday.
 * Uses the holiday string from STTM_LCL_HOLIDAY ('H' = holiday, 'W' = working day).
 */
export async function isHoliday(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  try {
    const holidayString = await getHolidayString(year, month);
    if (day > holidayString.length) {
      logger.warn(`Holiday string length ${holidayString.length} is shorter than day ${day} for ${year}-${month}. Treating as working day.`);
      return false;
    }
    const status = holidayString[day - 1];
    return status === 'H';
  } catch (error) {
    logger.error(`Failed to get holiday status for ${year}-${month}: ${error.message}`);
    return false; // fallback: treat as working day
  }
}

/**
 * Find the most recent non‑holiday date before or on the given reference date.
 * Goes back up to 30 days.
 */
export async function getLastWorkingDayBefore(referenceDate) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  // Start one day before reference
  date.setDate(date.getDate() - 1);
  const maxDaysBack = 30;

  for (let i = 0; i < maxDaysBack; i++) {
    const isHolidayFlag = await isHoliday(date);
    if (!isHolidayFlag) {
      logger.info(`✅ Found last working day before reference: ${formatOracleDate(date)}`);
      return date;
    }
    date.setDate(date.getDate() - 1);
  }

  // Fallback: return yesterday
  logger.warn(`No working day found in last ${maxDaysBack} days. Using yesterday.`);
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

// ============================================================
// FETCH CBS DATA (with retry)
// ============================================================
export async function fetchCbsData(startDate, endDate) {
  return await executeWithRetry(async () => {
    if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw new Error('Invalid endDate provided');
    }
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      throw new Error('Invalid startDate provided');
    }

    const reportDate = endDate;
    const oracleDate = formatOracleDate(reportDate);
    logger.info(`Fetching CBS data for date: ${oracleDate}`);

    const startTime = Date.now();

    const [balanceResult, forwardAndLCResult, rates] = await Promise.all([
      executeOracleQuery(getBalanceSheetQuery(), { reportDate: oracleDate }),
      executeOracleQuery(getForwardSaleAndLetterOfCreditQuery(), { reportDate: oracleDate }),
      fetchExchangeRates(oracleDate),
    ]);

    const elapsed = Date.now() - startTime;
    logger.info(`All CBS queries completed in ${elapsed}ms`);

    const rawBalances = balanceResult.rows?.[0] || {};
    const forwardAndLC = forwardAndLCResult.rows?.[0] || {};

    const balances = {};
    for (const key of Object.keys(rawBalances)) {
      balances[key] = parseFloat(rawBalances[key]) / 1000 || 0;
    }
    const forwardLC = {};
    for (const key of Object.keys(forwardAndLC)) {
      forwardLC[key] = parseFloat(forwardAndLC[key]) / 1000 || 0;
    }

    const rawData = {
      currencyOnHand: {},
      dueFromBanks: {},
      chequesInTransit: {},
      loansAdvances: {},
      accruedInterestReceivables: {},
      otherAssets: {},
      undeliveredSpotPurchase: {},
      forwardPurchase: {},
      optionsSwapsDerivatives: {},
      offBalanceOtherAssets: {},
      dueToBanksAbroad: {},
      foreignCurrencyDeposits: {},
      borrowings: {},
      accruedInterestPayables: {},
      otherLiabilities: {},
      undeliveredSpotSales: {},
      forwardSales: {},
      liabOptionsSwapsDerivatives: {},
      letterOfCredit: {},
      guarantees: {},
      liabOtherLiabilities: {},
      midExchangeRates: rates,
      tier1Capital: 0,
    };

    rawData.currencyOnHand['USD'] = balances.CASH_ON_HAND_USD || 0;
    rawData.currencyOnHand['EUR'] = balances.CASH_ON_HAND_EUR || 0;
    rawData.currencyOnHand['GBP'] = balances.CASH_ON_HAND_GBP || 0;

    rawData.dueFromBanks['USD'] = balances.CORRESPONDENT_USD || 0;
    rawData.dueFromBanks['EUR'] = balances.CORRESPONDENT_EUR || 0;
    rawData.dueFromBanks['GBP'] = balances.CORRESPONDENT_GBP || 0;
    rawData.dueFromBanks['JPY'] = balances.CORRESPONDENT_JPY || 0;

    rawData.chequesInTransit['USD'] = balances.UNCLEARED_EFFECTS || 0;

    const retentionUSD = balances.RETENTION_USD || 0;
    const retentionGBP = balances.RETENTION_GBP || 0;
    const retentionEUR = balances.RETENTION_EUR || 0;
    const diasporaUSD = balances.DIASPORA_DEPOSIT_USD || 0;
    const diasporaGBP = balances.DIASPORA_DEPOSIT_GBP || 0;
    const diasporaEUR = balances.DIASPORA_DEPOSIT_EUR || 0;
    const cashCollateral = balances.CASH_COLLATERAL || 0;

    rawData.foreignCurrencyDeposits['USD'] = retentionUSD + diasporaUSD + cashCollateral;
    rawData.foreignCurrencyDeposits['GBP'] = retentionGBP + diasporaGBP;
    rawData.foreignCurrencyDeposits['EUR'] = retentionEUR + diasporaEUR;

    rawData.otherLiabilities['USD'] = 0;
    rawData.tier1Capital = (balances.PAID_UP_CAPITAL || 0) + (balances.LEGAL_RESERVE || 0);

    rawData.forwardSales['USD'] = forwardLC.FORWARD_SALE || 0;
    rawData.letterOfCredit['USD'] = forwardLC.LETTER_OF_CREDIT || 0;

    logger.info('CBS data assembled successfully.');
    return rawData;
  }, 3, 2000);
}

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// ---------- Original balance_sheet query ----------
function getBalanceSheetQuery() {
  return `
    WITH latest_balance_date AS (
      SELECT MAX(as_on_date) AS as_on_date
      FROM FCUBSLIVE.balance_sheet
      WHERE as_on_date <= TO_DATE(:reportDate, 'DD-MON-YYYY')
    ),
    latest_rates AS (
      SELECT
        ccy1,
        mid_rate,
        ROW_NUMBER() OVER (PARTITION BY ccy1 ORDER BY rate_date DESC) AS rn
      FROM FCUBSLIVE.CYTB_RATES_HISTORY
      WHERE rate_type = 'STANDARD'
        AND branch_code = '002'
        AND ccy1 IN ('USD','GBP','EUR','JPY','CHF','DJF','KES','INR','DKK','SEK','SAR','CAD','AED','AUD','CNY','NOK','KWD')
        AND rate_date <= TO_DATE(:reportDate, 'DD-MON-YYYY')
    ),
    aggregated_balances AS (
      SELECT
        b.account_code,
        b.branch,
        SUM(b.fcy_amount) AS total_fcy_amount,
        SUM(b.lcy_amount) AS total_lcy_amount
      FROM FCUBSLIVE.balance_sheet b
      JOIN latest_balance_date lbd ON b.as_on_date = lbd.as_on_date
      WHERE b.account_code IN (
        '1010201','1010202','1010203',
        '1020402','1020403','1020405','1020410',
        '1020413','1020416','1020418','1020419',
        '1020422','1020427','1020430','1020435',
        '1020438','1020421','1020425','1020437','1030202',
        '1020406','1020408','1020415','1020423','1020431',
        '1020401','1020404','1020407','1020414',
        '1020417','1020420','1020426','1020428',
        '1020429','1020432','1020434','1020436',
        '1020424','1020433','1020409',
        '1040201','1040211',
        '2010113','2010116','2010115','2010118',
        '2010114','2010117',
        '2014001','2010119','2014002','2010121',
        '2014003','2010120',
        '2010126',
        '3010101','3010102'
      )
      GROUP BY b.account_code, b.branch
    )
    SELECT
      COALESCE(SUM(CASE WHEN a.account_code = '1010201'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS CASH_ON_HAND_USD,
      COALESCE(SUM(CASE WHEN a.account_code = '1010202'
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS CASH_ON_HAND_GBP,
      COALESCE(SUM(CASE WHEN a.account_code = '1010203'
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS CASH_ON_HAND_EUR,
      COALESCE(SUM(CASE WHEN a.account_code IN (
        '1020402','1020403','1020405','1020410',
        '1020413','1020416','1020418','1020419',
        '1020422','1020427','1020430','1020435',
        '1020438','1020421','1020425','1020437','1030202'
      ) THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS CORRESPONDENT_USD,
      COALESCE(SUM(CASE WHEN a.account_code IN (
        '1020406','1020408','1020415','1020423','1020431'
      ) THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS CORRESPONDENT_GBP,
      COALESCE(SUM(CASE WHEN a.account_code IN (
        '1020401','1020404','1020407','1020414',
        '1020417','1020420','1020426','1020428',
        '1020429','1020432','1020434','1020436',
        '1020424','1020433'
      ) THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS CORRESPONDENT_EUR,
      COALESCE(SUM(CASE WHEN a.account_code = '1020409'
        THEN a.total_fcy_amount / NULLIF(jpy.mid_rate, 0) END), 0) AS CORRESPONDENT_JPY,
      COALESCE(SUM(CASE WHEN a.account_code IN ('1040201','1040211') AND a.branch = '002'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS UNCLEARED_EFFECTS,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010113','2010116')
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS RETENTION_USD,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010115','2010118')
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS RETENTION_GBP,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010114','2010117')
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS RETENTION_EUR,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014001','2010119')
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_USD,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014002','2010121')
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_GBP,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014003','2010120')
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_EUR,
      COALESCE(SUM(CASE WHEN a.account_code = '2010126'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS CASH_COLLATERAL,
      COALESCE(SUM(CASE WHEN a.account_code = '3010101' THEN a.total_lcy_amount END), 0) AS PAID_UP_CAPITAL,
      COALESCE(SUM(CASE WHEN a.account_code = '3010102' THEN a.total_lcy_amount END), 0) AS LEGAL_RESERVE
    FROM aggregated_balances a
    LEFT JOIN latest_rates usd ON usd.ccy1 = 'USD' AND usd.rn = 1
    LEFT JOIN latest_rates gbp ON gbp.ccy1 = 'GBP' AND gbp.rn = 1
    LEFT JOIN latest_rates eur ON eur.ccy1 = 'EUR' AND eur.rn = 1
    LEFT JOIN latest_rates jpy ON jpy.ccy1 = 'JPY' AND jpy.rn = 1
  `;
}

// ---------- Query for Forward Sale and Letter of Credit ----------
function getForwardSaleAndLetterOfCreditQuery() {
  return `
    WITH latest_balance_date AS (
      SELECT
        acc,
        MAX(val_dt) AS val_dt
      FROM FCUBSLIVE.actb_vd_bal
      WHERE val_dt <= TO_DATE(:reportDate, 'DD-MON-YYYY')
        AND acc IN ('6010142','6010143','6010144','6010145')
      GROUP BY acc
    )
    SELECT
      COALESCE(SUM(
        CASE
          WHEN b.acc IN ('6010142','6010143','6010144')
          THEN b.bal * -1
          ELSE 0
        END
      ), 0) AS FORWARD_SALE,

      COALESCE(SUM(
        CASE
          WHEN b.acc = '6010145'
          THEN b.bal * -1
          ELSE 0
        END
      ), 0) AS LETTER_OF_CREDIT

    FROM FCUBSLIVE.actb_vd_bal b
    JOIN latest_balance_date lbd
      ON b.acc = lbd.acc
     AND b.val_dt = lbd.val_dt
  `;
}

// ---------- Fetch exchange rates ----------
async function fetchExchangeRates(oracleDate) {
  const query = `
    WITH latest_rates AS (
      SELECT
        ccy1,
        mid_rate,
        ROW_NUMBER() OVER (PARTITION BY ccy1 ORDER BY rate_date DESC) AS rn
      FROM FCUBSLIVE.CYTB_RATES_HISTORY
      WHERE rate_type = 'STANDARD'
        AND branch_code = '002'
        AND ccy1 IN ('USD','GBP','EUR','CHF')
        AND rate_date <= TO_DATE(:reportDate, 'DD-MON-YYYY')
    )
    SELECT ccy1, mid_rate FROM latest_rates WHERE rn = 1
  `;
  const result = await executeOracleQuery(query, { reportDate: oracleDate });
  const rateMap = {};
  if (result.rows) {
    for (const row of result.rows) {
      rateMap[row.CCY1] = parseFloat(row.MID_RATE);
    }
  }
  return rateMap;
}