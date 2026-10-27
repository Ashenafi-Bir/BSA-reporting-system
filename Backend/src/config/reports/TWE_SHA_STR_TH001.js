// import { fetchTop20ShareholdingData } from '../../services/top20ShareholdingService.js';

// /* Helper: build a "70_NNNNN" code */
// const cid = (n) => `70_${String(n).padStart(5, '0')}`;

// /* Empty shareholder placeholder for when fewer than 20 exist */
// const EMPTY_SH = () => ({ name: '', subscribed: 0, paidUp: 0, pctSub: 0, pctPaid: 0 });

// export default {
//   reportKey: 'TWE_SHA_STR_TH001',
//   instCode:  process.env.BSA_INST_CODE,
//   finYear:   new Date().getFullYear(),
//   dataFetcher: fetchTop20ShareholdingData,

//   // Template expects every field present, even when 0 / empty
//   includeZeroValues: true,

//   prepare(rawData) {
//     this.fields = this.buildFields(rawData);
//     this.dynamicItems = this.buildDynamicItems(rawData);
//     return this;
//   },

//   /* -------------------------------------------------------------- */
//   /*  ReturnItemsList — 105 fields (dictionary skips some codes)    */
//   /* -------------------------------------------------------------- */
//   buildFields(rawData) {
//     const sh = rawData.shareholders || [];
//     const getSh = (idx0) => sh[idx0] || EMPTY_SH();

//     const fields = [];

//     /* ---------- Sub-total / Remaining / Grand total (6 fields) ---------- */
//     fields.push({ code: cid(1),  description: 'Sub-total_Subscribed share',                          source: 'calculated', calculation: () => rawData.subtotalSub });
//     fields.push({ code: cid(2),  description: 'Sub-total_Paid-up share',                             source: 'calculated', calculation: () => rawData.subtotalPaid });
//     fields.push({ code: cid(5),  description: 'The remaining shares all together_Subscribed share', source: 'calculated', calculation: () => rawData.remainingSub });
//     fields.push({ code: cid(6),  description: 'The remaining shares all together_Paid-up share',    source: 'calculated', calculation: () => rawData.remainingPaid });
//     fields.push({ code: cid(9),  description: 'Grand total_Subscribed share',                        source: 'calculated', calculation: () => rawData.grandTotalSub });
//     fields.push({ code: cid(10), description: 'Grand total_Paid-up share',                           source: 'calculated', calculation: () => rawData.grandTotalPaid });

//     /* ---------- Name of shareholder_1 … _20 (codes 70_00013 … 70_00032) ---------- */
//     for (let i = 1; i <= 20; i++) {
//       const idx = i - 1;
//       fields.push({
//         code: cid(12 + i),
//         description: `Name of shareholder_${i}`,
//         source: 'calculated',
//         calculation: () => getSh(idx).name,
//       });
//     }

//     /* ---------- Subscribed share_1 … _20 (codes 70_00033 … 70_00052) ---------- */
//     for (let i = 1; i <= 20; i++) {
//       const idx = i - 1;
//       fields.push({
//         code: cid(32 + i),
//         description: `Subscribed share_${i}`,
//         source: 'calculated',
//         calculation: () => getSh(idx).subscribed,
//       });
//     }

//     /* ---------- Paid-up share_1 … _20 (codes 70_00053 … 70_00072) ---------- */
//     for (let i = 1; i <= 20; i++) {
//       const idx = i - 1;
//       fields.push({
//         code: cid(52 + i),
//         description: `Paid-up share_${i}`,
//         source: 'calculated',
//         calculation: () => getSh(idx).paidUp,
//       });
//     }

//     /* ---------- % of Paid-up share_1 … _20 (codes 70_00073 … 70_00092) ---------- */
//     for (let i = 1; i <= 20; i++) {
//       const idx = i - 1;
//       fields.push({
//         code: cid(72 + i),
//         description: `% of Paid-up share_${i}`,
//         source: 'calculated',
//         calculation: () => getSh(idx).pctPaid,
//       });
//     }

//     /* ---------- % of Subscribed share_2 … _20 (codes 70_00093 … 70_00111) ----------
//        NOTE: the BSA dictionary SKIPS _1 on purpose — do NOT add it here,
//        otherwise all subsequent codes will be off by one. */
//     for (let i = 2; i <= 20; i++) {
//       const idx = i - 1;
//       fields.push({
//         code: cid(91 + i),
//         description: `% of Subscribed share_${i}`,
//         source: 'calculated',
//         calculation: () => getSh(idx).pctSub,
//       });
//     }

//     return fields;
//   },

//   /* -------------------------------------------------------------- */
//   /*  DynamicItemsList — 20 areas × 6 fields (matches dictionary)   */
//   /* -------------------------------------------------------------- */
//   buildDynamicItems(rawData) {
//     const sh = rawData.shareholders || [];
//     const areas = [];

//     for (let i = 0; i < 20; i++) {
//       const row = sh[i] || EMPTY_SH();

//       areas.push({
//         Area: 161,          // dictionary uses Area 161 for every row
//         _areaName: null,
//         DynamicItems: [
//           { Code: '1.1', Value: String(i + 1),          _description: 'S.No',                      _dataType: 'NUMERIC' },
//           { Code: '1.2', Value: row.name || '',         _description: 'Name of shareholder',       _dataType: 'TEXT'    },
//           { Code: '1.3', Value: String(row.subscribed), _description: 'Subscribed share',          _dataType: 'NUMERIC' },
//           { Code: '1.4', Value: String(row.paidUp),     _description: 'Paid-up share',             _dataType: 'NUMERIC' },
//           { Code: '1.5', Value: String(row.pctPaid),    _description: '% of Paid-up share ',       _dataType: 'NUMERIC' },
//           { Code: '1.6', Value: String(row.pctSub),     _description: '% of Subscribed capital',    _dataType: 'NUMERIC' },
//         ],
//       });
//     }

//     return areas;
//   },
// };

// config/reports/TWE_SHA_STR_TH001.js
import { fetchTop20ShareholdingData } from '../../services/top20ShareholdingService.js';

/* Helper: build a "70_NNNNN" code */
const cid = (n) => `70_${String(n).padStart(5, '0')}`;

/* Empty shareholder placeholder for missing rows */
const EMPTY_SH = () => ({
  name: '',
  subscribed: 0,
  paidUp: 0,
  pctSub: 0,
  pctPaid: 0,
});

export default {
  reportKey: 'TWE_SHA_STR_TH001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchTop20ShareholdingData,

  // The 6 summary items must ALWAYS be present, even if 0
  includeZeroValues: true,

  prepare(rawData) {
    this.fields       = this.buildFields(rawData);
    this.dynamicItems = this.buildDynamicItems(rawData);
    return this;
  },

  /* -------------------------------------------------------------- */
  /*  ReturnItemsList — ONLY the 6 summary totals                   */
  /*  Codes: 70_00001, 70_00002, 70_00005, 70_00006,                */
  /*         70_00009, 70_00010                                     */
  /* -------------------------------------------------------------- */
  buildFields(rawData) {
    return [
      {
        code: cid(1),
        description: 'Sub-total_Subscribed share',
        source: 'calculated',
        calculation: () => rawData.subtotalSub,
      },
      {
        code: cid(2),
        description: 'Sub-total_Paid-up share',
        source: 'calculated',
        calculation: () => rawData.subtotalPaid,
      },
      {
        code: cid(5),
        description: 'The remaining shares all together_Subscribed share',
        source: 'calculated',
        calculation: () => rawData.remainingSub,
      },
      {
        code: cid(6),
        description: 'The remaining shares all together_Paid-up share',
        source: 'calculated',
        calculation: () => rawData.remainingPaid,
      },
      {
        code: cid(9),
        description: 'Grand total_Subscribed share',
        source: 'calculated',
        calculation: () => rawData.grandTotalSub,
      },
      {
        code: cid(10),
        description: 'Grand total_Paid-up share',
        source: 'calculated',
        calculation: () => rawData.grandTotalPaid,
      },
    ];
  },

  /* -------------------------------------------------------------- */
  /*  DynamicItemsList — 20 areas × 6 fields per shareholder        */
  /*  Each row: S.No, Name, Subscribed, Paid-up, % Paid, % Sub      */
  /* -------------------------------------------------------------- */
  buildDynamicItems(rawData) {
    const sh = rawData.shareholders || [];
    const areas = [];

    for (let i = 0; i < 20; i++) {
      const row = sh[i] || EMPTY_SH();

      areas.push({
        Area: 161,          // dictionary uses Area 161 for every row
        _areaName: null,
        DynamicItems: [
          { Code: '1.1', Value: String(i + 1),           _description: 'S.No',                    _dataType: 'NUMERIC' },
          { Code: '1.2', Value: row.name || '',          _description: 'Name of shareholder',     _dataType: 'TEXT'    },
          { Code: '1.3', Value: String(row.subscribed),  _description: 'Subscribed share',        _dataType: 'NUMERIC' },
          { Code: '1.4', Value: String(row.paidUp),      _description: 'Paid-up share',           _dataType: 'NUMERIC' },
          { Code: '1.5', Value: String(row.pctPaid),     _description: '% of Paid-up share ',     _dataType: 'NUMERIC' },
          { Code: '1.6', Value: String(row.pctSub),      _description: '% of Subscribed capital', _dataType: 'NUMERIC' },
        ],
      });
    }

    return areas;
  },
};