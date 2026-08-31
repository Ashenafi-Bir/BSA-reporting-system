import { fetchDepositBySectorData } from '../../services/adepositSectorService.js';

// Ordered list of regions as per the Excel / JSON
const REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'SNNP',
  'Somalia',
  'Tigray',
  'Sidama',
  'SWERS',
  'CERS',
  'SERS'
];

// Deposit types in display order
const DEPOSIT_TYPES = ['Total', 'Demand', 'Saving', 'Time'];
// Sectors in display order
const SECTORS = ['Pub. Enterprise', 'Private & Coop', 'Regional Gov', 'Banks', 'Others', 'Total'];

// Mapping to raw data field suffixes (from the service)
const SECTOR_MAP = {
  'Pub. Enterprise': 'PublicEnt',
  'Private & Coop': 'Private',
  'Regional Gov': 'Gove',
  'Banks': 'Bank',
  'Others': 'Other'
};

const DEPOSIT_MAP = {
  'Demand': 'demand',
  'Saving': 'saving',
  'Time': 'td'
};

// Helper to pad number to 5 digits
function pad(num) {
  return String(num).padStart(5, '0');
}

// Generate code: 136_ + 5‑digit number (1‑based)
function getCode(baseIndex, offset) {
  const num = baseIndex + offset;
  return `136_${pad(num)}`;
}

// Get raw value from rawData for a specific region, deposit type, sector, and measure
function getRaw(rawData, region, depositType, sector, measure) {
  const regionData = rawData[region] || {};
  const depKey = DEPOSIT_MAP[depositType];
  const secKey = SECTOR_MAP[sector];
  if (!depKey || !secKey) return 0;
  const fieldName = `${depKey}${secKey}${measure === 'Amount' ? '' : 'Count'}`;
  return regionData[fieldName] || 0;
}

// Compute value for a given combination, handling totals
function computeValue(rawData, region, depositType, sector, measure) {
  // Grand total (Total deposit × Total sector)
  if (depositType === 'Total' && sector === 'Total') {
    let sum = 0;
    for (const dt of ['Demand', 'Saving', 'Time']) {
      for (const sec of ['Pub. Enterprise', 'Private & Coop', 'Regional Gov', 'Banks', 'Others']) {
        sum += getRaw(rawData, region, dt, sec, measure);
      }
    }
    return sum;
  }

  // Total deposit type – sum across Demand, Saving, Time for the given sector
  if (depositType === 'Total') {
    let sum = 0;
    for (const dt of ['Demand', 'Saving', 'Time']) {
      sum += getRaw(rawData, region, dt, sector, measure);
    }
    return sum;
  }

  // Total sector – sum across all non‑Total sectors for the given deposit type
  if (sector === 'Total') {
    let sum = 0;
    for (const sec of ['Pub. Enterprise', 'Private & Coop', 'Regional Gov', 'Banks', 'Others']) {
      sum += getRaw(rawData, region, depositType, sec, measure);
    }
    return sum;
  }

  // Direct raw value
  return getRaw(rawData, region, depositType, sector, measure);
}

// Build the exact description string to match the JSON dictionary
function buildDescription(region, depositType, sector, measure) {
  let desc = region;

  if (depositType !== 'Total') {
    desc += '_' + depositType;
  }

  if (sector !== 'Total') {
    desc += '_' + sector;
  } else {
    // For sector 'Total', we need a space before the measure underscore
    desc += '_Total';
  }

  if (measure === 'Amount') {
    if (sector === 'Total') {
      desc = desc.replace('_Total', '_Total ');
    }
    desc += '_Amount';
  } else {
    // Count measure
    if (sector === 'Total') {
      desc = desc.replace('_Total', '_Total ');
    }
    desc += '_# of Accounts '; // trailing space as in JSON
  }

  return desc;
}

export default {
  reportKey: 'CD by S and RegMD001',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  dataFetcher: fetchDepositBySectorData,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    const fields = [];

    REGIONS.forEach((region, regionIndex) => {
      const baseNum = regionIndex * 48 + 1; // each region occupies 48 codes

      DEPOSIT_TYPES.forEach((depositType, typeIdx) => {
        const typeOffset = typeIdx * 12; // 0, 12, 24, 36

        SECTORS.forEach((sector, sectorIdx) => {
          const sectorOffset = sectorIdx * 2; // 0,2,4,6,8,10

          // Amount field
          const amountCode = getCode(baseNum, typeOffset + sectorOffset);
          const amountDesc = buildDescription(region, depositType, sector, 'Amount');
          fields.push({
            code: amountCode,
            description: amountDesc,
            source: 'calculated',
            calculation: (fieldMap, rawData) => {
              return computeValue(rawData, region, depositType, sector, 'Amount');
            }
          });

          // Count field
          const countCode = getCode(baseNum, typeOffset + sectorOffset + 1);
          const countDesc = buildDescription(region, depositType, sector, 'Count');
          fields.push({
            code: countCode,
            description: countDesc,
            source: 'calculated',
            calculation: (fieldMap, rawData) => {
              return computeValue(rawData, region, depositType, sector, 'Count');
            }
          });
        });
      });
    });

    return fields;
  }
};