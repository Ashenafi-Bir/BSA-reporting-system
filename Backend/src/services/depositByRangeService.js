import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Fetch deposit-by-range data for a given date.
 * Uses the endDate as the reporting date (month-end).
 */
export async function fetchDepositByRangeData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositByRangeData');
  }

  const todt = formatOracleDate(endDate);
  logger.info(`Fetching deposit by range data as of ${todt}`);

  const query = `
    WITH eligible_accounts AS (
      SELECT
        C.CUST_AC_NO AS ACC,
        C.ACCOUNT_TYPE
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C' AND C.MAKER_DT_STAMP > :todt)
    ),
    account_latest_balance AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.BKG_DATE,
        A.LCY_CLOSING_BAL,
        C.ACCOUNT_TYPE,
        ROW_NUMBER() OVER (PARTITION BY A.ACCOUNT ORDER BY A.BKG_DATE DESC) AS RN
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY A
      JOIN eligible_accounts C ON C.ACC = A.ACCOUNT
      WHERE A.BKG_DATE <= :todt
        AND LENGTH(A.ACCOUNT) = 16
    ),
    base_data AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.BKG_DATE,
        A.LCY_CLOSING_BAL,
        A.ACCOUNT_TYPE,
        CASE
          WHEN A.LCY_CLOSING_BAL <= 100000 THEN 'UPTO_HUN'
          WHEN A.LCY_CLOSING_BAL <= 1000000 THEN 'UPTO_MIL'
          ELSE 'ABOVE_MIL'
        END AS BAL_BAND
      FROM FCUBSLIVE.account_latest_balance A
      WHERE A.RN = 1
        AND A.BRANCH_CODE <> '000'
        AND A.LCY_CLOSING_BAL > 0
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      -- Demand (U)
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN' THEN A.ACCOUNT END) AS Demand_upto_Hundred_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL' THEN A.ACCOUNT END) AS Demand_upto_Million_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_Above_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Above_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.ACCOUNT END) AS Demand_Above_Million_Account,
      -- Saving (S)
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN' THEN A.ACCOUNT END) AS Saving_upto_Hundred_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL' THEN A.ACCOUNT END) AS Saving_upto_Million_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_Above_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_Above_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.ACCOUNT END) AS Saving_Above_Million_Account,
      -- Time / Term Deposit (Y)
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN' THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN' THEN A.ACCOUNT END) AS TD_upto_Hundred_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL' THEN A.ACCOUNT END) AS TD_upto_Million_Account,
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_Above_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL' THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_Above_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL' THEN A.ACCOUNT END) AS TD_Above_Million_Account
    FROM FCUBSLIVE.base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { todt });
  const rows = result.rows;

  // Map region names from SQL to display names
  const regionNameMap = {
    'ADDIS ABABA': 'Addis Ababa',
    'AFAR': 'Afar',
    'AMHARA': 'Amhara',
    'BENSHANGUL': 'Benishangul',
    'DIRE DAWA': 'Dire Dawa',
    'GAMBELLA': 'Gambela',
    'HARARI': 'Harari',
    'OROMIA': 'Oromia',
    'SOMALI': 'Somalia',
    'TIGRAY': 'Tigray',
    'SIDAMA': 'Sidama',
    'SOUTH WEST ETHIOPIA': 'SWERS',
    'CENTRAL ETHIOPIA': 'CERS',
    'SOUTHERN ETHIOPIA': 'SERS',
  };

  const allRegions = [
    'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
    'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray',
    'Sidama', 'SWERS', 'CERS', 'SERS'
  ];

  // Initialize rawData with all regions (all zeros)
  const emptyRow = (type = 'total') => ({
    upToHundred: { amount: 0, depositors: 0, accounts: 0 },
    upToMillion: { amount: 0, depositors: 0, accounts: 0 },
    aboveMillion: { amount: 0, depositors: 0, accounts: 0 },
    totals: { amount: 0, depositors: 0, accounts: 0 }
  });

  const rawData = {};
  allRegions.forEach(region => {
    rawData[region] = {
      total: emptyRow('total'),
      demand: emptyRow('demand'),
      saving: emptyRow('saving'),
      time: emptyRow('time'),
      urban: emptyRow('urban'),
      rural: emptyRow('rural')
    };
  });

  // Fill with SQL results
  rows.forEach(row => {
    const dbRegion = row.BREGION?.trim().toUpperCase() || '';
    const region = regionNameMap[dbRegion];
    if (!region || !rawData[region]) {
      logger.warn(`Unknown region: ${dbRegion}, skipping`);
      return;
    }

    const r = rawData[region];

    // Demand
    r.demand.upToHundred.amount = row.DEMAND_UPTO_HUNDRED || 0;
    r.demand.upToHundred.depositors = row.DEMAND_UPTO_HUNDRED_DEPOSITOR || 0;
    r.demand.upToHundred.accounts = row.DEMAND_UPTO_HUNDRED_ACCOUNT || 0;

    r.demand.upToMillion.amount = row.DEMAND_UPTO_MILLION || 0;
    r.demand.upToMillion.depositors = row.DEMAND_UPTO_MILLION_DEPOSITOR || 0;
    r.demand.upToMillion.accounts = row.DEMAND_UPTO_MILLION_ACCOUNT || 0;

    r.demand.aboveMillion.amount = row.DEMAND_ABOVE_MILLION || 0;
    r.demand.aboveMillion.depositors = row.DEMAND_ABOVE_MILLION_DEPOSITOR || 0;
    r.demand.aboveMillion.accounts = row.DEMAND_ABOVE_MILLION_ACCOUNT || 0;

    // Saving
    r.saving.upToHundred.amount = row.SAVING_UPTO_HUNDRED || 0;
    r.saving.upToHundred.depositors = row.SAVING_UPTO_HUNDRED_DEPOSITOR || 0;
    r.saving.upToHundred.accounts = row.SAVING_UPTO_HUNDRED_ACCOUNT || 0;

    r.saving.upToMillion.amount = row.SAVING_UPTO_MILLION || 0;
    r.saving.upToMillion.depositors = row.SAVING_UPTO_MILLION_DEPOSITOR || 0;
    r.saving.upToMillion.accounts = row.SAVING_UPTO_MILLION_ACCOUNT || 0;

    r.saving.aboveMillion.amount = row.SAVING_ABOVE_MILLION || 0;
    r.saving.aboveMillion.depositors = row.SAVING_ABOVE_MILLION_DEPOSITOR || 0;
    r.saving.aboveMillion.accounts = row.SAVING_ABOVE_MILLION_ACCOUNT || 0;

    // Time (TD)
    r.time.upToHundred.amount = row.TD_UPTO_HUNDRED || 0;
    r.time.upToHundred.depositors = row.TD_UPTO_HUNDRED_DEPOSITOR || 0;
    r.time.upToHundred.accounts = row.TD_UPTO_HUNDRED_ACCOUNT || 0;

    r.time.upToMillion.amount = row.TD_UPTO_MILLION || 0;
    r.time.upToMillion.depositors = row.TD_UPTO_MILLION_DEPOSITOR || 0;
    r.time.upToMillion.accounts = row.TD_UPTO_MILLION_ACCOUNT || 0;

    r.time.aboveMillion.amount = row.TD_ABOVE_MILLION || 0;
    r.time.aboveMillion.depositors = row.TD_ABOVE_MILLION_DEPOSITOR || 0;
    r.time.aboveMillion.accounts = row.TD_ABOVE_MILLION_ACCOUNT || 0;

    // Compute total = demand + saving + time
    ['upToHundred', 'upToMillion', 'aboveMillion'].forEach(band => {
      r.total[band].amount = r.demand[band].amount + r.saving[band].amount + r.time[band].amount;
      r.total[band].depositors = r.demand[band].depositors + r.saving[band].depositors + r.time[band].depositors;
      r.total[band].accounts = r.demand[band].accounts + r.saving[band].accounts + r.time[band].accounts;
    });

    // Totals across bands for each product and total
    ['demand', 'saving', 'time', 'total'].forEach(type => {
      const obj = r[type];
      obj.totals.amount = obj.upToHundred.amount + obj.upToMillion.amount + obj.aboveMillion.amount;
      obj.totals.depositors = obj.upToHundred.depositors + obj.upToMillion.depositors + obj.aboveMillion.depositors;
      obj.totals.accounts = obj.upToHundred.accounts + obj.upToMillion.accounts + obj.aboveMillion.accounts;
    });

    // Urban = total (all branches are urban)
    r.urban = JSON.parse(JSON.stringify(r.total));

    // Rural = all zeros (already)
  });

  logger.info(`Fetched deposit by range data for ${Object.keys(rawData).length} regions.`);
  return rawData;
}

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}