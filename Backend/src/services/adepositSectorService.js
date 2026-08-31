import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

function formatOracleDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Map region names from SQL (BRANCH_ADDR3) to standardized names used in report.
 */
const regionNameMap = {
  'ADDIS ABABA': 'Addis Ababa',
  'AFAR': 'Afar',
  'AMHARA': 'Amhara',
  'BENSHANGUL': 'Benishangul',
  'DIRE DAWA': 'Dire Dawa',
  'GAMBELLA': 'Gambela',
  'HARARI': 'Harari',
  'OROMIA': 'Oromia',
  'SNNP': 'SNNP',        // will be empty per note
  'SOMALI': 'Somalia',
  'TIGRAY': 'Tigray',
  'SIDAMA': 'Sidama',
  'SOUTH WEST ETHIOPIA': 'SWERS',
  'CENTRAL ETHIOPIA': 'CERS',
  'SOUTHERN ETHIOPIA': 'SERS'
};

const allRegions = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'SNNP', 'Somalia',
  'Tigray', 'Sidama', 'SWERS', 'CERS', 'SERS'
];

export async function fetchDepositBySectorData(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchDepositBySectorData');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositBySectorData');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching deposit by sector data as of ${endDateStr}`);

  // Use the provided SQL, replace &TODT with :endDate bind variable
  const query = `

    WITH eligible_accounts AS (
        SELECT
            C.CUST_AC_NO AS ACC
        FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
        WHERE C.RECORD_STAT = 'O'
           OR (
                C.RECORD_STAT = 'C'
                AND TO_DATE(C.MAKER_DT_STAMP) > TO_DATE(:endDate, 'DD-MON-YYYY')
              )
    ),
    latest_dates AS (
        SELECT
            A.ACC,
            MAX(A.VAL_DT) AS VAL_DT
        FROM FCUBSLIVE.ACTB_VD_BAL A
        JOIN eligible_accounts C
          ON C.ACC = A.ACC
        WHERE A.VAL_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
        GROUP BY A.ACC
    ),
    base_data AS (
        SELECT
            A.BRN,
            A.ACC,
            A.LCY_BAL,
            SUBSTR(A.ACC, 11, 3) AS ACC_CODE,
            SUBSTR(A.ACC, 11, 1) AS ACC_GROUP
        FROM FCUBSLIVE.ACTB_VD_BAL A
        JOIN latest_dates L
          ON L.ACC = A.ACC
         AND L.VAL_DT = A.VAL_DT
        WHERE A.BRN <> '000'
    )
    SELECT
        B.BRANCH_ADDR3 AS BREGION,
        -- Demand
        SUM(CASE WHEN A.ACC_CODE = '101' THEN A.LCY_BAL END) AS Demand_Public_Ent,
        COUNT(CASE WHEN A.ACC_CODE = '101' THEN A.ACC END) AS Demand_Public_Ent_Count,
        SUM(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125') THEN A.LCY_BAL END) AS Demand_Private,
        COUNT(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125') THEN A.ACC END) AS Demand_Private_Count,
        SUM(CASE WHEN A.ACC_CODE = '107' THEN A.LCY_BAL END) AS Demand_Gove,
        COUNT(CASE WHEN A.ACC_CODE = '107' THEN A.ACC END) AS Demand_Gove_Count,
        SUM(CASE WHEN A.ACC_CODE = '102' THEN A.LCY_BAL END) AS Demand_Bank,
        COUNT(CASE WHEN A.ACC_CODE = '102' THEN A.ACC END) AS Demand_Bank_Count,
        SUM(CASE WHEN A.ACC_GROUP = '4' AND A.LCY_BAL > 0 THEN A.LCY_BAL END) AS Demand_Other,
        COUNT(CASE WHEN A.ACC_GROUP = '4' AND A.LCY_BAL > 0 THEN A.ACC END) AS Demand_Other_Count,
        -- Saving
        SUM(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.LCY_BAL END) AS Saving_Public_Ent,
        COUNT(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.ACC END) AS Saving_Public_Ent_Count,
        SUM(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','249') THEN A.LCY_BAL END) AS Saving_Private,
        COUNT(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','249') THEN A.ACC END) AS Saving_Private_Count,
        SUM(CASE WHEN A.ACC_CODE = '204' THEN A.LCY_BAL END) AS Saving_Bank,
        COUNT(CASE WHEN A.ACC_CODE = '204' THEN A.ACC END) AS Saving_Bank_Count,
        -- Term Deposit
        SUM(CASE WHEN A.ACC_CODE = '302' THEN A.LCY_BAL END) AS TD_Public_Ent,
        COUNT(CASE WHEN A.ACC_CODE = '302' THEN A.ACC END) AS TD_Public_Ent_Count,
        SUM(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.LCY_BAL END) AS TD_Private,
        COUNT(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.ACC END) AS TD_Private_Count,
        SUM(CASE WHEN A.ACC_CODE = '304' THEN A.LCY_BAL END) AS TD_Bank,
        COUNT(CASE WHEN A.ACC_CODE = '304' THEN A.ACC END) AS TD_Bank_Count
    FROM base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRN
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });

  // Build a map: region name -> data object
  const rawMap = {};
  (result.rows || []).forEach(row => {
    const sqlRegion = row.BREGION ? row.BREGION.trim().toUpperCase() : '';
    const region = regionNameMap[sqlRegion] || sqlRegion; // fallback
    // If region not in our list, skip? but we'll include it as is.
    rawMap[region] = {
      demandPublicEnt: parseFloat(row.DEMAND_PUBLIC_ENT) || 0,
      demandPublicEntCount: parseFloat(row.DEMAND_PUBLIC_ENT_COUNT) || 0,
      demandPrivate: parseFloat(row.DEMAND_PRIVATE) || 0,
      demandPrivateCount: parseFloat(row.DEMAND_PRIVATE_COUNT) || 0,
      demandGove: parseFloat(row.DEMAND_GOVE) || 0,
      demandGoveCount: parseFloat(row.DEMAND_GOVE_COUNT) || 0,
      demandBank: parseFloat(row.DEMAND_BANK) || 0,
      demandBankCount: parseFloat(row.DEMAND_BANK_COUNT) || 0,
      demandOther: parseFloat(row.DEMAND_OTHER) || 0,
      demandOtherCount: parseFloat(row.DEMAND_OTHER_COUNT) || 0,
      savingPublicEnt: parseFloat(row.SAVING_PUBLIC_ENT) || 0,
      savingPublicEntCount: parseFloat(row.SAVING_PUBLIC_ENT_COUNT) || 0,
      savingPrivate: parseFloat(row.SAVING_PRIVATE) || 0,
      savingPrivateCount: parseFloat(row.SAVING_PRIVATE_COUNT) || 0,
      savingBank: parseFloat(row.SAVING_BANK) || 0,
      savingBankCount: parseFloat(row.SAVING_BANK_COUNT) || 0,
      // savingGove and savingOther are not present, default 0
      savingGove: 0,
      savingGoveCount: 0,
      savingOther: 0,
      savingOtherCount: 0,
      tdPublicEnt: parseFloat(row.TD_PUBLIC_ENT) || 0,
      tdPublicEntCount: parseFloat(row.TD_PUBLIC_ENT_COUNT) || 0,
      tdPrivate: parseFloat(row.TD_PRIVATE) || 0,
      tdPrivateCount: parseFloat(row.TD_PRIVATE_COUNT) || 0,
      tdBank: parseFloat(row.TD_BANK) || 0,
      tdBankCount: parseFloat(row.TD_BANK_COUNT) || 0,
      // tdGove and tdOther default 0
      tdGove: 0,
      tdGoveCount: 0,
      tdOther: 0,
      tdOtherCount: 0,
    };
  });

  // Ensure all regions exist in rawMap, fill missing with zeros
  allRegions.forEach(region => {
    if (!rawMap[region]) {
      rawMap[region] = {
        demandPublicEnt: 0,
        demandPublicEntCount: 0,
        demandPrivate: 0,
        demandPrivateCount: 0,
        demandGove: 0,
        demandGoveCount: 0,
        demandBank: 0,
        demandBankCount: 0,
        demandOther: 0,
        demandOtherCount: 0,
        savingPublicEnt: 0,
        savingPublicEntCount: 0,
        savingPrivate: 0,
        savingPrivateCount: 0,
        savingBank: 0,
        savingBankCount: 0,
        savingGove: 0,
        savingGoveCount: 0,
        savingOther: 0,
        savingOtherCount: 0,
        tdPublicEnt: 0,
        tdPublicEntCount: 0,
        tdPrivate: 0,
        tdPrivateCount: 0,
        tdBank: 0,
        tdBankCount: 0,
        tdGove: 0,
        tdGoveCount: 0,
        tdOther: 0,
        tdOtherCount: 0,
      };
    }
  });

  // Return the raw map (object keyed by region)
  logger.info(`Fetched deposit data for ${Object.keys(rawMap).length} regions.`);
  return rawMap;
}