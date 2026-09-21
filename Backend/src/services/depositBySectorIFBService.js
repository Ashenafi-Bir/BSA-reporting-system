import { executeOracleQuery } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Map raw CBS region names (BRANCH_ADDR3) -> display names used in the JSON.
 * SNNP is intentionally null (dissolved into SWERS / CERS / SERS).
 */
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
const emptyMetric = () => ({ amount: 0, depositors: 0, accounts: 0 });

const emptySector = () => ({
  pubEnt:  emptyMetric(),
  private: emptyMetric(),
  gov:     emptyMetric(),
  bank:    emptyMetric(),
  other:   emptyMetric(),
});

const emptyAccountType = () => ({
  demand:       emptySector(),
  saving:       emptySector(),
  restricted:   emptySector(),
  unrestricted: emptySector(),
});

const emptyLocation = () => ({
  urban: emptyAccountType(),
  rural: emptyAccountType(),
});

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
export async function fetchDepositBySectorIFB(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchDepositBySectorIFB');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchDepositBySectorIFB');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching IFB Deposit by Sector & Region data up to ${endDateStr}`);

  // -------------------------------------------------------------------
  // Semantics — matches the reference SQL exactly:
  //   1. eligible_accounts (RECORD_STAT = 'O' OR (C & MAKER_DT > end))
  //   2. For each such account, latest BKG_DATE <= endDate (across ALL
  //      branches — matches original `latest_dates` behaviour).
  //   3. Keep only the IFB branch row (BRANCH_CODE > '600').
  //
  // Speed — improved over reference:
  //   - ROW_NUMBER() replaces MAX + self-join  → single pass
  //   - SUBSTR(ACCOUNT,4,7) computed once      → reused 33× in aggregates
  //   - MATERIALIZE keeps the small base_data  → no re-evaluation
  // -------------------------------------------------------------------
  const query = `
    WITH eligible_accounts AS (
      SELECT C.CUST_AC_NO AS ACC
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT C
      WHERE C.RECORD_STAT = 'O'
         OR (C.RECORD_STAT = 'C'
             AND C.MAKER_DT_STAMP > TO_DATE(:endDate, 'DD-MON-YYYY'))
    ),
    ifb_rows AS (
      SELECT
        A.BRANCH_CODE,
        A.ACCOUNT,
        A.LCY_CLOSING_BAL,
        SUBSTR(A.ACCOUNT, 11, 3) AS ACC_CODE,
        SUBSTR(A.ACCOUNT, 4, 7)  AS CUST_ID,
        ROW_NUMBER() OVER (
          PARTITION BY A.ACCOUNT
          ORDER BY A.BKG_DATE DESC
        ) AS RN
      FROM FCUBSLIVE.ACTB_ACCBAL_HISTORY A
      JOIN eligible_accounts E ON E.ACC = A.ACCOUNT
      WHERE A.BKG_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    base_data AS (
      SELECT /*+ MATERIALIZE */
        R.BRANCH_CODE,
        R.ACCOUNT,
        R.LCY_CLOSING_BAL,
        R.ACC_CODE,
        R.CUST_ID
      FROM ifb_rows R
      WHERE R.RN = 1
        AND R.BRANCH_CODE > '600'
    )
    SELECT
      B.BRANCH_ADDR3 AS BREGION,
      'Urban' AS URBAN_RURAL,

      /* ---------- DEMAND ---------- */
      SUM(CASE WHEN A.ACC_CODE = '101' THEN A.LCY_CLOSING_BAL END) AS DEMAND_PUBLIC_ENT,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '101' THEN A.CUST_ID END) AS DEMAND_PUBLIC_ENT_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '101' THEN A.ACCOUNT END) AS DEMAND_PUBLIC_ENT_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127','121') THEN A.LCY_CLOSING_BAL END) AS DEMAND_PRIVATE,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127','121') THEN A.CUST_ID END) AS DEMAND_PRIVATET_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE IN ('115','116','114','103','104','105','108','109','110','111','112','113','117','118','119','501','502','503','122','123','124','125','126','127','121') THEN A.ACCOUNT END) AS DEMAND_PRIVATE_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE = '107' THEN A.LCY_CLOSING_BAL END) AS DEMAND_GOVE,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '107' THEN A.CUST_ID END) AS DEMAND_GOVE_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '107' THEN A.ACCOUNT END) AS DEMAND_GOVE_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE = '102' THEN A.LCY_CLOSING_BAL END) AS DEMAND_BANK,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '102' THEN A.CUST_ID END) AS DEMAND_BANK_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '102' THEN A.ACCOUNT END) AS DEMAND_BANK_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN A.LCY_CLOSING_BAL END) AS DEMAND_OTHER,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN A.CUST_ID END) AS DEMAND_OTHER_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE IN ('401','402','403','404','405','406','407','408','409','410','411','412','413') AND A.LCY_CLOSING_BAL > 0 THEN A.ACCOUNT END) AS DEMAND_OTHER_ACCOUNT,

      /* ---------- SAVING ---------- */
      SUM(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.LCY_CLOSING_BAL END) AS SAVING_PUBLIC_ENT,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.CUST_ID END) AS SAVING_PUBLIC_ENT_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE IN ('207','206','211','202','209','203','210','213','241','242') THEN A.ACCOUNT END) AS SAVING_PUBLIC_ENT_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249','229') THEN A.LCY_CLOSING_BAL END) AS SAVING_PRIVATE,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249','229') THEN A.CUST_ID END) AS SAVING_PRIVATE_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE IN ('212','214','216','217','220','225','226','221','222','224','201','215','219','227','228','208','218','223','205','230','231','232','233','234','235','236','237','238','239','240','243','244','245','246','247','248','249','229') THEN A.ACCOUNT END) AS SAVING_PRIVATE_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE = '204' THEN A.LCY_CLOSING_BAL END) AS SAVING_BANK,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '204' THEN A.CUST_ID END) AS SAVING_BANK_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '204' THEN A.ACCOUNT END) AS SAVING_BANK_ACCOUNT,

      /* ---------- TIME DEPOSIT ---------- */
      SUM(CASE WHEN A.ACC_CODE = '302' THEN A.LCY_CLOSING_BAL END) AS TD_PUBLIC_ENT,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '302' THEN A.CUST_ID END) AS TD_PUBLIC_EN_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '302' THEN A.ACCOUNT END) AS TD_PUBLIC_ENT_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.LCY_CLOSING_BAL END) AS TD_PRIVATE,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.CUST_ID END) AS TD_PRIVATE_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE IN ('303','305','301') THEN A.ACCOUNT END) AS TD_PRIVATE_ACCOUNT,

      SUM(CASE WHEN A.ACC_CODE = '304' THEN A.LCY_CLOSING_BAL END) AS TD_BANK,
      COUNT(DISTINCT CASE WHEN A.ACC_CODE = '304' THEN A.CUST_ID END) AS TD_BANK_DEPOSITOR,
      COUNT(CASE WHEN A.ACC_CODE = '304' THEN A.ACCOUNT END) AS TD_BANK_ACCOUNT

    FROM base_data A
    JOIN FCUBSLIVE.STTM_BRANCH B ON B.BRANCH_CODE = A.BRANCH_CODE
    GROUP BY B.BRANCH_ADDR3
    ORDER BY B.BRANCH_ADDR3
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });

  const regionData = {};
  for (const region of TARGET_REGIONS) {
    regionData[region] = emptyLocation();
  }

  for (const row of result.rows) {
    const rawRegion = String(row.BREGION || '').toUpperCase().trim();
    const region = REGION_NAME_MAP[rawRegion];
    if (!region) continue;

    const urban = regionData[region].urban;

    // ---- DEMAND ----
    urban.demand.pubEnt = {
      amount:     amt(row.DEMAND_PUBLIC_ENT),
      depositors: cnt(row.DEMAND_PUBLIC_ENT_DEPOSITOR),
      accounts:   cnt(row.DEMAND_PUBLIC_ENT_ACCOUNT),
    };
    urban.demand.private = {
      amount:     amt(row.DEMAND_PRIVATE),
      depositors: cnt(row.DEMAND_PRIVATET_DEPOSITOR),
      accounts:   cnt(row.DEMAND_PRIVATE_ACCOUNT),
    };
    urban.demand.gov = {
      amount:     amt(row.DEMAND_GOVE),
      depositors: cnt(row.DEMAND_GOVE_DEPOSITOR),
      accounts:   cnt(row.DEMAND_GOVE_ACCOUNT),
    };
    urban.demand.bank = {
      amount:     amt(row.DEMAND_BANK),
      depositors: cnt(row.DEMAND_BANK_DEPOSITOR),
      accounts:   cnt(row.DEMAND_BANK_ACCOUNT),
    };
    urban.demand.other = {
      amount:     amt(row.DEMAND_OTHER),
      depositors: cnt(row.DEMAND_OTHER_DEPOSITOR),
      accounts:   cnt(row.DEMAND_OTHER_ACCOUNT),
    };

    // ---- SAVING ----
    urban.saving.pubEnt = {
      amount:     amt(row.SAVING_PUBLIC_ENT),
      depositors: cnt(row.SAVING_PUBLIC_ENT_DEPOSITOR),
      accounts:   cnt(row.SAVING_PUBLIC_ENT_ACCOUNT),
    };
    urban.saving.private = {
      amount:     amt(row.SAVING_PRIVATE),
      depositors: cnt(row.SAVING_PRIVATE_DEPOSITOR),
      accounts:   cnt(row.SAVING_PRIVATE_ACCOUNT),
    };
    urban.saving.bank = {
      amount:     amt(row.SAVING_BANK),
      depositors: cnt(row.SAVING_BANK_DEPOSITOR),
      accounts:   cnt(row.SAVING_BANK_ACCOUNT),
    };

    // ---- TERM DEPOSIT -> stored as `restricted` ----
    urban.restricted.pubEnt = {
      amount:     amt(row.TD_PUBLIC_ENT),
      depositors: cnt(row.TD_PUBLIC_EN_DEPOSITOR),
      accounts:   cnt(row.TD_PUBLIC_ENT_ACCOUNT),
    };
    urban.restricted.private = {
      amount:     amt(row.TD_PRIVATE),
      depositors: cnt(row.TD_PRIVATE_DEPOSITOR),
      accounts:   cnt(row.TD_PRIVATE_ACCOUNT),
    };
    urban.restricted.bank = {
      amount:     amt(row.TD_BANK),
      depositors: cnt(row.TD_BANK_DEPOSITOR),
      accounts:   cnt(row.TD_BANK_ACCOUNT),
    };
  }

  logger.info(
    `Fetched IFB Deposit-by-Sector data for ${Object.keys(regionData).length} regions (amounts in Millions of Birr).`
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