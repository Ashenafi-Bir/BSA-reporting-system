import { fetchTopDepositorsData } from '../../services/topDepositorsService.js';

export default {
  reportKey: 'NBE_20_DEP_MR001',
  instCode: process.env.BSA_INST_CODE || '0000017',
  finYear: new Date().getFullYear(),
  dataFetcher: fetchTopDepositorsData,
  includeZeroValues: false,

  prepare(rawData) {
    // console.log('🔍 prepare() called with rawData:', rawData); // DEBUG

    // Ensure rawData is an array
    if (!Array.isArray(rawData)) {
      console.error('❌ rawData is not an array!');
      this.fields = [];
      this.dynamicItems = [];
      return this;
    }

    // Extract depositor rows (skip subtotal rows)
    const depositors = rawData.filter(row => row.CUSTNAME !== null && row.RANK !== null);
    const top10 = depositors.slice(0, 10);
    const top20 = depositors;

    // Sum helpers
    const sum = (arr, key) => arr.reduce((acc, r) => acc + parseFloat(r[key] || 0), 0);

    // Compute subtotals (in millions)
    const subtotal10Demand = sum(top10, 'DEMAND') / 1000000;
    const subtotal10Saving = sum(top10, 'SAVING') / 1000000;
    const subtotal10Fixed = sum(top10, 'FIXED') / 1000000;
    const subtotal10Total = sum(top10, 'TOTAL') / 1000000;

    const total20Demand = sum(top20, 'DEMAND') / 1000000;
    const total20Saving = sum(top20, 'SAVING') / 1000000;
    const total20Fixed = sum(top20, 'FIXED') / 1000000;
    const total20Total = sum(top20, 'TOTAL') / 1000000;

    // ─── Static summary fields ──────────────────────────────
    const staticFields = [
      { code: '17_00001', value: subtotal10Demand },
      { code: '17_00002', value: subtotal10Fixed },
      { code: '17_00003', value: total20Fixed },
      { code: '17_00004', value: total20Saving },
      { code: '17_00005', value: total20Demand },
      { code: '17_00006', value: subtotal10Total },
      { code: '17_00007', value: subtotal10Saving },
      { code: '17_00008', value: total20Total },
    ];

    this.fields = staticFields.map(f => ({
      code: f.code,
      description: '',
      source: 'calculated',
      calculation: () => f.value
    }));

    // ─── Dynamic items (rows) ──────────────────────────────
    const buildAreaItems = (rows, area) => {
      const items = [];
      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        const rowData = [
          { Code: '1.1', Value: String(rowNum) },
          { Code: '1.2', Value: row.CUSTNAME || '' },
          { Code: '1.3', Value: (parseFloat(row.DEMAND) / 1000000).toFixed(2) },
          { Code: '1.4', Value: (parseFloat(row.SAVING) / 1000000).toFixed(2) },
          { Code: '1.5', Value: (parseFloat(row.FIXED) / 1000000).toFixed(2) },
          { Code: '1.6', Value: '0' },
          { Code: '1.7', Value: (parseFloat(row.TOTAL) / 1000000).toFixed(2) },
        ];
        items.push(...rowData);
      });
      return {
        Area: area,
        _areaName: '',
        DynamicItems: items
      };
    };

    const area168 = buildAreaItems(top10, 168);
    const area169 = buildAreaItems(top20.slice(10), 169);
    area168._areaName = 'Top 10 Depositors';
    area169._areaName = 'Next 10 Depositors (11-20)';

    this.dynamicItems = [area168, area169];
    // console.log('✅ dynamicItems set:', JSON.stringify(this.dynamicItems, null, 2)); // DEBUG
    return this;
  }
};