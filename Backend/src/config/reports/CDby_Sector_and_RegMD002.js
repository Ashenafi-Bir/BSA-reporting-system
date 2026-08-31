import { fetchDepositBySectorData } from '../../services/depositBySectorService.js';

const REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'Somalia', 'Tigray',
  'Sidama', 'SWERS', 'CERS', 'SERS'
];

// Sectors in order (as they appear in JSON)
const SECTORS = ['public', 'private', 'gov', 'banks', 'others'];
// Metrics
const METRICS = ['amount', 'depositors', 'accounts'];
// Row types (order as in JSON)
const ROW_TYPES = ['total', 'demand', 'saving', 'time', 'urban', 'rural'];

// Starting code for first region's first row (total) first sector (public) first metric (amount)
const START_CODE = 47252;

// Fields per region: 6 rows × (5 sectors × 3 metrics + 3 total-across-sectors) = 6 × 18 = 108
const FIELDS_PER_REGION = ROW_TYPES.length * (SECTORS.length * METRICS.length + METRICS.length);

function getCode(regionIdx, rowIdx, fieldIdxInRow) {
  const offset = regionIdx * FIELDS_PER_REGION + rowIdx * (SECTORS.length * METRICS.length + METRICS.length) + fieldIdxInRow;
  const codeNum = START_CODE + offset;
  return `MD002_${String(codeNum).padStart(5, '0')}`;
}

export default {
  reportKey: 'CDby Sector and RegMD002',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  includeZeroValues: false,

  dataFetcher: fetchDepositBySectorData,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const fields = [];

    const sectorLabels = {
      public: 'Pub.  Enterprise',
      private: 'Private & Coop.',
      gov: 'Regional Gov.',
      banks: 'Banks',
      others: 'Others'
    };
    const metricLabels = {
      amount: 'Amount',
      depositors: '# of Depositors',
      accounts: '# of Accounts'
    };
    const rowLabels = {
      total: '',
      demand: 'Demand',
      saving: 'Saving',
      time: 'Time',
      urban: 'Urban',
      rural: 'Rural'
    };

    // ==================== 1. Per‑region fields ====================
    REGIONS.forEach((region, regionIdx) => {
      ROW_TYPES.forEach((rowType, rowIdx) => {
        // ---- a) Fields for each sector ----
        SECTORS.forEach((sector, sectorIdx) => {
          METRICS.forEach((metric, metricIdx) => {
            const fieldIdx = sectorIdx * METRICS.length + metricIdx;
            const code = getCode(regionIdx, rowIdx, fieldIdx);
            const desc = `${region}${rowLabels[rowType] ? '_' + rowLabels[rowType] : ''}_${sectorLabels[sector]}_${metricLabels[metric]}`;
            fields.push({
              code,
              description: desc,
              source: 'calculated',
              calculation: (fieldMap, rawData) => {
                const regionData = rawData[region];
                if (!regionData) return 0;
                const rowData = regionData[rowType];
                if (!rowData) return 0;
                const sectorData = rowData[sector];
                if (!sectorData) return 0;
                return sectorData[metric] || 0;
              }
            });
          });
        });

        // ---- b) Total across sectors for this row ----
        // These are the "Total _Amount", "Total _# of Depositors", "Total _# of Accounts" fields
        METRICS.forEach((metric, metricIdx) => {
          const fieldIdx = SECTORS.length * METRICS.length + metricIdx;
          const code = getCode(regionIdx, rowIdx, fieldIdx);
          const desc = `${region}${rowLabels[rowType] ? '_' + rowLabels[rowType] : ''}_Total_${metricLabels[metric]}`;
          fields.push({
            code,
            description: desc,
            source: 'calculated',
            calculation: (fieldMap, rawData) => {
              const regionData = rawData[region];
              if (!regionData) return 0;
              const rowData = regionData[rowType];
              if (!rowData) return 0;
              // Sum across all sectors
              let sum = 0;
              SECTORS.forEach(sector => {
                const sectorData = rowData[sector];
                if (sectorData) sum += sectorData[metric] || 0;
              });
              return sum;
            }
          });
        });
      });
    });

    // ==================== 2. Total Deposits (across all regions) ====================
    const totalStart = START_CODE + REGIONS.length * FIELDS_PER_REGION; // 48764

    // ---- a) By sector ----
    SECTORS.forEach((sector, sectorIdx) => {
      METRICS.forEach((metric, metricIdx) => {
        const codeNum = totalStart + sectorIdx * METRICS.length + metricIdx;
        const code = `MD002_${String(codeNum).padStart(5, '0')}`;
        const desc = `Total Deposits_${sectorLabels[sector]}_${metricLabels[metric]}`;
        fields.push({
          code,
          description: desc,
          source: 'calculated',
          calculation: (fieldMap, rawData) => {
            let sum = 0;
            REGIONS.forEach(region => {
              const regionData = rawData[region];
              if (!regionData) return;
              // Use the "total" row (sum of demand+saving+time)
              const totalRow = regionData.total;
              if (!totalRow) return;
              const sectorData = totalRow[sector];
              if (sectorData) sum += sectorData[metric] || 0;
            });
            return sum;
          }
        });
      });
    });

    // ---- b) Grand total across sectors ----
    const grandTotalStart = totalStart + SECTORS.length * METRICS.length;
    METRICS.forEach((metric, metricIdx) => {
      const codeNum = grandTotalStart + metricIdx;
      const code = `MD002_${String(codeNum).padStart(5, '0')}`;
      const desc = `Total Deposits_Total_${metricLabels[metric]}`;
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
            SECTORS.forEach(sector => {
              const sectorData = totalRow[sector];
              if (sectorData) sum += sectorData[metric] || 0;
            });
          });
          return sum;
        }
      });
    });

    return fields;
  }
};