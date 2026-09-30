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
/*  Loan types returned by the SQL (LOANTYPE column)                   */
/* ------------------------------------------------------------------ */
const LOAN_TYPES = [
  { sql: 'TERMLOAN',    key: 'termLoan'    },
  { sql: 'OVERDRAFT',   key: 'overdraft'   },
  { sql: 'MERCHANDIZE', key: 'merchandise' },
];

/* The 5 sectors + Total, mapped to exact SQL column aliases.
 * Note: for "Others", the SQL uses LOAN_OTHER for amount but
 * LOAN_OTHERS_* for borrower/account — we handle that explicitly. */
const SECTORS = [
  {
    key: 'publicEnterprise',
    amountCol:   'LOAN_PUBLIC_ENTERPRISE',
    borrowerCol: 'LOAN_PUBLIC_ENTERPRISE_BORROWER',
    accountCol:  'LOAN_PUBLIC_ENTERPRISE_ACCOUNT',
  },
  {
    key: 'privateCoop',
    amountCol:   'LOAN_PRIVATE_COPP',
    borrowerCol: 'LOAN_PRIVATE_COPP_BORROWER',
    accountCol:  'LOAN_PRIVATE_COPP_ACCOUNT',
  },
  {
    key: 'regionalGovt',
    amountCol:   'LOAN_REGIONAL_GOVE',
    borrowerCol: 'LOAN_REGIONAL_GOVE_BORROWER',
    accountCol:  'LOAN_REGIONAL_GOVE_ACCOUNT',
  },
  {
    key: 'banks',
    amountCol:   'LOAN_BANKS',
    borrowerCol: 'LOAN_BANKS_BORROWER',
    accountCol:  'LOAN_BANKS_ACCOUNT',
  },
  {
    key: 'others',
    amountCol:   'LOAN_OTHER',
    borrowerCol: 'LOAN_OTHERS_BORROWER',
    accountCol:  'LOAN_OTHERS_ACCOUNT',
  },
];

/* ------------------------------------------------------------------ */
/*  Empty structure                                                    */
/* ------------------------------------------------------------------ */
const emptyMetric = () => ({ amount: 0, borrowers: 0, accounts: 0 });
const emptySector = () => ({
  publicEnterprise: emptyMetric(),
  privateCoop:      emptyMetric(),
  regionalGovt:     emptyMetric(),
  banks:            emptyMetric(),
  others:           emptyMetric(),
  total:            emptyMetric(),
});
const emptyLoanTypes = () => ({
  termLoan:    emptySector(),
  overdraft:   emptySector(),
  merchandise: emptySector(),
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
export async function fetchLoanBySectorAndRegion(startDate, endDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to fetchLoanBySectorAndRegion');
  }
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate provided to fetchLoanBySectorAndRegion');
  }

  const endDateStr = formatOracleDate(endDate);
  logger.info(`Fetching Loan by Sector & Region data up to ${endDateStr}`);

  const query = `
    WITH
    BRANCHES AS (
      SELECT BRANCH_ADDR3, BRANCH_CODE, BRANCH_NAME
      FROM FCUBSLIVE.STTM_BRANCH
    ),
    LOAN_ACCOUNTS AS (
      SELECT
        A.ACCOUNT_NUMBER,
        B.BRANCH_ADDR3 AS REGION,
        A.BRANCH_CODE   AS BRANCH,
        B.BRANCH_NAME   AS BRNAME,
        A.CUSTOMER_ID
      FROM FCUBSLIVE.CLTB_ACCOUNT_MASTER A
      LEFT JOIN BRANCHES B ON B.BRANCH_CODE = A.BRANCH_CODE
      WHERE A.ACCOUNT_STATUS <> 'V'
        AND A.VALUE_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    LOAN_SCHEDULES AS (
      SELECT
        X.ACCOUNT_NUMBER,
        SUM(CASE WHEN X.COMPONENT_NAME = 'PRPASTDUE'
                  AND X.SCHEDULE_DUE_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS OS_PRINCIPAL,
        SUM(CASE WHEN X.COMPONENT_NAME = 'PRPASTDUE'
                  AND X.SCHEDULE_DUE_DATE < TO_DATE(:endDate, 'DD-MON-YYYY')
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS PASTOS_PRINCIPAL,
        SUM(CASE WHEN X.COMPONENT_NAME = 'ACCRUEDINT'
                  AND X.SCHEDULE_DUE_DATE < TO_DATE(:endDate, 'DD-MON-YYYY')
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS PASTOS_MAININT,
        SUM(CASE WHEN X.COMPONENT_NAME = 'PRINCIPAL'
                  AND NVL(X.AMOUNT_DUE,0) <> NVL(X.AMOUNT_SETTLED,0)
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS PRINCIPAL_OS,
        SUM(CASE WHEN X.COMPONENT_NAME IN ('ACCRUEDINT','INTMATPR','PRPASTDUE','ODIN_PNLTY','ODPR_PNLTY')
                  AND X.SCHEDULE_DUE_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
                  AND NVL(X.AMOUNT_DUE,0) <> NVL(X.AMOUNT_SETTLED,0)
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS AMT_OSDATERANGE,
        SUM(CASE WHEN X.COMPONENT_NAME IN ('ACCRUEDINT','PRPASTDUE')
                  AND X.SCHEDULE_DUE_DATE > TO_DATE(:endDate, 'DD-MON-YYYY')
                 THEN NVL(X.AMOUNT_DUE,0) - NVL(X.AMOUNT_SETTLED,0) ELSE 0 END) AS EXPECTED_AMT
      FROM FCUBSLIVE.CLTB_ACCOUNT_SCHEDULES X
      INNER JOIN LOAN_ACCOUNTS LA ON LA.ACCOUNT_NUMBER = X.ACCOUNT_NUMBER
      GROUP BY X.ACCOUNT_NUMBER
    ),
    LOAN_ENTRIES AS (
      SELECT
        E.RELATED_ACCOUNT AS ACCOUNT_NUMBER,
        SUM(CASE WHEN E.EVENT <> 'ACCR'
                  AND E.AMOUNT_TAG IN ('MAIN_INT_LIQD','ODPR_PNLTY_LIQD','INTMATPR_LIQD',
                                       'MAIN_INT_RACR_REAL','ODPR_PNLTY_RACR_REAL','INTMATPR_RACR_REAL')
                  AND E.DRCR_IND = 'C'
                 THEN E.LCY_AMOUNT ELSE 0 END) AS INTEREST_SETTLED,
        SUM(CASE WHEN E.EVENT = 'ACCR'
                  AND E.AMOUNT_TAG IN ('MAIN_INT_ACCR','ODPR_PNLTY_ACCR','INTMATPR_ACCR')
                  AND E.DRCR_IND = 'D'
                 THEN E.LCY_AMOUNT ELSE 0 END) AS OSACCRUEDINT,
        SUM(CASE WHEN E.EVENT IN ('MLIQ','ALIQ','DSBR','REVP')
                  AND E.AMOUNT_TAG = 'PRINCIPAL_LIQD'
                  AND E.DRCR_IND = 'C'
                  AND E.TRN_DT > TO_DATE(:endDate, 'DD-MON-YYYY')
                 THEN E.LCY_AMOUNT ELSE 0 END) AS PRINCIPAL_LIQD
      FROM FCUBSLIVE.ACVWS_ALL_AC_ENTRIES E
      INNER JOIN LOAN_ACCOUNTS LA ON LA.ACCOUNT_NUMBER = E.RELATED_ACCOUNT
      WHERE E.TRN_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
         OR E.TRN_DT >  TO_DATE(:endDate, 'DD-MON-YYYY')
      GROUP BY E.RELATED_ACCOUNT
    ),
    TERM_LOAN_DATA AS (
      SELECT
        LA.REGION,
        LA.CUSTOMER_ID,
        (
            NVL(LS.PASTOS_PRINCIPAL,0)
          + NVL(LS.PASTOS_MAININT,0)
          + NVL(LS.EXPECTED_AMT,0)
          + NVL(LS.OS_PRINCIPAL,0)
          + NVL(LE.OSACCRUEDINT,0)
          + NVL(LS.AMT_OSDATERANGE,0)
          + NVL(LS.PRINCIPAL_OS,0)
          + NVL(LE.PRINCIPAL_LIQD,0)
          - NVL(LE.INTEREST_SETTLED,0)
        ) AS TOTAL_OS
      FROM LOAN_ACCOUNTS LA
      LEFT JOIN LOAN_SCHEDULES LS ON LS.ACCOUNT_NUMBER = LA.ACCOUNT_NUMBER
      LEFT JOIN LOAN_ENTRIES   LE ON LE.ACCOUNT_NUMBER = LA.ACCOUNT_NUMBER
    ),
    TERM_LOAN AS (
      SELECT
        REGION,
        0 AS "LOAN_PUBLIC_ENTERPRISE",
        0 AS "LOAN_PUBLIC_ENTERPRISE_BORROWER",
        0 AS "LOAN_PUBLIC_ENTERPRISE_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS > 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "LOAN_PRIVATE_COPP",
        COUNT(DISTINCT CASE WHEN TOTAL_OS > 0 THEN CUSTOMER_ID END) AS "LOAN_PRIVATE_COPP_BORROWER",
        COUNT(CASE WHEN TOTAL_OS > 0 THEN 1 END)                    AS "LOAN_PRIVATE_COPP_ACCOUNT",
        0 AS "LOAN_REGIONAL_GOVE",
        0 AS "LOAN_REGIONAL_GOVE_BORROWER",
        0 AS "LOAN_REGIONAL_GOVE_ACCOUNT",
        0 AS "LOAN_BANKS",
        0 AS "LOAN_BANKS_BORROWER",
        0 AS "LOAN_BANKS_ACCOUNT",
        0 AS "LOAN_OTHER",
        0 AS "LOAN_OTHERS_BORROWER",
        0 AS "LOAN_OTHERS_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS > 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "TOTAL",
        COUNT(DISTINCT CASE WHEN TOTAL_OS > 0 THEN CUSTOMER_ID END) AS "TOTAL_BORROWER",
        COUNT(CASE WHEN TOTAL_OS > 0 THEN 1 END)                    AS "TOTAL_ACCOUNT",
        'TERMLOAN' AS LOANTYPE
      FROM TERM_LOAN_DATA
      GROUP BY REGION
    ),
    OD_ACCOUNTS AS (
      SELECT DISTINCT
        X.CUST_AC_NO   AS ACCOUNT_NUMBER,
        B.BRANCH_ADDR3 AS REGION,
        X.BRANCH_CODE  AS BRANCH,
        X.CUST_NO,
        B.BRANCH_NAME  AS BRNAME
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT X
      INNER JOIN FCUBSLIVE.STTMS_CUST_ACCOUNT_LINKAGES Y
        ON Y.CUST_AC_NO = X.CUST_AC_NO AND Y.LINKED_AMT IS NOT NULL
      INNER JOIN FCUBSLIVE.STTM_ACCOUNT_CLASS AC
        ON AC.ACCOUNT_CLASS = X.ACCOUNT_CLASS AND AC.OVERDRAFT_FACILITY = 'Y'
      LEFT JOIN BRANCHES B ON B.BRANCH_CODE = X.BRANCH_CODE
      WHERE X.ACCOUNT_CLASS NOT IN ('EXPOD','INDMR','IMPOR','AGRMR')
        AND X.AC_OPEN_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    OD_BALANCES AS (
      SELECT
        O.REGION,
        O.CUST_NO,
        O.ACCOUNT_NUMBER,
        SUM(CASE WHEN E.DRCR_IND = 'C' THEN E.LCY_AMOUNT ELSE -E.LCY_AMOUNT END) AS TOTAL_OS
      FROM OD_ACCOUNTS O
      INNER JOIN FCUBSLIVE.ACVWS_ALL_AC_ENTRIES E
        ON E.AC_NO = O.ACCOUNT_NUMBER
       AND E.TRN_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
      GROUP BY O.REGION, O.CUST_NO, O.ACCOUNT_NUMBER
    ),
    OVERDRAFT AS (
      SELECT
        REGION,
        0 AS "LOAN_PUBLIC_ENTERPRISE",
        0 AS "LOAN_PUBLIC_ENTERPRISE_BORROWER",
        0 AS "LOAN_PUBLIC_ENTERPRISE_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS < 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "LOAN_PRIVATE_COPP",
        COUNT(DISTINCT CASE WHEN TOTAL_OS < 0 THEN CUST_NO END)   AS "LOAN_PRIVATE_COPP_BORROWER",
        COUNT(CASE WHEN TOTAL_OS < 0 THEN 1 END)                  AS "LOAN_PRIVATE_COPP_ACCOUNT",
        0 AS "LOAN_REGIONAL_GOVE",
        0 AS "LOAN_REGIONAL_GOVE_BORROWER",
        0 AS "LOAN_REGIONAL_GOVE_ACCOUNT",
        0 AS "LOAN_BANKS",
        0 AS "LOAN_BANKS_BORROWER",
        0 AS "LOAN_BANKS_ACCOUNT",
        0 AS "LOAN_OTHER",
        0 AS "LOAN_OTHERS_BORROWER",
        0 AS "LOAN_OTHERS_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS < 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "TOTAL",
        COUNT(DISTINCT CASE WHEN TOTAL_OS < 0 THEN CUST_NO END)   AS "TOTAL_BORROWER",
        COUNT(CASE WHEN TOTAL_OS < 0 THEN 1 END)                  AS "TOTAL_ACCOUNT",
        'OVERDRAFT' AS LOANTYPE
      FROM OD_BALANCES
      WHERE TOTAL_OS <> 0
      GROUP BY REGION
    ),
    MERCH_ACCOUNTS AS (
      SELECT DISTINCT
        X.CUST_AC_NO   AS ACCOUNT_NUMBER,
        X.BRANCH_CODE  AS BRANCH,
        B.BRANCH_ADDR3 AS REGION,
        B.BRANCH_NAME  AS BRNAME,
        X.CUST_NO
      FROM FCUBSLIVE.STTM_CUST_ACCOUNT X
      INNER JOIN FCUBSLIVE.STTMS_CUST_ACCOUNT_LINKAGES Y
        ON Y.CUST_AC_NO = X.CUST_AC_NO AND Y.LINKED_AMT IS NOT NULL
      INNER JOIN FCUBSLIVE.STTM_ACCOUNT_CLASS AC
        ON AC.ACCOUNT_CLASS = X.ACCOUNT_CLASS AND AC.OVERDRAFT_FACILITY = 'Y'
      LEFT JOIN BRANCHES B ON B.BRANCH_CODE = X.BRANCH_CODE
      WHERE X.ACCOUNT_CLASS IN ('EXPOD','INDMR','IMPOR','AGRMR')
        AND X.AC_OPEN_DATE <= TO_DATE(:endDate, 'DD-MON-YYYY')
    ),
    MERCH_BALANCES AS (
      SELECT
        M.REGION,
        M.CUST_NO,
        M.ACCOUNT_NUMBER,
        SUM(CASE WHEN E.DRCR_IND = 'C' THEN E.LCY_AMOUNT ELSE -E.LCY_AMOUNT END) AS TOTAL_OS
      FROM MERCH_ACCOUNTS M
      INNER JOIN FCUBSLIVE.ACVWS_ALL_AC_ENTRIES E
        ON E.AC_NO = M.ACCOUNT_NUMBER
       AND E.TRN_DT <= TO_DATE(:endDate, 'DD-MON-YYYY')
      GROUP BY M.REGION, M.CUST_NO, M.ACCOUNT_NUMBER
    ),
    MERCHANDIZE AS (
      SELECT
        REGION,
        0 AS "LOAN_PUBLIC_ENTERPRISE",
        0 AS "LOAN_PUBLIC_ENTERPRISE_BORROWER",
        0 AS "LOAN_PUBLIC_ENTERPRISE_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS < 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "LOAN_PRIVATE_COPP",
        COUNT(DISTINCT CASE WHEN TOTAL_OS < 0 THEN CUST_NO END)   AS "LOAN_PRIVATE_COPP_BORROWER",
        COUNT(CASE WHEN TOTAL_OS < 0 THEN 1 END)                  AS "LOAN_PRIVATE_COPP_ACCOUNT",
        0 AS "LOAN_REGIONAL_GOVE",
        0 AS "LOAN_REGIONAL_GOVE_BORROWER",
        0 AS "LOAN_REGIONAL_GOVE_ACCOUNT",
        0 AS "LOAN_BANKS",
        0 AS "LOAN_BANKS_BORROWER",
        0 AS "LOAN_BANKS_ACCOUNT",
        0 AS "LOAN_OTHER",
        0 AS "LOAN_OTHERS_BORROWER",
        0 AS "LOAN_OTHERS_ACCOUNT",
        SUM(CASE WHEN TOTAL_OS < 0 THEN ABS(TOTAL_OS) ELSE 0 END) AS "TOTAL",
        COUNT(DISTINCT CASE WHEN TOTAL_OS < 0 THEN CUST_NO END)   AS "TOTAL_BORROWER",
        COUNT(CASE WHEN TOTAL_OS < 0 THEN 1 END)                  AS "TOTAL_ACCOUNT",
        'MERCHANDIZE' AS LOANTYPE
      FROM MERCH_BALANCES
      WHERE TOTAL_OS <> 0
      GROUP BY REGION
    )
    SELECT
      REGION, 'Urban' AS URBAN_RURAL, LOANTYPE,
      LOAN_PUBLIC_ENTERPRISE, LOAN_PUBLIC_ENTERPRISE_BORROWER, LOAN_PUBLIC_ENTERPRISE_ACCOUNT,
      LOAN_PRIVATE_COPP, LOAN_PRIVATE_COPP_BORROWER, LOAN_PRIVATE_COPP_ACCOUNT,
      LOAN_REGIONAL_GOVE, LOAN_REGIONAL_GOVE_BORROWER, LOAN_REGIONAL_GOVE_ACCOUNT,
      LOAN_BANKS, LOAN_BANKS_BORROWER, LOAN_BANKS_ACCOUNT,
      LOAN_OTHER, LOAN_OTHERS_BORROWER, LOAN_OTHERS_ACCOUNT,
      TOTAL, TOTAL_BORROWER, TOTAL_ACCOUNT
    FROM TERM_LOAN
    UNION ALL
    SELECT
      REGION, 'Urban' AS URBAN_RURAL, LOANTYPE,
      LOAN_PUBLIC_ENTERPRISE, LOAN_PUBLIC_ENTERPRISE_BORROWER, LOAN_PUBLIC_ENTERPRISE_ACCOUNT,
      LOAN_PRIVATE_COPP, LOAN_PRIVATE_COPP_BORROWER, LOAN_PRIVATE_COPP_ACCOUNT,
      LOAN_REGIONAL_GOVE, LOAN_REGIONAL_GOVE_BORROWER, LOAN_REGIONAL_GOVE_ACCOUNT,
      LOAN_BANKS, LOAN_BANKS_BORROWER, LOAN_BANKS_ACCOUNT,
      LOAN_OTHER, LOAN_OTHERS_BORROWER, LOAN_OTHERS_ACCOUNT,
      TOTAL, TOTAL_BORROWER, TOTAL_ACCOUNT
    FROM OVERDRAFT
    UNION ALL
    SELECT
      REGION, 'Urban' AS URBAN_RURAL, LOANTYPE,
      LOAN_PUBLIC_ENTERPRISE, LOAN_PUBLIC_ENTERPRISE_BORROWER, LOAN_PUBLIC_ENTERPRISE_ACCOUNT,
      LOAN_PRIVATE_COPP, LOAN_PRIVATE_COPP_BORROWER, LOAN_PRIVATE_COPP_ACCOUNT,
      LOAN_REGIONAL_GOVE, LOAN_REGIONAL_GOVE_BORROWER, LOAN_REGIONAL_GOVE_ACCOUNT,
      LOAN_BANKS, LOAN_BANKS_BORROWER, LOAN_BANKS_ACCOUNT,
      LOAN_OTHER, LOAN_OTHERS_BORROWER, LOAN_OTHERS_ACCOUNT,
      TOTAL, TOTAL_BORROWER, TOTAL_ACCOUNT
    FROM MERCHANDIZE
    ORDER BY REGION
  `;

  const result = await executeOracleQuery(query, { endDate: endDateStr });

  const regionData = {};
  for (const region of TARGET_REGIONS) {
    regionData[region] = emptyLoanTypes();
  }

  for (const row of result.rows) {
    const rawRegion = String(row.REGION || '').toUpperCase().trim();
    const region = REGION_NAME_MAP[rawRegion];
    if (!region) continue;

    const loanTypeEntry = LOAN_TYPES.find(
      (t) => String(row.LOANTYPE || '').toUpperCase() === t.sql
    );
    if (!loanTypeEntry) continue;

    const bucket = regionData[region][loanTypeEntry.key];

    // Read each sector's 3 metrics from SQL
    for (const sector of SECTORS) {
      bucket[sector.key] = {
        amount:    amt(row[sector.amountCol]),
        borrowers: cnt(row[sector.borrowerCol]),
        accounts:  cnt(row[sector.accountCol]),
      };
    }

    // TOTAL sector = sum of the 5 sectors (mirrors Excel: =C+F+I+L+O)
    const total = { amount: 0, borrowers: 0, accounts: 0 };
    for (const sector of SECTORS) {
      total.amount    += bucket[sector.key].amount;
      total.borrowers += bucket[sector.key].borrowers;
      total.accounts  += bucket[sector.key].accounts;
    }
    bucket.total = total;
  }

  logger.info(
    `Fetched Loan-by-Sector data for ${Object.keys(regionData).length} regions (amounts in Millions of Birr).`
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