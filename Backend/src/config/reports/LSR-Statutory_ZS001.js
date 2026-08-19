import { fetchLiquidityData } from '../../services/liquidityService.js';

const DAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];

const getCode = (base, idx) => {
  const num = base + idx;
  return `109_${String(num).padStart(5, '0')}`;
};

const STARTS = {
  NET_CURRENT_LIAB: 1,        // 109_00001
  CASH: 9,                    // 109_00009
  DEPOSITS_WITH_NBE: 17,      // 109_00017
  DEPOSITS_OTHER_BANKS: 25,   // 109_00025
  TREASURY_BILLS: 33,         // 109_00033
  NET_DUE_DOMESTIC: 41,       // 109_00041
  NET_DUE_FOREIGN: 49,        // 109_00049
  TOTAL_LIQUID_ASSETS: 57,    // 109_00057
  EXCESS_DEFICIT: 65,         // 109_00065
};

export default {
  reportKey: 'LSR-Statutory ZS001',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  dataFetcher: fetchLiquidityData,

  prepare(rawData) {
    // rawData already has exactly 7 days from fetchLiquidityData
    this.fields = this.buildFields(rawData);
    return this;
  },


  buildFields(rawData) {
    const fields = [];

    const addCategory = (startCode, descriptionPrefix, dayValueFn) => {
      DAYS.forEach((day, idx) => {
        const code = getCode(startCode, idx);
        const desc = `${descriptionPrefix}_${day}`;
        fields.push({
          code,
          description: desc,
          source: 'calculated',
          calculation: (fieldMap, rawData) => {
            const dayData = rawData[idx];
            if (!dayData) return 0;
            return dayValueFn(dayData);
          }
        });
      });
      const avgCode = getCode(startCode, 7);
      fields.push({
        code: avgCode,
        description: `${descriptionPrefix}_Weekly Average`,
        source: 'calculated',
        calculation: (fieldMap) => {
          let sum = 0;
          for (let i = 0; i < 7; i++) {
            const code = getCode(startCode, i);
            sum += parseFloat(fieldMap[code] || 0);
          }
          return sum / 7;
        }
      });
    };

    // (keep all the dayValueFn definitions the same as before)
    const netCurrentLiabFn = (dayData) => {
      const demand = dayData.demandDeposit || 0;
      const saving = dayData.savingDeposit || 0;
      const fixed = dayData.fixedDeposit || 0;
      const uncleared = dayData.unclearedEffectForeign || 0;
      const netLiab = (demand + saving + fixed) - uncleared + (fixed * 0.10664155167296) - (fixed * 0.876457417815628);
      return netLiab / 1000000;
    };

    const cashFn = (dayData) => (dayData.cashLocalForeignCurr || 0) / 1000000;
    const depositNbeFn = (dayData) => (dayData.depositWzNBE || 0) / 1000000;
    const depositOtherFn = (dayData) => (dayData.depositWzOtherBanks || 0) / 1000000;
    const treasuryFn = (dayData) => (dayData.treasuryBill || 0) / 1000000;
    const netDueDomesticFn = () => 0;
    const netDueForeignFn = () => 0;

    addCategory(STARTS.NET_CURRENT_LIAB, 'Net current liabilities', netCurrentLiabFn);
    addCategory(STARTS.CASH, 'Cash - local and foreign currency', cashFn);
    addCategory(STARTS.DEPOSITS_WITH_NBE, 'Deposits with NBE', depositNbeFn);
    addCategory(STARTS.DEPOSITS_OTHER_BANKS, 'Deposits with other local & foreign banks', depositOtherFn);
    addCategory(STARTS.TREASURY_BILLS, 'Treasury bills', treasuryFn);
    addCategory(STARTS.NET_DUE_DOMESTIC, 'Net due from Domestic banks*', netDueDomesticFn);
    addCategory(STARTS.NET_DUE_FOREIGN, 'Net due from Foreign banks*', netDueForeignFn);

    DAYS.forEach((day, idx) => {
      const code = getCode(STARTS.TOTAL_LIQUID_ASSETS, idx);
      const desc = `Total liquid assets (=sum 2.1 to 2.4 less 2.5 & 2.6)_${day}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const cash = parseFloat(fieldMap[getCode(STARTS.CASH, idx)] || 0);
          const depNbe = parseFloat(fieldMap[getCode(STARTS.DEPOSITS_WITH_NBE, idx)] || 0);
          const depOther = parseFloat(fieldMap[getCode(STARTS.DEPOSITS_OTHER_BANKS, idx)] || 0);
          const treas = parseFloat(fieldMap[getCode(STARTS.TREASURY_BILLS, idx)] || 0);
          const netDom = parseFloat(fieldMap[getCode(STARTS.NET_DUE_DOMESTIC, idx)] || 0);
          const netFor = parseFloat(fieldMap[getCode(STARTS.NET_DUE_FOREIGN, idx)] || 0);
          return cash + depNbe + depOther + treas - netDom - netFor;
        }
      });
    });
    fields.push({
      code: getCode(STARTS.TOTAL_LIQUID_ASSETS, 7),
      description: 'Total liquid assets (=sum 2.1 to 2.4 less 2.5 & 2.6)_Weekly Average',
      source: 'calculated',
      calculation: (fieldMap) => {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          sum += parseFloat(fieldMap[getCode(STARTS.TOTAL_LIQUID_ASSETS, i)] || 0);
        }
        return sum / 7;
      }
    });

    DAYS.forEach((day, idx) => {
      const code = getCode(STARTS.EXCESS_DEFICIT, idx);
      const desc = `Excess/deficit (2.7-1.2)_${day}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const totalLiq = parseFloat(fieldMap[getCode(STARTS.TOTAL_LIQUID_ASSETS, idx)] || 0);
          const netLiab = parseFloat(fieldMap[getCode(STARTS.NET_CURRENT_LIAB, idx)] || 0);
          const fifteenPercent = 0.15 * netLiab;
          return totalLiq - fifteenPercent;
        }
      });
    });
    fields.push({
      code: getCode(STARTS.EXCESS_DEFICIT, 7),
      description: 'Excess/deficit (2.7-1.2)_Weekly Average',
      source: 'calculated',
      calculation: (fieldMap) => {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          sum += parseFloat(fieldMap[getCode(STARTS.EXCESS_DEFICIT, i)] || 0);
        }
        return sum / 7;
      }
    });

    return fields;
  }
};