import { fetchDepositByRangeData } from '../../services/depositByRangeService.js';

const REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray',
  'Sidama', 'SWERS', 'CERS', 'SERS'
];

// Number of fields per sub-row (12)
const FIELDS_PER_ROW = 12;
// Sub-rows per region: total, demand, saving, time, urban, rural = 6
const ROWS_PER_REGION = 6;
// Total fields per region = 72
const FIELDS_PER_REGION = ROWS_PER_REGION * FIELDS_PER_ROW;

// Starting code for Addis Ababa (first region)
const START_CODE = 46232;

// Helper to compute code based on region index, sub-row index, and field index within row
function getCode(regionIdx, rowIdx, fieldIdx) {
  const base = START_CODE + regionIdx * FIELDS_PER_REGION + rowIdx * FIELDS_PER_ROW + fieldIdx;
  return `CM002_${String(base).padStart(5, '0')}`;
}

// Sub-row types and their corresponding data keys in rawData
const ROW_TYPES = [
  { key: 'total', label: '' },
  { key: 'demand', label: 'Demand' },
  { key: 'saving', label: 'Saving' },
  { key: 'time', label: 'Time' },
  { key: 'urban', label: 'Urban' },
  { key: 'rural', label: 'Rural' }
];

// Band and metric order
const BANDS = [
  { key: 'upToHundred', label: '<= Birr 100,000' },
  { key: 'upToMillion', label: '>Birr 100,000-1million' },
  { key: 'aboveMillion', label: '> Birr 1 million' }
];
const METRICS = [
  { key: 'amount', label: 'Amount' },
  { key: 'depositors', label: '# of Depositors' },
  { key: 'accounts', label: '# of Accounts' }
];

export default {
  reportKey: 'CDby Range and RegCM002',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  includeZeroValues: false, // exclude zero values from payload

  dataFetcher: fetchDepositByRangeData,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const fields = [];

    // Helper to get a value and divide amount by 1e6
    const getValue = (regionData, rowTypeKey, bandKey, metricKey) => {
      const rowData = regionData[rowTypeKey];
      if (!rowData) return 0;
      const bandData = rowData[bandKey];
      if (!bandData) return 0;
      let val = bandData[metricKey] || 0;
      if (metricKey === 'amount') {
        val = val / 1000000;
      }
      return val;
    };

    // 1. Fields per region
    REGIONS.forEach((region, regionIdx) => {
      ROW_TYPES.forEach((rowType, rowIdx) => {
        // First 9: bands (3 bands × 3 metrics)
        BANDS.forEach((band, bandIdx) => {
          METRICS.forEach((metric, metricIdx) => {
            const fieldIdx = bandIdx * METRICS.length + metricIdx;
            const code = getCode(regionIdx, rowIdx, fieldIdx);
            const desc = `${region}${rowType.label ? '_' + rowType.label : ''}_${band.label}_${metric.label}`;
            fields.push({
              code,
              description: desc,
              source: 'calculated',
              calculation: (fieldMap, rawData) => {
                const regionData = rawData[region];
                if (!regionData) return 0;
                return getValue(regionData, rowType.key, band.key, metric.key);
              }
            });
          });
        });

        // Last 3: totals across bands (Amount, Depositors, Accounts)
        METRICS.forEach((metric, metricIdx) => {
          const fieldIdx = BANDS.length * METRICS.length + metricIdx;
          const code = getCode(regionIdx, rowIdx, fieldIdx);
          const desc = `${region}${rowType.label ? '_' + rowType.label : ''}_Total_${metric.label}`;
          fields.push({
            code,
            description: desc,
            source: 'calculated',
            calculation: (fieldMap, rawData) => {
              const regionData = rawData[region];
              if (!regionData) return 0;
              const rowData = regionData[rowType.key];
              if (!rowData) return 0;
              let val = rowData.totals[metric.key] || 0;
              if (metric.key === 'amount') {
                val = val / 1000000;
              }
              return val;
            }
          });
        });
      });
    });

    // 2. Total Deposits row (across all regions)
    const totalStartCode = START_CODE + REGIONS.length * FIELDS_PER_REGION;
    BANDS.forEach((band, bandIdx) => {
      METRICS.forEach((metric, metricIdx) => {
        const idx = bandIdx * METRICS.length + metricIdx;
        const code = `CM002_${String(totalStartCode + idx).padStart(5, '0')}`;
        const desc = `Total Deposits_${band.label}_${metric.label}`;
        fields.push({
          code,
          description: desc,
          source: 'calculated',
          calculation: (fieldMap, rawData) => {
            let sum = 0;
            REGIONS.forEach(region => {
              const regionData = rawData[region];
              if (!regionData) return;
              const totalRow = regionData.total;
              if (!totalRow) return;
              const bandData = totalRow[band.key];
              if (!bandData) return;
              let val = bandData[metric.key] || 0;
              if (metric.key === 'amount') {
                val = val / 1000000;
              }
              sum += val;
            });
            return sum;
          }
        });
      });
    });

    // Totals across bands for Total Deposits
    METRICS.forEach((metric, metricIdx) => {
      const idx = BANDS.length * METRICS.length + metricIdx;
      const code = `CM002_${String(totalStartCode + idx).padStart(5, '0')}`;
      const desc = `Total Deposits_Total_${metric.label}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap, rawData) => {
          let sum = 0;
          REGIONS.forEach(region => {
            const regionData = rawData[region];
            if (!regionData) return;
            const totalRow = regionData.total;
            if (!totalRow) return;
            let val = totalRow.totals[metric.key] || 0;
            if (metric.key === 'amount') {
              val = val / 1000000;
            }
            sum += val;
          });
          return sum;
        }
      });
    });

    return fields;
  }
};