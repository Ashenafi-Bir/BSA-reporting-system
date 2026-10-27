// config/reports/DEP_SEC_REG_DS003.js
import {
  fetchDepositBySectorAndRegion,
  TARGET_REGIONS,
} from '../../services/depositBySectorService.js';

/* ------------------------------------------------------------------ */
/*  Code-layout constants (from the DS003 JSON dictionary)            */
/* ------------------------------------------------------------------ */
const BASE_CODE           = 33152;   // first code of Addis Ababa
const CODES_PER_REGION    = 108;     // 6 blocks × 18 fields
const TOTAL_DEPOSITS_BASE = 34664;   // "Total Deposits" block
const CODE_PREFIX         = 'DS003_';

/* Each block has 6 categories × 3 metrics = 18 codes */
const CATEGORIES = ['pubEnt', 'private', 'gov', 'bank', 'other'];
const CATEGORY_LABELS = {
  pubEnt:  'Pub.  Enterprise',
  private: 'Private & Coop.',
  gov:     'Regional Gov.',
  bank:    'Banks',
  other:   'Others',
  total:   'Total ',
};

const METRICS = ['amount', 'depositors', 'accounts'];
const METRIC_LABELS = {
  amount:     'Amount',
  depositors: '# of Depositors ',
  accounts:   '# of Accounts ',
};

const BLOCKS = [
  { key: 'main',   prefix: '',        offset: 0  },
  { key: 'demand', prefix: 'Demand_', offset: 18 },
  { key: 'saving', prefix: 'Saving_', offset: 36 },
  { key: 'time',   prefix: 'Time_',   offset: 54 },
  { key: 'urban',  prefix: 'Urban_',  offset: 72 },
  { key: 'rural',  prefix: 'Rural_',  offset: 90 },
];

/* ------------------------------------------------------------------ */
/*  Value calculation (5 real sectors)                                 */
/* ------------------------------------------------------------------ */
function computeSectorValue(regionData, blockKey, category, metric) {
  if (!regionData) return 0;

  if (blockKey === 'urban' || blockKey === 'rural') {
    const loc = regionData[blockKey];
    if (!loc) return 0;
    let total = 0;
    for (const sub of ['demand', 'saving', 'time']) {
      const sector = loc[sub] && loc[sub][category];
      if (sector) total += sector[metric] || 0;
    }
    return total;
  }

  if (blockKey === 'demand' || blockKey === 'saving' || blockKey === 'time') {
    let total = 0;
    for (const loc of ['urban', 'rural']) {
      const locData = regionData[loc];
      if (!locData) continue;
      const sector = locData[blockKey] && locData[blockKey][category];
      if (sector) total += sector[metric] || 0;
    }
    return total;
  }

  if (blockKey === 'main') {
    let total = 0;
    for (const loc of ['urban', 'rural']) {
      const locData = regionData[loc];
      if (!locData) continue;
      for (const sub of ['demand', 'saving', 'time']) {
        const sector = locData[sub] && locData[sub][category];
        if (sector) total += sector[metric] || 0;
      }
    }
    return total;
  }

  return 0;
}

/* ------------------------------------------------------------------ */
/*  Config export                                                      */
/* ------------------------------------------------------------------ */
export default {
  reportKey: 'DEP_SEC&REG_DS003',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchDepositBySectorAndRegion,

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
        // 5 real sector categories
        CATEGORIES.forEach((cat, catIdx) => {
          METRICS.forEach((metric, metricIdx) => {
            const code = `${CODE_PREFIX}${regionBase + block.offset + catIdx * 3 + metricIdx}`;
            const description = block.prefix
              ? `${region}_${block.prefix}${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`
              : `${region}_${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`;

            fields.push({
              code,
              description,
              source: 'calculated',
              calculation: () => computeSectorValue(regionData, block.key, cat, metric),
            });
          });
        });

        // "Total" category column
        METRICS.forEach((metric, metricIdx) => {
          const code = `${CODE_PREFIX}${regionBase + block.offset + 5 * 3 + metricIdx}`;
          const description = block.prefix
            ? `${region}_${block.prefix}${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`
            : `${region}_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

          fields.push({
            code,
            description,
            source: 'calculated',
            calculation: (fieldMap) => {
              // MAIN block Total column comes straight from the SQL
              // grand-total columns (Total_Balance / Total_Depositor / Total_Account).
              if (block.key === 'main') {
                return regionData?.grandTotal?.[metric] || 0;
              }
              // Other blocks: sum of the 5 sector codes
              let sum = 0;
              for (let i = 0; i < CATEGORIES.length; i++) {
                const c = `${CODE_PREFIX}${regionBase + block.offset + i * 3 + metricIdx}`;
                sum += parseFloat(fieldMap[c] || 0);
              }
              return sum;
            },
          });
        });
      });
    });

    /* ---------- Bottom "Total Deposits" block ---------- */
    CATEGORIES.forEach((cat, catIdx) => {
      METRICS.forEach((metric, metricIdx) => {
        const code = `${CODE_PREFIX}${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
        const description = `Total Deposits_${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              const mainCode = `${CODE_PREFIX}${regionBase + catIdx * 3 + metricIdx}`;
              sum += parseFloat(fieldMap[mainCode] || 0);
            });
            return sum;
          },
        });
      });
    });

    // Total Deposits — Total column = sum of the 5 categories
    METRICS.forEach((metric, metricIdx) => {
      const code = `${CODE_PREFIX}${TOTAL_DEPOSITS_BASE + 5 * 3 + metricIdx}`;
      const description = `Total Deposits_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

      fields.push({
        code,
        description,
        source: 'calculated',
        calculation: (fieldMap) => {
          let sum = 0;
          for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
            const c = `${CODE_PREFIX}${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
            sum += parseFloat(fieldMap[c] || 0);
          }
          return sum;
        },
      });
    });

    return fields;
  },
};