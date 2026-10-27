import { fetchTwoPercentShareholdingData } from '../../services/twoPercentShareholdingService.js';

/* Per dictionary TS001.json — always Area 180 */
const AREA = 180;

export default {
  reportKey: 'SHR_GTR_2_TS001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchTwoPercentShareholdingData,

  // ReturnItemsList is always empty, so this flag is irrelevant
  includeZeroValues: false,

  prepare(rawData) {
    this.fields       = [];                              // → ReturnItemsList: []
    this.dynamicItems = this.buildDynamicItems(rawData);  // → DynamicItemsList
    return this;
  },

  /* -------------------------------------------------------------- */
  /*  DynamicItemsList — one Area(180) per shareholder, 7 codes    */
  /*  1.1 Name   1.2 Par Value   1.3 Subscribed   1.4 Paid        */
  /*  1.5 Value Subscribed   1.6 Value Paid   1.7 Percent          */
  /* -------------------------------------------------------------- */
  buildDynamicItems(rawData) {
    const sh = (rawData && rawData.shareholders) || [];
    const areas = [];

    sh.forEach(row => {
      areas.push({
        Area: AREA,
        _areaName: null,
        DynamicItems: [
          {
            Code: '1.1',
            Value: row.name || '',
            _description: 'Name of Shareholder',
            _dataType: 'TEXT',
            _required: false,
          },
          {
            Code: '1.2',
            Value: String(row.perValue),
            _description: 'Par Value of  a share (A)',
            _dataType: 'TEXT',                 // ← dictionary marks this TEXT
            _required: false,
          },
          {
            Code: '1.3',
            Value: String(row.sharesSubscribed),
            _description: 'Number of Shares Subscribed (B)',
            _dataType: 'NUMERIC',
            _required: false,
          },
          {
            Code: '1.4',
            Value: String(row.sharesPaid),
            _description: 'Number of Shares Paid (C)',
            _dataType: 'NUMERIC',
            _required: false,
          },
          {
            Code: '1.5',
            Value: String(row.valueSubscribed),
            _description: 'Value of Shares Subscribed (D=AXB)',
            _dataType: 'NUMERIC',
            _required: false,
          },
          {
            Code: '1.6',
            Value: String(row.valuePaid),
            _description: 'Value of Shares Paid (E=AxC)',
            _dataType: 'NUMERIC',
            _required: false,
          },
          {
            Code: '1.7',
            Value: String(row.percent),
            _description: 'Percent of Banks Total Subscribed  Shares',
            _dataType: 'NUMERIC',
            _required: false,
          },
        ],
      });
    });

    return areas;
  },
};