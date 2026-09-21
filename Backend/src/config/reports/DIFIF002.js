import {
  fetchDepositBySectorIFB,
  TARGET_REGIONS,
} from '../../services/depositBySectorIFBService.js';

/* ------------------------------------------------------------------ */
/*  Code-layout constants (from the IF002 JSON dictionary)             */
/* ------------------------------------------------------------------ */
const BASE_CODE           = 53708;   // first code of Addis Ababa
const CODES_PER_REGION    = 144;     // 8 blocks × 6 categories × 3 metrics
const TOTAL_DEPOSITS_BASE = 55724;   // "Total Deposits" block

/* Categories within each block (18 codes = 6 categories × 3 metrics) */
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

/* 8 blocks per region */
const BLOCKS = [
  { key: 'main',         offset: 0   },
  { key: 'demand',       offset: 18  },
  { key: 'saving',       offset: 36  },
  { key: 'time',         offset: 54  },
  { key: 'restricted',   offset: 72  },
  { key: 'unrestricted', offset: 90  },
  { key: 'urban',        offset: 108 },
  { key: 'rural',        offset: 126 },
];

/* Prefixes used in the description column (for preview UI) */
function blockPrefix(blockKey, regionIdx) {
  const r = regionIdx + 1;
  switch (blockKey) {
    case 'main':         return '';
    case 'demand':       return 'Demand_';
    case 'saving':       return 'Saving_';
    case 'time':         return `Time (${r}.3.1+${r}.3.2)_`;
    case 'restricted':   return 'Restricted Investment Deposit_';
    case 'unrestricted': return 'Unrestricted Investment Deposit_';
    case 'urban':        return 'Urban_';
    case 'rural':        return 'Rural_';
    default:             return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Value calculation                                                  */
/* ------------------------------------------------------------------ */
function computeSectorValue(regionData, blockKey, category, metric) {
  if (!regionData) return 0;

  const pick = (loc, sub) => {
    const r = regionData[loc] && regionData[loc][sub] && regionData[loc][sub][category];
    return r ? (r[metric] || 0) : 0;
  };

  switch (blockKey) {
    case 'main':
      return pick('urban','demand')       + pick('urban','saving')
           + pick('urban','restricted')   + pick('urban','unrestricted')
           + pick('rural','demand')       + pick('rural','saving')
           + pick('rural','restricted')   + pick('rural','unrestricted');
    case 'demand':
      return pick('urban','demand') + pick('rural','demand');
    case 'saving':
      return pick('urban','saving') + pick('rural','saving');
    case 'time':
      // Time = Restricted + Unrestricted  (matches Excel =C20+C21)
      return pick('urban','restricted') + pick('urban','unrestricted')
           + pick('rural','restricted') + pick('rural','unrestricted');
    case 'restricted':
      return pick('urban','restricted') + pick('rural','restricted');
    case 'unrestricted':
      return pick('urban','unrestricted') + pick('rural','unrestricted');
    case 'urban':
      return pick('urban','demand')       + pick('urban','saving')
           + pick('urban','restricted')   + pick('urban','unrestricted');
    case 'rural':
      return pick('rural','demand')       + pick('rural','saving')
           + pick('rural','restricted')   + pick('rural','unrestricted');
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Config export                                                      */
/* ------------------------------------------------------------------ */
export default {
  reportKey: 'DIFIF002',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchDepositBySectorIFB,

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
        const prefix = blockPrefix(block.key, regionIdx);

        // 5 real sector categories
        CATEGORIES.forEach((cat, catIdx) => {
          METRICS.forEach((metric, metricIdx) => {
            const code = `IF002_${regionBase + block.offset + catIdx * 3 + metricIdx}`;
            const description = prefix
              ? `${region}_${prefix}${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`
              : `${region}_${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`;

            fields.push({
              code,
              description,
              source: 'calculated',
              calculation: () =>
                computeSectorValue(regionData, block.key, cat, metric),
            });
          });
        });

        // "Total" category per block = sum of the 5 real sectors (via fieldMap)
        METRICS.forEach((metric, metricIdx) => {
          const code = `IF002_${regionBase + block.offset + 5 * 3 + metricIdx}`;
          const description = prefix
            ? `${region}_${prefix}${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`
            : `${region}_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

          fields.push({
            code,
            description,
            source: 'calculated',
            calculation: (fieldMap) => {
              let sum = 0;
              for (let i = 0; i < CATEGORIES.length; i++) {
                const c = `IF002_${regionBase + block.offset + i * 3 + metricIdx}`;
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
        const code = `IF002_${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
        const description = `Total Deposits_${CATEGORY_LABELS[cat]}_${METRIC_LABELS[metric]}`;

        fields.push({
          code,
          description,
          source: 'calculated',
          calculation: (fieldMap) => {
            let sum = 0;
            TARGET_REGIONS.forEach((_, regionIdx) => {
              const regionBase = BASE_CODE + regionIdx * CODES_PER_REGION;
              // Sum the *main* block's matching category across all regions
              const mainCode = `IF002_${regionBase + catIdx * 3 + metricIdx}`;
              sum += parseFloat(fieldMap[mainCode] || 0);
            });
            return sum;
          },
        });
      });
    });

    // Total Deposits — Total column = sum of 5 categories (per metric)
    METRICS.forEach((metric, metricIdx) => {
      const code = `IF002_${TOTAL_DEPOSITS_BASE + 5 * 3 + metricIdx}`;
      const description = `Total Deposits_${CATEGORY_LABELS.total}_${METRIC_LABELS[metric]}`;

      fields.push({
        code,
        description,
        source: 'calculated',
        calculation: (fieldMap) => {
          let sum = 0;
          for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
            const c = `IF002_${TOTAL_DEPOSITS_BASE + catIdx * 3 + metricIdx}`;
            sum += parseFloat(fieldMap[c] || 0);
          }
          return sum;
        },
      });
    });

    return fields;
  },
};