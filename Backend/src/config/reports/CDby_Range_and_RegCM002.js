import {
  fetchDepositByRangeAndRegion,
  TARGET_REGIONS,
} from '../../services/depositByRangeService.js';

const BASE_CODE           = 46232;
const CODES_PER_REGION    = 72;
const TOTAL_DEPOSITS_BASE = 47240;

/* Categories within each block: R1, R2, R3, Total  (all 4 come from SQL now) */
const CATEGORIES = [
  { key: 'range1', label: '  <= Birr 100,000 ',      offset: 0, isTotal: false },
  { key: 'range2', label: '>Birr 100,000-1million ', offset: 3, isTotal: false },
  { key: 'range3', label: '> Birr 1 million ',       offset: 6, isTotal: false },
  { key: 'total',  label: 'Total  ',                 offset: 9, isTotal: false }, // <- read from SQL, not computed
];

const BLOCKS = [
  { key: 'main',   prefix: '',         offset: 0  },
  { key: 'demand', prefix: 'Demand_',  offset: 12 },
  { key: 'saving', prefix: 'Saving_',  offset: 24 },
  { key: 'time',   prefix: 'Time_',    offset: 36 },
  { key: 'urban',  prefix: 'Urban_',   offset: 48 },
  { key: 'rural',  prefix: 'Rural_',   offset: 60 },
];

const METRICS = ['amount', 'depositors', 'accounts'];
const METRIC_LABELS = {
  amount:     'Amount',
  depositors: '# of Depositors ',
  accounts:   '# of Accounts ',
};

/* ------------------------------------------------------------------ */
function computeRangeValue(regionData, blockKey, rangeKey, metric) {
  if (!regionData) return 0;

  const pick = (loc, sub) => {
    const r = regionData[loc] && regionData[loc][sub] && regionData[loc][sub][rangeKey];
    return r ? (r[metric] || 0) : 0;
  };

  switch (blockKey) {
    case 'main':
      return pick('urban','demand') + pick('urban','saving') + pick('urban','time')
           + pick('rural','demand') + pick('rural','saving') + pick('rural','time');
    case 'demand':
    case 'saving':
    case 'time':
      return pick('urban', blockKey) + pick('rural', blockKey);
    case 'urban':
      return pick('urban','demand') + pick('urban','saving') + pick('urban','time');
    case 'rural':
      return pick('rural','demand') + pick('rural','saving') + pick('rural','time');
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'CDby Range and RegCM002',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchDepositByRangeAndRegion,

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
            const code = `CM002_${regionBase + block.offset + cat.offset + metricIdx}`;
            const description = block.prefix
              ? `${region}_${block.prefix}${cat.label}_${METRIC_LABELS[metric]}`
              : `${region}_${cat.label}_${METRIC_LABELS[metric]}`;

            // Everything is copied from the SQL response — no recalculation
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

    /* ---------- Bottom "Total Deposits" block ---------- */
    CATEGORIES.forEach(cat => {
      METRICS.forEach((metric, metricIdx) => {
        const code = `CM002_${TOTAL_DEPOSITS_BASE + cat.offset + metricIdx}`;
        const description = `Total Deposits_${cat.label}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              const mainCode = `CM002_${regionBase + cat.offset + metricIdx}`;
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