import {
  fetchLoanBySectorAndRegion,
  TARGET_REGIONS,
} from '../../services/loanBySectorService.js';

const BASE_CODE           = 50822;
const CODES_PER_REGION    = 108;
const TOTAL_AMOUNT_BASE   = 52334;

/* Sectors within each block (6 × 3 = 18 codes) */
const SECTORS = [
  { key: 'publicEnterprise', label: 'Public Enterprise', offset: 0  },
  { key: 'privateCoop',      label: 'Private & Coop.',   offset: 3  },
  { key: 'regionalGovt',     label: "Regional Gov't",    offset: 6  },
  { key: 'banks',            label: 'Banks',             offset: 9  },
  { key: 'others',           label: 'Others*',           offset: 12 },
  { key: 'total',            label: 'Total',             offset: 15 },
];

const BLOCKS = [
  { key: 'main',        prefix: '',              offset: 0   },
  { key: 'termLoan',    prefix: 'Term loan_',    offset: 18  },
  { key: 'overdraft',   prefix: 'Overdraft_',    offset: 36  },
  { key: 'merchandise', prefix: 'Merch. Loan*_', offset: 54  },
  { key: 'urban',       prefix: 'Urban_',        offset: 72  },
  { key: 'rural',       prefix: 'Rural_',        offset: 90  },
];

const METRICS = ['amount', 'borrowers', 'accounts'];
const METRIC_LABELS = {
  amount:    'Amount',
  borrowers: '# of Borrowers',
  accounts:  '# of Accounts',
};

/* The 5 real sectors (excluding Total) */
const NON_TOTAL_SECTORS = ['publicEnterprise', 'privateCoop', 'regionalGovt', 'banks', 'others'];

/* ------------------------------------------------------------------ */
function pick(regionData, loanType, sector, metric) {
  const r = regionData?.[loanType]?.[sector];
  return r ? (r[metric] || 0) : 0;
}

/* Sum of the 3 loan types for a given sector (and metric).
 * If sector === 'total', sums all 5 sectors × 3 loan types. */
function sumLoanTypesForSector(regionData, sector, metric) {
  if (sector === 'total') {
    let sum = 0;
    for (const s of NON_TOTAL_SECTORS) {
      sum += pick(regionData, 'termLoan',    s, metric);
      sum += pick(regionData, 'overdraft',   s, metric);
      sum += pick(regionData, 'merchandise', s, metric);
    }
    return sum;
  }
  return (
    pick(regionData, 'termLoan',    sector, metric) +
    pick(regionData, 'overdraft',   sector, metric) +
    pick(regionData, 'merchandise', sector, metric)
  );
}

/* Sum of the 5 sectors for a specific loan type (and metric). */
function sumSectorsForLoanType(regionData, loanType, metric) {
  let sum = 0;
  for (const s of NON_TOTAL_SECTORS) {
    sum += pick(regionData, loanType, s, metric);
  }
  return sum;
}

function computeValue(regionData, blockKey, sectorKey, metric) {
  if (!regionData) return 0;

  switch (blockKey) {
    case 'main':
    case 'urban':
      // All branches are Urban -> Main == Urban (sum of 3 loan types)
      return sumLoanTypesForSector(regionData, sectorKey, metric);

    case 'rural':
      // No rural branches -> always 0
      return 0;

    case 'termLoan':
    case 'overdraft':
    case 'merchandise':
      if (sectorKey === 'total') {
        return sumSectorsForLoanType(regionData, blockKey, metric);
      }
      return pick(regionData, blockKey, sectorKey, metric);

    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'LOAN_SEC & REGRS002',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchLoanBySectorAndRegion,

  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const fields = [];

    /* ---------- Per-region blocks ---------- */
    TARGET_REGIONS.forEach((region, regionIdx) => {
      const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
      const regionData = rawData[region];

      BLOCKS.forEach(block => {
        SECTORS.forEach(sector => {
          METRICS.forEach((metric, metricIdx) => {
            const code = `RS002_${regionBase + block.offset + sector.offset + metricIdx}`;
            const description = block.prefix
              ? `${region}_${block.prefix}${sector.label}_${METRIC_LABELS[metric]}`
              : `${region}_${sector.label}_${METRIC_LABELS[metric]}`;

            fields.push({
              code,
              description,
              source: 'calculated',
              calculation: () =>
                computeValue(regionData, block.key, sector.key, metric),
            });
          });
        });
      });
    });

    /* ---------- Bottom "Total Amount" block (18 codes) ---------- */
    SECTORS.forEach(sector => {
      METRICS.forEach((metric, metricIdx) => {
        const code = `RS002_${TOTAL_AMOUNT_BASE + sector.offset + metricIdx}`;
        const description = `Total Amount_${sector.label}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            // Sum the "main" block value of every region for this sector+metric.
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              const mainCode   = `RS002_${regionBase + sector.offset + metricIdx}`;
              sum += parseFloat(fieldMap[mainCode] || 0);
            });
            return sum;
          },
        });
      });
    });

    return fields;
  },
};