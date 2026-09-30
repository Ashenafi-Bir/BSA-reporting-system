import {
  fetchLoanByRangeAndRegion,
  TARGET_REGIONS,
} from '../../services/loanByRangeService.js';

const BASE_CODE           = 48782;
const CODES_PER_REGION    = 144;
const TOTAL_AMOUNT_BASE   = 50798;

/* Categories within each block: R1..R7 + Total  (8 × 3 metrics = 24 codes) */
const CATEGORIES = [
  { key: 'range1', label: '<= 100,000',            offset: 0  },
  { key: 'range2', label: '>100,000 - 1million',   offset: 3  },
  { key: 'range3', label: '>1 million - 5 million',offset: 6  },
  { key: 'range4', label: '>5million - 10 million',offset: 9  },
  { key: 'range5', label: '>10million - 50 million',offset: 12 },
  { key: 'range6', label: '>50million -100million',offset: 15 },
  { key: 'range7', label: '>100 million',          offset: 18 },
  { key: 'total',  label: 'Total',                 offset: 21 },
];

const BLOCKS = [
  { key: 'main',        prefix: '',             offset: 0   },
  { key: 'termLoan',    prefix: 'Term loan_',   offset: 24  },
  { key: 'overdraft',   prefix: 'Overdraft_',   offset: 48  },
  { key: 'merchandise', prefix: 'Merch. loan_', offset: 72  },
  { key: 'urban',       prefix: 'Urban_',       offset: 96  },
  { key: 'rural',       prefix: 'Rural_',       offset: 120 },
];

const METRICS = ['amount', 'borrowers', 'accounts'];
const METRIC_LABELS = {
  amount:    'Amount',
  borrowers: '# of Borrowers',
  accounts:  '# of Accounts',
};

/* ------------------------------------------------------------------ */
function pick(regionData, type, rangeKey, metric) {
  const r = regionData?.[type]?.[rangeKey];
  return r ? (r[metric] || 0) : 0;
}

function computeRangeValue(regionData, blockKey, rangeKey, metric) {
  if (!regionData) return 0;

  const sumThree = () =>
    pick(regionData, 'termLoan',    rangeKey, metric) +
    pick(regionData, 'overdraft',   rangeKey, metric) +
    pick(regionData, 'merchandise', rangeKey, metric);

  switch (blockKey) {
    case 'main':
    case 'urban':
      // All branches are Urban -> Main and Urban are the same (sum of 3 types).
      return sumThree();
    case 'rural':
      // No rural branches in CBS -> always zero.
      return 0;
    case 'termLoan':
    case 'overdraft':
    case 'merchandise':
      return pick(regionData, blockKey, rangeKey, metric);
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'LOAN_RAN & REGRL002',   
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchLoanByRangeAndRegion,
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
        CATEGORIES.forEach(cat => {
          METRICS.forEach((metric, metricIdx) => {
            const code = `RL002_${regionBase + block.offset + cat.offset + metricIdx}`;
            const description = block.prefix
              ? `${region}_${block.prefix}${cat.label}_${METRIC_LABELS[metric]}`
              : `${region}_${cat.label}_${METRIC_LABELS[metric]}`;

            fields.push({
              code,
              description,
              source: 'calculated',
              calculation: () =>
                computeRangeValue(regionData, block.key, cat.key, metric),
            });
          });
        });
      });
    });

    /* ---------- Bottom "Total Amount" block (24 codes) ---------- */
    CATEGORIES.forEach(cat => {
      METRICS.forEach((metric, metricIdx) => {
        const code = `RL002_${TOTAL_AMOUNT_BASE + cat.offset + metricIdx}`;
        const description = `Total Amount_${cat.label}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            // Sum the "main" value of every region for this category+metric.
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              const mainCode   = `RL002_${regionBase + cat.offset + metricIdx}`;
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