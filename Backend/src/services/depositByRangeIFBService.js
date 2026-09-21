import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

const REGION_NAME_MAP = {
  'ADDIS ABABA': 'Addis Ababa',
  'ADDIS ABEBDA': 'Addis Ababa',
  'AFAR': 'Afar',
  'AMHARA': 'Amhara',
  'BENSHANGUL': 'Benishangul',
  'BENISHANGUL': 'Benishangul',
  'BENISHANGUL-GUMUZ': 'Benishangul',
  'BENISHANGUL GUMUZ': 'Benishangul',
  'DIRE DAWA': 'Dire Dawa',
  'DIREDAWA': 'Dire Dawa',
  'GAMBELLA': 'Gambela',
  'GAMBELA': 'Gambela',
  'HARARI': 'Harari',
  'OROMIA': 'Oromia',
  'OROMIYA': 'Oromia',
  'SOMALI': 'Somalia',
  'SOMALIA': 'Somalia',
  'TIGRAY': 'Tigray',
  'TIGRAY REGION': 'Tigray',
  'SIDAMA': 'Sidama',
  'SIDAMA REGION': 'Sidama',
  'SOUTH WEST ETHIOPIA': 'SWERS',
  'SOUTH WEST ETHIOPIA REGION': 'SWERS',
  'SOUTHWEST ETHIOPIA': 'SWERS',
  'CENTRAL ETHIOPIA': 'CERS',
  'CENTRAL ETHIOPIA REGION': 'CERS',
  'SOUTHERN ETHIOPIA': 'SERS',
  'SOUTH ETHIOPIA': 'SERS',
  'SOUTHERN ETHIOPIA REGION': 'SERS',
  'SNNP': null,
  'SOUTHERN NATIONS': null,
  'SOUTHERN NATIONS NATIONALITIES AND PEOPLES': null,
};

export const TARGET_REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray', 'Sidama',
  'SWERS', 'CERS', 'SERS',
];

const AMOUNT_DIVISOR = 1_000_000;

/* ------------------------------------------------------------------ */
/*  Empty structure                                                    */
/* ------------------------------------------------------------------ */
const emptyMetric = () => ({ amount: 0, depositors: 0, accounts: 0 });
const emptyRanges = () => ({
  range1: emptyMetric(),
  range2: emptyMetric(),
  range3: emptyMetric(),
});
const emptyAccountType = () => ({
  demand:       emptyRanges(),
  saving:       emptyRanges(),
  time:         emptyRanges(),
  restricted:   emptyRanges(),   // SQL doesn't split — always zero
  unrestricted: emptyRanges(),   // SQL doesn't split — always zero
});
const emptyLocation = () => ({
  urban: emptyAccountType(),
  rural: emptyAccountType(),
});

/* ------------------------------------------------------------------ */
function num(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
const amt = (v) => num(v) / AMOUNT_DIVISOR;
const cnt = (v) => num(v);

/* ------------------------------------------------------------------ */
/*  Main fetcher                                                       */
/* ------------------------------------------------------------------ */
export async function fetchDepositByRangeIFB(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchDepositByRangeIFB');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositByRangeIFB');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching IFB Deposit by Range & Region data up to ${endDateStr}`);

  // The SQL is the exact same as the one you run manually — I only
  // substituted &TODT with :endDate so it can be bound safely.
  const query = `
    WITH eligible_accounts AS (
      SELECT
        C.CUST_AC_NO AS ACC,
        C.ACCOUNT_TYPE
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C'
             AND C.MAKER_DT_STAMP > TO_DATE(:endDate, 'DD-MON-YYYY'))
    ),
    account_latest_balance AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.BKG_DATE,
        A.LCY_CLOSING_BAL,
        C.ACCOUNT_TYPE,
        ROW_NUMBER() OVER (
          PARTITION BY A.ACCOUNT
          ORDER BY A.BKG_DATE DESC
        ) AS RN
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY A
      JOIN eligible_accounts C ON C.ACC = A.ACCOUNT
      WHERE A.BKG_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
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
          WHEN A.LCY_CLOSING_BAL <= 100000  THEN 'UPTO_HUN'
          WHEN A.LCY_CLOSING_BAL <= 1000000 THEN 'UPTO_MIL'
          ELSE 'ABOVE_MIL'
        END AS BAL_BAND
      FROM account_latest_balance A
      WHERE A.RN = 1
        AND A.BRANCH_CODE > '600'
        AND A.LCY_CLOSING_BAL > 0
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      'Urban' as "Urban/Rural",

      /* DEMAND - U */
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_HUN'
                 THEN A.ACCOUNT END) AS Demand_upto_Hundred_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'UPTO_MIL'
                 THEN A.ACCOUNT END) AS Demand_upto_Million_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Demand_Above_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Demand_Above_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'U' AND A.BAL_BAND = 'ABOVE_MIL'
                 THEN A.ACCOUNT END) AS Demand_Above_Million_Account,

      /* SAVING - S */
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_HUN'
                 THEN A.ACCOUNT END) AS Saving_upto_Hundred_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'UPTO_MIL'
                 THEN A.ACCOUNT END) AS Saving_upto_Million_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS Saving_Above_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS Saving_Above_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'S' AND A.BAL_BAND = 'ABOVE_MIL'
                 THEN A.ACCOUNT END) AS Saving_Above_Million_Account,

      /* TERM DEPOSIT - Y */
      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_upto_Hundred,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_upto_Hundred_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_HUN'
                 THEN A.ACCOUNT END) AS TD_upto_Hundred_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_upto_Million,
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS TD_upto_Million_Depositor,
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'UPTO_MIL'
                 THEN A.ACCOUNT END) AS TD_upto_Million_Account,

      SUM(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL'
               THEN A.LCY_CLOSING_BAL ELSE 0 END) AS TD_Above_Million,
      /* NOTE: alias intentionally preserves the "TTD" typo from your SQL */
      COUNT(DISTINCT CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL'
                          THEN SUBSTR(A.ACCOUNT,4,7) END) AS TTD_Above_Million_Depositor,
      /* NOTE: alias intentionally preserves the "_Count" suffix from your SQL */
      COUNT(CASE WHEN A.ACCOUNT_TYPE = 'Y' AND A.BAL_BAND = 'ABOVE_MIL'
                 THEN A.ACCOUNT END) AS TD_Above_Million_Count
    FROM base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });
  logger.info(`IFB query returned ${result.rows.length} region rows.`);

  const regionData = {};
  for (const region of TARGET_REGIONS) {
    regionData[region] = emptyLocation();
  }

  /* ------------------------------------------------------------------ */
  /*  Row -> nested structure (using the EXACT Oracle-uppercased keys)   */
  /* ------------------------------------------------------------------ */
  for (const row of result.rows) {
    const rawRegion = String(row.BREGION || '').toUpperCase().trim();
    const region = REGION_NAME_MAP[rawRegion];
    if (!region) continue;

    const urban = regionData[region].urban;

    // ---- DEMAND ----
    urban.demand.range1 = {
      amount:     amt(row.DEMAND_UPTO_HUNDRED),
      depositors: cnt(row.DEMAND_UPTO_HUNDRED_DEPOSITOR),
      accounts:   cnt(row.DEMAND_UPTO_HUNDRED_ACCOUNT),
    };
    urban.demand.range2 = {
      amount:     amt(row.DEMAND_UPTO_MILLION),
      depositors: cnt(row.DEMAND_UPTO_MILLION_DEPOSITOR),
      accounts:   cnt(row.DEMAND_UPTO_MILLION_ACCOUNT),
    };
    urban.demand.range3 = {
      amount:     amt(row.DEMAND_ABOVE_MILLION),
      depositors: cnt(row.DEMAND_ABOVE_MILLION_DEPOSITOR),
      accounts:   cnt(row.DEMAND_ABOVE_MILLION_ACCOUNT),
    };

    // ---- SAVING ----
    urban.saving.range1 = {
      amount:     amt(row.SAVING_UPTO_HUNDRED),
      depositors: cnt(row.SAVING_UPTO_HUNDRED_DEPOSITOR),
      accounts:   cnt(row.SAVING_UPTO_HUNDRED_ACCOUNT),
    };
    urban.saving.range2 = {
      amount:     amt(row.SAVING_UPTO_MILLION),
      depositors: cnt(row.SAVING_UPTO_MILLION_DEPOSITOR),
      accounts:   cnt(row.SAVING_UPTO_MILLION_ACCOUNT),
    };
    urban.saving.range3 = {
      amount:     amt(row.SAVING_ABOVE_MILLION),
      depositors: cnt(row.SAVING_ABOVE_MILLION_DEPOSITOR),
      accounts:   cnt(row.SAVING_ABOVE_MILLION_ACCOUNT),
    };

    // ---- TIME (TD) ----
    urban.time.range1 = {
      amount:     amt(row.TD_UPTO_HUNDRED),
      depositors: cnt(row.TD_UPTO_HUNDRED_DEPOSITOR),
      accounts:   cnt(row.TD_UPTO_HUNDRED_ACCOUNT),
    };
    urban.time.range2 = {
      amount:     amt(row.TD_UPTO_MILLION),
      depositors: cnt(row.TD_UPTO_MILLION_DEPOSITOR),
      accounts:   cnt(row.TD_UPTO_MILLION_ACCOUNT),
    };
    urban.time.range3 = {
      amount:     amt(row.TD_ABOVE_MILLION),
      // preserve the "TTD" typo in the alias you supplied
      depositors: cnt(row.TTD_ABOVE_MILLION_DEPOSITOR),
      // preserve the "_Count" suffix in the alias you supplied
      accounts:   cnt(row.TD_ABOVE_MILLION_COUNT),
    };
  }

  logger.info(
    `Fetched IFB Deposit-by-Range data for ${Object.keys(regionData).length} regions (amounts in Millions of Birr).`
  );
  return regionData;
}

/* ------------------------------------------------------------------ */
function formatOracleDate(date) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day   = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
}