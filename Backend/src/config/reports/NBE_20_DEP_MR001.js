import { fetchTop20DepositorsData } from '../../services/top20DepositorsService.js';

const MILLION = 1_000_000;
const BASE_AREA = 168; // Area 168 = Top #1, …, Area 187 = Top #20

/**
 * Builds the 7-item payload row (Codes 1.1 … 1.7) for one depositor.
 * Every Value is guaranteed non-empty because BSA requires all
 * DynamicItems[i].Value fields (even optional ones) to be present.
 */
function buildDynamicRow(sno, row) {
  const demand   = (row?.demand   || 0) / MILLION;
  const saving   = (row?.saving   || 0) / MILLION;
  const fixed    = (row?.fixed    || 0) / MILLION;
  const total    = (row?.total    || 0) / MILLION;
  const daysLeft = Number.isFinite(row?.daysLeft) ? row.daysLeft : 0;

  const name = (row?.custName && String(row.custName).trim()) || 'N/A';

  return [
    { Code: '1.1', Value: String(sno) },                 // S.No
    { Code: '1.2', Value: demand.toFixed(2) },           // Demand/Current
    { Code: '1.3', Value: saving.toFixed(2) },           // Saving
    { Code: '1.4', Value: fixed.toFixed(2) },            // Time/Fixed
    { Code: '1.5', Value: String(daysLeft) },            // Days Left ← was "" → now "0"
    { Code: '1.6', Value: total.toFixed(2) },            // Total per depositor
    { Code: '1.7', Value: name },                        // Name of Depositor
  ];
}

export default {
  reportKey: 'NBE_20_DEP_MR001',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  dataFetcher: fetchTop20DepositorsData,

  // Subtotal / grand-total lines are structural — always emit them even if 0.
  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    this.dynamicItems = this.buildDynamicItems(rawData);
    return this;
  },

  buildFields(rawData) {
    const sub10 = rawData?.top10Subtotal;
    const sub20 = rawData?.top20Subtotal;
    const val = (v) => (v || 0) / MILLION;

    return [
      { code: '17_00001', description: 'Sub total top ten (10)_Demand/Current',       source: 'calculated', calculation: () => val(sub10?.demand) },
      { code: '17_00002', description: 'Sub total top ten (10)_Time/Fixed',           source: 'calculated', calculation: () => val(sub10?.fixed)  },
      { code: '17_00003', description: 'Grand total top twenty (20)_Time/Fixed',      source: 'calculated', calculation: () => val(sub20?.fixed)  },
      { code: '17_00004', description: 'Grand total top twenty (20)_Saving',          source: 'calculated', calculation: () => val(sub20?.saving) },
      { code: '17_00005', description: 'Grand total top twenty (20)_Demand/Current',  source: 'calculated', calculation: () => val(sub20?.demand) },
      { code: '17_00006', description: 'Sub total top ten (10)_Total per depositor',  source: 'calculated', calculation: () => val(sub10?.total)  },
      { code: '17_00007', description: 'Sub total top ten (10)_Saving',               source: 'calculated', calculation: () => val(sub10?.saving) },
      { code: '17_00008', description: 'Grand total top twenty (20)_Total per depositor', source: 'calculated', calculation: () => val(sub20?.total) },
    ];
  },

  /**
   * DynamicItemsList — 20 Areas (168 … 187), one per depositor row.
   * Every DynamicItems entry is guaranteed to have a non-empty Value.
   */
  buildDynamicItems(rawData) {
    const orderedCustomers = [
      ...(rawData?.top10 || []),      // ranks 1..10
      ...(rawData?.top11to20 || []),  // ranks 11..20
    ];

    const areas = [];
    orderedCustomers.forEach((row, idx) => {
      areas.push({
        Area: BASE_AREA + idx,
        _areaName: null,
        DynamicItems: buildDynamicRow(idx + 1, row),
      });
    });

    return areas;
  },
};