import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

// List of currencies the report expects
const CURRENCIES = ['USD', 'EUR', 'CHF', 'GBP', 'JPY', 'DJF', 'KES', 'INR', 'DKK', 'SEK', 'SAR', 'CAD', 'AED', 'AUD', 'CNY', 'NOK', 'KWD', 'Others'];

export async function fetchCbsData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchCbsData');
  }
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchCbsData');
  }

  const reportDate = endDate;
  const oracleDate = formatOracleDate(reportDate);
  logger.info(`Fetching CBS data for date: ${oracleDate}`);

  // --- Run all independent queries in parallel ---
  const startTime = Date.now();

  const [balanceResult, forwardSales, letterOfCredit, rates] = await Promise.all([
    // 1. Main balance sheet query (returns amounts already divided by rate)
    executeOracleQuery(getBalanceQuery(), { reportDate: oracleDate }),
    // 2. Forward sales (hardcoded for now)
    fetchForwardSales(oracleDate),
    // 3. Letter of credit (hardcoded)
    fetchLetterOfCredit(oracleDate),
    // 4. Mid‑exchange rates
    fetchExchangeRates(oracleDate),
  ]);

  const elapsed = Date.now() - startTime;
  logger.info(`All CBS queries completed in ${elapsed}ms`);

  const rawBalances = balanceResult.rows?.[0] || {};

  // Divide all amounts by 1000 to convert to thousands
  const balances = {};
  for (const key of Object.keys(rawBalances)) {
    balances[key] = parseFloat(rawBalances[key]) / 1000 || 0;
  }

  // Build rawData
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

  // Map on‑balance sheet items
  rawData.currencyOnHand['USD'] = balances.CASH_ON_HAND_USD || 0;
  rawData.currencyOnHand['EUR'] = balances.CASH_ON_HAND_EUR || 0;
  rawData.currencyOnHand['GBP'] = balances.CASH_ON_HAND_GBP || 0;

  rawData.dueFromBanks['USD'] = balances.CORRESPONDENT_USD || 0;
  rawData.dueFromBanks['EUR'] = balances.CORRESPONDENT_EUR || 0;
  rawData.dueFromBanks['GBP'] = balances.CORRESPONDENT_GBP || 0;
  rawData.dueFromBanks['JPY'] = balances.CORRESPONDENT_JPY || 0;

  rawData.chequesInTransit['USD'] = balances.UNCLEARED_EFFECTS || 0;

  // Foreign Currency Deposits = Retention + Diaspora (+ Cash Collateral only for USD)
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

  // Other Liabilities – cash collateral is now in deposits
  rawData.otherLiabilities['USD'] = 0;

  // Tier 1 Capital (LCY) – also in thousands
  rawData.tier1Capital = (balances.PAID_UP_CAPITAL || 0) + (balances.LEGAL_RESERVE || 0);

  // Off‑balance sheet items
  rawData.forwardSales['USD'] = forwardSales;
  rawData.letterOfCredit['USD'] = letterOfCredit;

  logger.info('CBS data assembled successfully.');
  return rawData;
}

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getBalanceQuery() {
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
      -- Cash on Hand – divide by respective rate
      COALESCE(SUM(CASE WHEN a.account_code = '1010201'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS CASH_ON_HAND_USD,
      COALESCE(SUM(CASE WHEN a.account_code = '1010202'
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS CASH_ON_HAND_GBP,
      COALESCE(SUM(CASE WHEN a.account_code = '1010203'
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS CASH_ON_HAND_EUR,

      -- Correspondent
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

      -- Uncleared Effects (USD)
      COALESCE(SUM(CASE WHEN a.account_code IN ('1040201','1040211') AND a.branch = '002'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS UNCLEARED_EFFECTS,

      -- Retention
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010113','2010116')
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS RETENTION_USD,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010115','2010118')
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS RETENTION_GBP,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2010114','2010117')
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS RETENTION_EUR,

      -- Diaspora
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014001','2010119')
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_USD,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014002','2010121')
        THEN a.total_fcy_amount / NULLIF(gbp.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_GBP,
      COALESCE(SUM(CASE WHEN a.account_code IN ('2014003','2010120')
        THEN a.total_fcy_amount / NULLIF(eur.mid_rate, 0) END), 0) AS DIASPORA_DEPOSIT_EUR,

      -- Cash Collateral (USD)
      COALESCE(SUM(CASE WHEN a.account_code = '2010126'
        THEN a.total_fcy_amount / NULLIF(usd.mid_rate, 0) END), 0) AS CASH_COLLATERAL,

      -- Capital (LCY – no division)
      COALESCE(SUM(CASE WHEN a.account_code = '3010101' THEN a.total_lcy_amount END), 0) AS PAID_UP_CAPITAL,
      COALESCE(SUM(CASE WHEN a.account_code = '3010102' THEN a.total_lcy_amount END), 0) AS LEGAL_RESERVE

    FROM aggregated_balances a
    LEFT JOIN latest_rates usd ON usd.ccy1 = 'USD' AND usd.rn = 1
    LEFT JOIN latest_rates gbp ON gbp.ccy1 = 'GBP' AND gbp.rn = 1
    LEFT JOIN latest_rates eur ON eur.ccy1 = 'EUR' AND eur.rn = 1
    LEFT JOIN latest_rates jpy ON jpy.ccy1 = 'JPY' AND jpy.rn = 1
  `;
}

// These are now separate functions but will be called in parallel
async function fetchForwardSales(oracleDate) {
  // Replace with actual query when available
  // logger.warn('fetchForwardSales: using hardcoded value 5609.91');
  return 5609.91;
}

async function fetchLetterOfCredit(oracleDate) {
  // logger.warn('fetchLetterOfCredit: using hardcoded value 41.33');
  return 41.33;
}

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
        AND ccy1 IN ('USD','GBP','EUR','JPY','CHF','DJF','KES','INR','DKK','SEK','SAR','CAD','AED','AUD','CNY','NOK','KWD')
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
  const allCurrencies = ['USD','GBP','EUR','JPY','CHF','DJF','KES','INR','DKK','SEK','SAR','CAD','AED','AUD','CNY','NOK','KWD'];
  for (const curr of allCurrencies) {
    if (!rateMap[curr]) rateMap[curr] = 1;
  }
  rateMap['Others'] = 1;
  return rateMap;
}