import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Fetch deposit-by-sector-and-region data for a given date.
 * Uses the endDate as the reporting date (month-end).
 */
export async function fetchDepositBySectorData(startDate, endDate) {
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositBySectorData');
  }

  const todt = formatOracleDate(endDate);
  logger.info(`Fetching deposit by sector data as of ${todt}`);

  const query = `
    WITH eligible_accounts AS (
      SELECT C.CUST_AC_NO AS ACC
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C' AND TO_DATE(C.MAKER_DT_STAMP) > :todt)
    ),
    latest_dates AS (
      SELECT A.ACCOUNT, MAX(A.BKG_DATE) AS BKG_DATE
      FROM FCUBSLIVE.actb_accbal_history A
      JOIN eligible_accounts C ON C.ACC = A.ACCOUNT
      WHERE A.BKG_DATE <= :todt
      GROUP BY A.ACCOUNT
    ),
    base_data AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.LCY_CLOSING_BAL,
        SUBSTR(A.ACCOUNT, 11, 3) AS ACC_CODE,
        SUBSTR(A.ACCOUNT, 11, 1) AS ACC_GROUP
      FROM FCUBSLIVE.actb_accbal_history A
      JOIN latest_dates L
        ON L.ACCOUNT = A.ACCOUNT AND L.BKG_DATE = A.BKG_DATE
      WHERE A.BRANCH_CODE <> '000'
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      -- Demand
      SUM(CASE WHEN A.ACC_CODE = '101' THEN A.LCY_CLOSING_BAL END) AS Demand_Public_Ent,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '101' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Public_Ent_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '101' THEN A.ACCOUNT END) AS Demand_Public_Ent_Account,
      SUM(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127') THEN A.LCY_CLOSING_BAL END) AS Demand_Private,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127') THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Private_Depositor,
      COUNT(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127') THEN A.ACCOUNT END) AS Demand_Private_Account,
      SUM(CASE WHEN A.ACC_CODE = '107' THEN A.LCY_CLOSING_BAL END) AS Demand_Gove,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '107' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Gove_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '107' THEN A.ACCOUNT END) AS Demand_Gove_Account,
      SUM(CASE WHEN A.ACC_CODE = '102' THEN A.LCY_CLOSING_BAL END) AS Demand_Bank,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '102' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Bank_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '102' THEN A.ACCOUNT END) AS Demand_Bank_Account,
      SUM(CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN A.LCY_CLOSING_BAL END) AS Demand_Other,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Other_Depositor,
      COUNT(CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN A.ACCOUNT END) AS Demand_Other_Account,
      -- Saving
      SUM(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.LCY_CLOSING_BAL END) AS Saving_Public_Ent,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_Public_Ent_Depositor,
      COUNT(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.ACCOUNT END) AS Saving_Public_Ent_Account,
      SUM(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249') THEN A.LCY_CLOSING_BAL END) AS Saving_Private,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249') THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_Private_Depositor,
      COUNT(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249') THEN A.ACCOUNT END) AS Saving_Private_Account,
      SUM(CASE WHEN A.ACC_CODE = '204' THEN A.LCY_CLOSING_BAL END) AS Saving_Bank,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '204' THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_Bank_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '204' THEN A.ACCOUNT END) AS Saving_Bank_Account,
      -- Term Deposit
      SUM(CASE WHEN A.ACC_CODE = '302' THEN A.LCY_CLOSING_BAL END) AS TD_Public_Ent,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '302' THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_Public_Ent_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '302' THEN A.ACCOUNT END) AS TD_Public_Ent_Account,
      SUM(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.LCY_CLOSING_BAL END) AS TD_Private,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('303','305','301') THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_Private_Depositor,
      COUNT(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.ACCOUNT END) AS TD_Private_Account,
      SUM(CASE WHEN A.ACC_CODE = '304' THEN A.LCY_CLOSING_BAL END) AS TD_Bank,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '304' THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_Bank_Depositor,
      COUNT(CASE WHEN A.ACC_CODE = '304' THEN A.ACCOUNT END) AS TD_Bank_Account
    FROM FCUBSLIVE.base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { todt });
  const rows = result.rows;

  // Region name mapping (SQL output -> display name)
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
    'SOUTHERN ETHIOPIA': 'SERS'
  };

  const allRegions = [
    'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
    'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray',
    'Sidama', 'SWERS', 'CERS', 'SERS'
  ];

  // Sectors and their metrics
  const sectors = ['public', 'private', 'gov', 'banks', 'others'];
  const metrics = ['amount', 'depositors', 'accounts'];
  // Deposit types: total, demand, saving, time, urban, rural
  // urban = total, rural = 0

  // Initialize raw data
  const rawData = {};
  allRegions.forEach(region => {
    rawData[region] = {
      total: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } },
      demand: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } },
      saving: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } },
      time: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } },
      urban: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } },
      rural: { public: { amount: 0, depositors: 0, accounts: 0 }, private: { amount: 0, depositors: 0, accounts: 0 }, gov: { amount: 0, depositors: 0, accounts: 0 }, banks: { amount: 0, depositors: 0, accounts: 0 }, others: { amount: 0, depositors: 0, accounts: 0 } }
    };
  });

  // Populate with SQL results
  rows.forEach(row => {
    const dbRegion = row.BREGION?.trim().toUpperCase() || '';
    const region = regionNameMap[dbRegion];
    if (!region || !rawData[region]) {
      logger.warn(`Unknown region: ${dbRegion}, skipping`);
      return;
    }

    const r = rawData[region];

    // Demand
    r.demand.public.amount = row.DEMAND_PUBLIC_ENT || 0;
    r.demand.public.depositors = row.DEMAND_PUBLIC_ENT_DEPOSITOR || 0;
    r.demand.public.accounts = row.DEMAND_PUBLIC_ENT_ACCOUNT || 0;

    r.demand.private.amount = row.DEMAND_PRIVATE || 0;
    r.demand.private.depositors = row.DEMAND_PRIVATE_DEPOSITOR || 0;
    r.demand.private.accounts = row.DEMAND_PRIVATE_ACCOUNT || 0;

    r.demand.gov.amount = row.DEMAND_GOVE || 0;
    r.demand.gov.depositors = row.DEMAND_GOVE_DEPOSITOR || 0;
    r.demand.gov.accounts = row.DEMAND_GOVE_ACCOUNT || 0;

    r.demand.banks.amount = row.DEMAND_BANK || 0;
    r.demand.banks.depositors = row.DEMAND_BANK_DEPOSITOR || 0;
    r.demand.banks.accounts = row.DEMAND_BANK_ACCOUNT || 0;

    r.demand.others.amount = row.DEMAND_OTHER || 0;
    r.demand.others.depositors = row.DEMAND_OTHER_DEPOSITOR || 0;
    r.demand.others.accounts = row.DEMAND_OTHER_ACCOUNT || 0;

    // Saving
    r.saving.public.amount = row.SAVING_PUBLIC_ENT || 0;
    r.saving.public.depositors = row.SAVING_PUBLIC_ENT_DEPOSITOR || 0;
    r.saving.public.accounts = row.SAVING_PUBLIC_ENT_ACCOUNT || 0;

    r.saving.private.amount = row.SAVING_PRIVATE || 0;
    r.saving.private.depositors = row.SAVING_PRIVATE_DEPOSITOR || 0;
    r.saving.private.accounts = row.SAVING_PRIVATE_ACCOUNT || 0;

    // No saving for gov in SQL (no column), set 0
    r.saving.gov = { amount: 0, depositors: 0, accounts: 0 };

    r.saving.banks.amount = row.SAVING_BANK || 0;
    r.saving.banks.depositors = row.SAVING_BANK_DEPOSITOR || 0;
    r.saving.banks.accounts = row.SAVING_BANK_ACCOUNT || 0;

    // No saving for others in SQL, set 0
    r.saving.others = { amount: 0, depositors: 0, accounts: 0 };

    // Time (Term Deposit)
    r.time.public.amount = row.TD_PUBLIC_ENT || 0;
    r.time.public.depositors = row.TD_PUBLIC_ENT_DEPOSITOR || 0;
    r.time.public.accounts = row.TD_PUBLIC_ENT_ACCOUNT || 0;

    r.time.private.amount = row.TD_PRIVATE || 0;
    r.time.private.depositors = row.TD_PRIVATE_DEPOSITOR || 0;
    r.time.private.accounts = row.TD_PRIVATE_ACCOUNT || 0;

    // No gov for time in SQL, set 0
    r.time.gov = { amount: 0, depositors: 0, accounts: 0 };

    r.time.banks.amount = row.TD_BANK || 0;
    r.time.banks.depositors = row.TD_BANK_DEPOSITOR || 0;
    r.time.banks.accounts = row.TD_BANK_ACCOUNT || 0;

    // No others for time, set 0
    r.time.others = { amount: 0, depositors: 0, accounts: 0 };
  });

  // Compute totals per region: sum of demand, saving, time for each sector
  allRegions.forEach(region => {
    const r = rawData[region];
    ['public', 'private', 'gov', 'banks', 'others'].forEach(sector => {
      ['amount', 'depositors', 'accounts'].forEach(metric => {
        r.total[sector][metric] =
          (r.demand[sector][metric] || 0) +
          (r.saving[sector][metric] || 0) +
          (r.time[sector][metric] || 0);
      });
    });
    // Urban = total
    r.urban = JSON.parse(JSON.stringify(r.total));
    // Rural = all zeros (already)
  });

  logger.info(`Fetched deposit by sector data for ${allRegions.length} regions.`);
  return rawData;
}

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}