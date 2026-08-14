// SINGLE_CURRENCYOP001.js – complete, corrected configuration

const CURRENCIES = [
  'USD', 'EUR', 'CHF', 'GBP', 'JPY', 'DJF', 'KES', 'INR',
  'DKK', 'SEK', 'SAR', 'CAD', 'AED', 'AUD', 'CNY', 'NOK',
  'KWD', 'Others1', 'Others2', 'Others3'
];

// Helper: generate code from start and index
const getCode = (start, index) => {
  const num = start + index;
  return `164_${String(num).padStart(5, '0')}`;
};

// Start codes for each category (first code for USD)
const STARTS = {
  ON_BALANCE_ASSET: 1,          // 164_00001
  CURRENCY_ON_HAND: 21,         // 164_00021
  DUE_FROM_BANKS: 41,           // 164_00041
  CHEQUES_IN_TRANSIT: 61,       // 164_00061
  LOANS_ADVANCES: 81,           // 164_00081
  ACCRUED_INTEREST_REC: 101,    // 164_00101
  OTHER_ASSETS: 121,            // 164_00121
  OFF_BALANCE_ASSET: 141,       // 164_00141
  UNDELIVERED_SPOT_PURCHASE: 161, // 164_00161
  FORWARD_PURCHASE: 181,        // 164_00181
  OPTIONS_SWAPS_DERIVATIVES_ASSET: 201, // 164_00201
  OTHER_ASSETS_OFF: 221,        // 164_00221
  TOTAL_FOREIGN_ASSETS: 241,    // 164_00241
  ON_BALANCE_LIABILITY: 261,    // 164_00261
  DUE_TO_BANKS_ABROAD: 281,     // 164_00281
  FOREIGN_CURRENCY_DEPOSITS: 301, // 164_00301
  BORROWINGS: 321,              // 164_00321
  ACCRUED_INTEREST_PAY: 341,    // 164_00341
  OTHER_LIABILITIES: 361,       // 164_00361
  OFF_BALANCE_LIABILITY: 381,   // 164_00381
  UNDELIVERED_SPOT_SALES: 401,  // 164_00401
  FORWARD_SALES: 421,           // 164_00421
  OPTIONS_SWAPS_DERIVATIVES_LIAB: 441, // 164_00441
  LETTER_OF_CREDIT: 461,        // 164_00461
  GUARANTEES: 481,              // 164_00481
  OTHER_LIABILITIES_OFF: 501,   // 164_00501
  TOTAL_FOREIGN_LIABILITIES: 521, // 164_00521
  NET_LONG: 541,                // 164_00541
  NET_SHORT: 561,               // 164_00561
  MID_EXCHANGE_RATE: 581,       // 164_00581
  NET_LONG_BIRR: 601,           // 164_00601
  NET_SHORT_BIRR: 621,          // 164_00621
  NET_OPEN_POSITION: 641,       // 164_00641
  NET_OPEN_POSITION_RATIO: 661, // 164_00661
};

const generateFields = () => {
  const fields = [];

  // Helper to add a CBS category (all currencies)
  const addCbsCategory = (startCode, cbsKey, descriptionPrefix) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'cbs',
        cbsQuery: (rawData) => {
          if (currency === 'Others1' || currency === 'Others2' || currency === 'Others3') return 0;
          return rawData[cbsKey]?.[currency] || 0;
        }
      });
    });
  };

  // Helper to add a calculated sum that sums specific child categories
  const addSum = (startCode, descriptionPrefix, childStarts) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          let sum = 0;
          childStarts.forEach(childStart => {
            const childCode = getCode(childStart, idx);
            sum += parseFloat(fieldMap[childCode] || 0);
          });
          return sum;
        }
      });
    });
  };

  // Helper to add a simple binary calculation (e.g., Total Foreign Assets = OnBalance + OffBalance)
  const addBinaryCalc = (startCode, descriptionPrefix, code1Start, code2Start) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const val1 = parseFloat(fieldMap[getCode(code1Start, idx)] || 0);
          const val2 = parseFloat(fieldMap[getCode(code2Start, idx)] || 0);
          return val1 + val2;
        }
      });
    });
  };

  // Helper for multiplication (e.g., Net Long * Mid Rate)
  const addMulCalc = (startCode, descriptionPrefix, code1Start, code2Start) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const val1 = parseFloat(fieldMap[getCode(code1Start, idx)] || 0);
          const val2 = parseFloat(fieldMap[getCode(code2Start, idx)] || 1);
          return val1 * val2;
        }
      });
    });
  };

  // Helper for max between two fields
  const addMaxCalc = (startCode, descriptionPrefix, code1Start, code2Start) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const val1 = parseFloat(fieldMap[getCode(code1Start, idx)] || 0);
          const val2 = parseFloat(fieldMap[getCode(code2Start, idx)] || 0);
          return Math.max(val1, val2);
        }
      });
    });
  };

  // Helper for ratio (Net Open Position / Tier1 Capital) * 100
  const addRatioCalc = (startCode, descriptionPrefix, code1Start) => {
    CURRENCIES.forEach((currency, idx) => {
      const code = getCode(startCode, idx);
      const desc = `${descriptionPrefix}_${currency}`;
      fields.push({
        code,
        description: desc,
        source: 'calculated',
        calculation: (fieldMap) => {
          const numerator = parseFloat(fieldMap[getCode(code1Start, idx)] || 0);
          const denominator = parseFloat(fieldMap['164_00684'] || 0);
          if (denominator === 0) return 0;
          return (numerator / denominator) * 100;
        }
      });
    });
  };

  // -------------------------------------------------------
  // 1. FIRST: All CBS fields (individual categories)
  // -------------------------------------------------------
  addCbsCategory(STARTS.CURRENCY_ON_HAND, 'currencyOnHand', 'Currency on hand');
  addCbsCategory(STARTS.DUE_FROM_BANKS, 'dueFromBanks', 'Due from banks');
  addCbsCategory(STARTS.CHEQUES_IN_TRANSIT, 'chequesInTransit', 'Cheques and items in transit');
  addCbsCategory(STARTS.LOANS_ADVANCES, 'loansAdvances', 'Loans and Advances');
  addCbsCategory(STARTS.ACCRUED_INTEREST_REC, 'accruedInterestReceivables', 'Accrued interest receivables');
  addCbsCategory(STARTS.OTHER_ASSETS, 'otherAssets', 'Other assets');

  addCbsCategory(STARTS.UNDELIVERED_SPOT_PURCHASE, 'undeliveredSpotPurchase', 'Undelivered spot purchase');
  addCbsCategory(STARTS.FORWARD_PURCHASE, 'forwardPurchase', 'Forward purchase');
  addCbsCategory(STARTS.OPTIONS_SWAPS_DERIVATIVES_ASSET, 'optionsSwapsDerivatives', 'Option, Swaps, Derivatives (Assets)');
  addCbsCategory(STARTS.OTHER_ASSETS_OFF, 'offBalanceOtherAssets', 'Other assets (Off-balance)');

  addCbsCategory(STARTS.DUE_TO_BANKS_ABROAD, 'dueToBanksAbroad', 'Due to banks abroad');
  addCbsCategory(STARTS.FOREIGN_CURRENCY_DEPOSITS, 'foreignCurrencyDeposits', 'Foreign Currency Deposits');
  addCbsCategory(STARTS.BORROWINGS, 'borrowings', 'Borrowings');
  addCbsCategory(STARTS.ACCRUED_INTEREST_PAY, 'accruedInterestPayables', 'Accrued Interest Payables');
  addCbsCategory(STARTS.OTHER_LIABILITIES, 'otherLiabilities', 'Other Liabilities');

  addCbsCategory(STARTS.UNDELIVERED_SPOT_SALES, 'undeliveredSpotSales', 'Undelivered spot sales');
  addCbsCategory(STARTS.FORWARD_SALES, 'forwardSales', 'Forward sales');
  addCbsCategory(STARTS.OPTIONS_SWAPS_DERIVATIVES_LIAB, 'liabOptionsSwapsDerivatives', 'Option, Swaps, Derivatives (Liabilities)');
  addCbsCategory(STARTS.LETTER_OF_CREDIT, 'letterOfCredit', 'Letter of credit');
  addCbsCategory(STARTS.GUARANTEES, 'guarantees', 'Guarantees');
  addCbsCategory(STARTS.OTHER_LIABILITIES_OFF, 'liabOtherLiabilities', 'Other liabilities (Off-balance)');

  addCbsCategory(STARTS.MID_EXCHANGE_RATE, 'midExchangeRates', 'Mid-exchange rate');

  // Tier 1 Capital (CBS)
  fields.push({
    code: '164_00684',
    description: 'Tier 1 Capital_Overall Exposure',
    source: 'cbs',
    cbsQuery: (rawData) => rawData.tier1Capital || 0
  });

  // -------------------------------------------------------
  // 2. THEN: All calculated fields (depend on CBS fields)
  // -------------------------------------------------------

  // 1.1 On-balance Sheet Items = sum of six child categories
  addSum(STARTS.ON_BALANCE_ASSET, 'On-balance Sheet Items', [
    STARTS.CURRENCY_ON_HAND,
    STARTS.DUE_FROM_BANKS,
    STARTS.CHEQUES_IN_TRANSIT,
    STARTS.LOANS_ADVANCES,
    STARTS.ACCRUED_INTEREST_REC,
    STARTS.OTHER_ASSETS
  ]);

  // 1.2 Off-balance Sheet Items = sum of four child categories
  addSum(STARTS.OFF_BALANCE_ASSET, 'Off-balance Sheet Items', [
    STARTS.UNDELIVERED_SPOT_PURCHASE,
    STARTS.FORWARD_PURCHASE,
    STARTS.OPTIONS_SWAPS_DERIVATIVES_ASSET,
    STARTS.OTHER_ASSETS_OFF
  ]);

  // Total Foreign Assets = OnBalance + OffBalance
  addBinaryCalc(STARTS.TOTAL_FOREIGN_ASSETS, 'Total Foreign Assets',
    STARTS.ON_BALANCE_ASSET, STARTS.OFF_BALANCE_ASSET);

  // 2.1 On-balance Liabilities = sum of five child categories
  addSum(STARTS.ON_BALANCE_LIABILITY, 'On-balance Sheet Items (Liabilities)', [
    STARTS.DUE_TO_BANKS_ABROAD,
    STARTS.FOREIGN_CURRENCY_DEPOSITS,
    STARTS.BORROWINGS,
    STARTS.ACCRUED_INTEREST_PAY,
    STARTS.OTHER_LIABILITIES
  ]);

  // 2.2 Off-balance Liabilities = sum of six child categories
  addSum(STARTS.OFF_BALANCE_LIABILITY, 'Off-balance Sheet Items (Liabilities)', [
    STARTS.UNDELIVERED_SPOT_SALES,
    STARTS.FORWARD_SALES,
    STARTS.OPTIONS_SWAPS_DERIVATIVES_LIAB,
    STARTS.LETTER_OF_CREDIT,
    STARTS.GUARANTEES,
    STARTS.OTHER_LIABILITIES_OFF
  ]);

  // Total Foreign Liabilities = OnBalanceLiab + OffBalanceLiab
  addBinaryCalc(STARTS.TOTAL_FOREIGN_LIABILITIES, 'Total Foreign Liabilities',
    STARTS.ON_BALANCE_LIABILITY, STARTS.OFF_BALANCE_LIABILITY);

  // Net long position (max(Assets - Liabilities, 0))
  CURRENCIES.forEach((currency, idx) => {
    const code = getCode(STARTS.NET_LONG, idx);
    fields.push({
      code,
      description: `Net long position_${currency}`,
      source: 'calculated',
      calculation: (fieldMap) => {
        const assets = parseFloat(fieldMap[getCode(STARTS.TOTAL_FOREIGN_ASSETS, idx)] || 0);
        const liabilities = parseFloat(fieldMap[getCode(STARTS.TOTAL_FOREIGN_LIABILITIES, idx)] || 0);
        const diff = assets - liabilities;
        return diff > 0 ? diff : 0;
      }
    });
  });

  // Net short position (max(Liabilities - Assets, 0))
  CURRENCIES.forEach((currency, idx) => {
    const code = getCode(STARTS.NET_SHORT, idx);
    fields.push({
      code,
      description: `Net short position_${currency}`,
      source: 'calculated',
      calculation: (fieldMap) => {
        const assets = parseFloat(fieldMap[getCode(STARTS.TOTAL_FOREIGN_ASSETS, idx)] || 0);
        const liabilities = parseFloat(fieldMap[getCode(STARTS.TOTAL_FOREIGN_LIABILITIES, idx)] || 0);
        const diff = liabilities - assets;
        return diff > 0 ? diff : 0;
      }
    });
  });

  // Net long position in Birr = NetLong * MidRate
  addMulCalc(STARTS.NET_LONG_BIRR, 'Net long position in Birr',
    STARTS.NET_LONG, STARTS.MID_EXCHANGE_RATE);

  // Net short position in Birr = NetShort * MidRate
  addMulCalc(STARTS.NET_SHORT_BIRR, 'Net short position in Birr',
    STARTS.NET_SHORT, STARTS.MID_EXCHANGE_RATE);

  // Net open position = max(NetLongBirr, NetShortBirr)
  addMaxCalc(STARTS.NET_OPEN_POSITION, 'Net open position',
    STARTS.NET_LONG_BIRR, STARTS.NET_SHORT_BIRR);

  // Net open position ratio = (NetOpenPosition / Tier1Capital) * 100
  addRatioCalc(STARTS.NET_OPEN_POSITION_RATIO, 'Net open position Ratio',
    STARTS.NET_OPEN_POSITION);

  // Overall Exposure fields (not per currency)
  fields.push({
    code: '164_00681',
    description: 'Total long position (Sum of row 5)_Overall Exposure',
    source: 'calculated',
    calculation: (fieldMap) => {
      let sum = 0;
      CURRENCIES.forEach((_, idx) => {
        sum += parseFloat(fieldMap[getCode(STARTS.NET_LONG_BIRR, idx)] || 0);
      });
      return sum;
    }
  });
  fields.push({
    code: '164_00682',
    description: 'Total short position (Sum of row 6)_Overall Exposure',
    source: 'calculated',
    calculation: (fieldMap) => {
      let sum = 0;
      CURRENCIES.forEach((_, idx) => {
        sum += parseFloat(fieldMap[getCode(STARTS.NET_SHORT_BIRR, idx)] || 0);
      });
      return sum;
    }
  });
  fields.push({
    code: '164_00683',
    description: 'Overall open position (Greater of 8.1 or 8.2)_Overall Exposure',
    source: 'calculated',
    calculation: (fieldMap) => {
      const long = parseFloat(fieldMap['164_00681'] || 0);
      const short = parseFloat(fieldMap['164_00682'] || 0);
      return Math.max(long, short);
    }
  });
  fields.push({
    code: '164_00685',
    description: 'Overall open position limit (18%*8.4)_Overall Exposure',
    source: 'calculated',
    calculation: (fieldMap) => {
      const capital = parseFloat(fieldMap['164_00684'] || 0);
      return 0.18 * capital;
    }
  });
  fields.push({
    code: '164_00686',
    description: 'Net Open Position Ratio (8.3/8.4*100)_Overall Exposure',
    source: 'calculated',
    calculation: (fieldMap) => {
      const openPos = parseFloat(fieldMap['164_00683'] || 0);
      const capital = parseFloat(fieldMap['164_00684'] || 0);
      if (capital === 0) return 0;
      return (openPos / capital) * 100;
    }
  });

  return fields;
};

export default {
  reportKey: 'SINGLE CURRENCYOP001',
  instCode: process.env.BSA_INST_CODE,
  finYear: new Date().getFullYear(),
  fields: generateFields(),
};