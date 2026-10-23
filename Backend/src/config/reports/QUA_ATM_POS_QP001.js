import { fetchAtmPosQuarterly } from '../../services/atmPosService.js';

/*
 * The QP001 dictionary uses fixed codes 36_00001..36_00012 (no region prefix).
 *   ATM   : 36_00001..36_00004
 *   POS   : 36_00005..36_00008
 *   Card  : 36_00009..36_00012
 *   Metric order per row: Machines, Users, Transactions, Amount
 */
const FIELDS = [
  { code: '36_00001', type: 'atm',  metric: 'machines'     },
  { code: '36_00002', type: 'atm',  metric: 'users'        },
  { code: '36_00003', type: 'atm',  metric: 'transactions' },
  { code: '36_00004', type: 'atm',  metric: 'amount'       },

  { code: '36_00005', type: 'pos',  metric: 'machines'     },
  { code: '36_00006', type: 'pos',  metric: 'users'        },
  { code: '36_00007', type: 'pos',  metric: 'transactions' },
  { code: '36_00008', type: 'pos',  metric: 'amount'       },

  { code: '36_00009', type: 'card', metric: 'machines'     },
  { code: '36_00010', type: 'card', metric: 'users'        },
  { code: '36_00011', type: 'card', metric: 'transactions' },
  { code: '36_00012', type: 'card', metric: 'amount'       },
];

/* ------------------------------------------------------------------ */
export default {
  reportKey: 'QUA_ATM_POS_QP001',
  instCode:  process.env.BSA_INST_CODE,
  finYear:   new Date().getFullYear(),
  dataFetcher: fetchAtmPosQuarterly,

  includeZeroValues: true,

  prepare(rawData) {
    this.fields = this.buildFields(rawData);
    return this;
  },

  buildFields(rawData) {
    return FIELDS.map((f) => ({
      code:        f.code,
      description: `${f.type.toUpperCase()}_${f.metric}`,
      source:      'calculated',
      calculation: () => {
        const bucket = rawData?.[f.type];
        return bucket ? (bucket[f.metric] ?? 0) : 0;
      },
    }));
  },
};