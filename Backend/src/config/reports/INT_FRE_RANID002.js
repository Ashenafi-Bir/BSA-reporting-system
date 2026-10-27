import {
  fetchDepositByRangeIFB,
  TARGET_REGIONS,
} from '../../services/depositByRangeIFBService.js';

/* ------------------------------------------------------------------ */
/*  Code layout (from the ID002 JSON dictionary — Quarterly)           */
/* ------------------------------------------------------------------ */
const CODE_PREFIX         = 'ID002';
const BASE_CODE           = 37736;
const CODES_PER_REGION    = 96;
const TOTAL_DEPOSITS_BASE = 39080;

const CATEGORIES = [
  { key: 'range1', label: '  <= Birr 100,000 ',      offset: 0, isTotal: false },
  { key: 'range2', label: '>Birr 100,000-1million ', offset: 3, isTotal: false },
  { key: 'range3', label: '> Birr 1 million ',       offset: 6, isTotal: false },
  { key: 'total',  label: 'Total  ',                 offset: 9, isTotal: true  },
];

const BLOCKS = [
  { key: 'main',         prefix: '',                                  offset: 0,  timeLabel: null },
  { key: 'demand',       prefix: 'Demand_',                           offset: 12, timeLabel: null },
  { key: 'saving',       prefix: 'Saving_',                           offset: 24, timeLabel: null },
  { key: 'time',         prefix: 'Time (X.3.1+X.3.2)_',               offset: 36, timeLabel: true },
  { key: 'restricted',   prefix: 'Restricted Investment Deposit_',    offset: 48, timeLabel: null },
  { key: 'unrestricted', prefix: 'Unrestricted Investment Deposit_',  offset: 60, timeLabel: null },
  { key: 'urban',        prefix: 'Urban_',                            offset: 72, timeLabel: null },
  { key: 'rural',        prefix: 'Rural_',                            offset: 84, timeLabel: null },
];

const METRICS = ['amount', 'depositors', 'accounts'];
const METRIC_LABELS = {
  amount:     'Amount',
  depositors: '# of Depositors ',
  accounts:   '# of Accounts ',
};

/* ------------------------------------------------------------------ */
function computeBlockValue(regionData, blockKey, rangeKey, metric) {
  if (!regionData) return 0;

  const pick = (loc, sub) => {
    const r = regionData[loc] && regionData[loc][sub] && regionData[loc][sub][rangeKey];
    return r ? (r[metric] || 0) : 0;
  };
  const urbanSum = (sub) => pick('urban', sub);
  const ruralSum = (sub) => pick('rural', sub);
  const bothSum  = (sub) => urbanSum(sub) + ruralSum(sub);

  switch (blockKey) {
    case 'main':
      return bothSum('demand') + bothSum('saving') + bothSum('time')
           + bothSum('restricted') + bothSum('unrestricted');
    case 'demand':
    case 'saving':
    case 'time':
    case 'restricted':
    case 'unrestricted':
      return bothSum(blockKey);
    case 'urban':
      return urbanSum('demand') + urbanSum('saving') + urbanSum('time')
           + urbanSum('restricted') + urbanSum('unrestricted');
    case 'rural':
      return ruralSum('demand') + ruralSum('saving') + ruralSum('time')
           + ruralSum('restricted') + ruralSum('unrestricted');
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'INT_FRE_RANID002',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchDepositByRangeIFB,

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
        const prefix = block.timeLabel
          ? `Time (${regionIdx + 1}.3.1+${regionIdx + 1}.3.2)_`
          : block.prefix;

        CATEGORIES.forEach(cat => {
          METRICS.forEach((metric, metricIdx) => {
            const code = `${CODE_PREFIX}_${regionBase + block.offset + cat.offset + metricIdx}`;
            const description = prefix
              ? `${region}_${prefix}${cat.label}_${METRIC_LABELS[metric]}`
              : `${region}_${cat.label}_${METRIC_LABELS[metric]}`;

            if (cat.isTotal) {
              // MAIN block Total — use the SQL grand-total columns
              // (Total_Balance / Total_Depositor / Total_Account).
              if (block.key === 'main') {
                fields.push({
                  code,
                  description,
                  source: 'calculated',
                  calculation: () =>
                    regionData?.grandTotal?.[metric] || 0,
                });
                return;
              }

              // Other blocks' Total = R1 + R2 + R3 (per block)
              fields.push({
                code,
                description,
                source: 'calculated',
                calculation: (fieldMap) => {
                  let sum = 0;
                  for (let ri = 0; ri < 3; ri++) {
                    const c = `${CODE_PREFIX}_${regionBase + block.offset + ri * 3 + metricIdx}`;
                    sum += parseFloat(fieldMap[c] || 0);
                  }
                  return sum;
                },
              });
            } else {
              fields.push({
                code,
                description,
                source: 'calculated',
                calculation: () =>
                  computeBlockValue(regionData, block.key, cat.key, metric),
              });
            }
          });
        });
      });
    });

    /* ---------- Bottom "Total Deposits" block ---------- */
    CATEGORIES.forEach(cat => {
      METRICS.forEach((metric, metricIdx) => {
        const code = `${CODE_PREFIX}_${TOTAL_DEPOSITS_BASE + cat.offset + metricIdx}`;
        const description = `Total Deposits_${cat.label}_${METRIC_LABELS[metric]}`;

        if (cat.isTotal) {
          // Sum the SQL grand totals across all regions
          fields.push({
            code,
            description,
            source: 'calculated',
            calculation: () => {
              let sum = 0;
              TARGET_REGIONS.forEach((r) => {
                const gt = rawData[r]?.grandTotal;
                if (gt) sum += gt[metric] || 0;
              });
              return sum;
            },
          });
        } else {
          // Non-total rows: sum the corresponding range across all regions
          fields.push({
            code,
            description,
            source: 'calculated',
            calculation: (fieldMap) => {
              let sum = 0;
              TARGET_REGIONS.forEach((_, regionIdx) => {
                const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
                const mainCode = `${CODE_PREFIX}_${regionBase + cat.offset + metricIdx}`;
                sum += parseFloat(fieldMap[mainCode] || 0);
              });
              return sum;
            },
          });
        }
      });
    });

    return fields;
  },
};