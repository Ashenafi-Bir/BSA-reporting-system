import {
  fetchDepositBySectorAndRegion,
  TARGET_REGIONS,
} from '../../services/depositBySectorService.js';

/* ------------------------------------------------------------------ */
/*  Code-layout constants (derived from the JSON dictionary)          */
/* ------------------------------------------------------------------ */
const BASE_CODE           = 47252;   // first code of Addis Ababa
const CODES_PER_REGION    = 108;     // 6 blocks × 18 fields
const TOTAL_DEPOSITS_BASE = 48764;   // "Total Deposits" block

/* Each block has 6 categories × 3 metrics = 18 codes */
const CATEGORIES = ['pubEnt', 'private', 'gov', 'bank', 'other'];   // 5 real ones
const CATEGORY_LABELS = {
  pubEnt:  'Pub.  Enterprise',   // note double space (matches JSON)
  private: 'Private & Coop.',
  gov:     'Regional Gov.',
  bank:    'Banks',
  other:   'Others',
  total:   'Total ',              // note trailing space (matches JSON)
};

const METRICS = ['amount', 'depositors', 'accounts'];
const METRIC_LABELS = {
  amount:     'Amount',
  depositors: '# of Depositors ',   // trailing space
  accounts:   '# of Accounts ',     // trailing space
};

/* Block order inside each region (matches JSON order) */
const BLOCKS = [
  { key: 'main',   prefix: '',       offset: 0  },
  { key: 'demand', prefix: 'Demand_', offset: 18 },
  { key: 'saving', prefix: 'Saving_', offset: 36 },
  { key: 'time',   prefix: 'Time_',   offset: 54 },
  { key: 'urban',  prefix: 'Urban_',  offset: 72 },
  { key: 'rural',  prefix: 'Rural_',  offset: 90 },
];

/* ------------------------------------------------------------------ */
/*  Value calculation                                                  */
/* ------------------------------------------------------------------ */
function computeSectorValue(regionData, blockKey, category, metric) {
  if (!regionData) return 0;

  // Urban / Rural blocks: only that location, sum across account types
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

  // Demand / Saving / Time blocks: sum urban + rural
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

  // Main block: sum Demand + Saving + Time across both locations
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
  reportKey: 'CDby Sector and RegMD002',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchDepositBySectorAndRegion,

  // The template expects every code (many of them legitimately zero)
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
            const code = `MD002_${regionBase + block.offset + catIdx * 3 + metricIdx}`;
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

        // "Total" category = sum of the 5 sectors (reads from fieldMap)
        METRICS.forEach((metric, metricIdx) => {
          const code = `MD002_${regionBase + block.offset + 5 * 3 + metricIdx}`;
          const description = block.prefix
            ? `${region}_${block.prefix}${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`
            : `${region}_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

          fields.push({
            code,
            description,
            source: 'calculated',
            calculation: (fieldMap) => {
              let sum = 0;
              for (let i = 0; i < CATEGORIES.length; i++) {
                const c = `MD002_${regionBase + block.offset + i * 3 + metricIdx}`;
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
        const code = `MD002_${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
        const description = `Total Deposits_${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              const mainCode = `MD002_${regionBase + catIdx * 3 + metricIdx}`;
              sum += parseFloat(fieldMap[mainCode] || 0);
            });
            return sum;
          },
        });
      });
    });

    // Total Deposits - Total column (sum of the 5 categories)
    METRICS.forEach((metric, metricIdx) => {
      const code = `MD002_${TOTAL_DEPOSITS_BASE + 5 * 3 + metricIdx}`;
      const description = `Total Deposits_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

      fields.push({
        code,
        description,
        source: 'calculated',
        calculation: (fieldMap) => {
          let sum = 0;
          for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
            const c = `MD002_${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
            sum += parseFloat(fieldMap[c] || 0);
          }
          return sum;
        },
      });
    });

    return fields;
  },
};