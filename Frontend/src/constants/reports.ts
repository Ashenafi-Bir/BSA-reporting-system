export interface ReportMeta {
  key: string;
  name: string;
  description: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  isWeekly: boolean;
}

export const REPORT_METADATA: Record<string, ReportMeta> = {
  SINGLE_CURRENCYOP001: {
    key: 'SINGLE_CURRENCYOP001',
    name: 'Daily Foreign Currency Exposure Report',
    description: 'Single currency Daily Open Position Report',
    frequency: 'Daily',
    isWeekly: false,
  },
  'LSR-Statutory ZS001': {
    key: 'LSR-Statutory ZS001',
    name: 'BSD Liquidity Requirement Report',
    description: 'Statutory liquidity requirement report',
    frequency: 'Weekly',
    isWeekly: true,
  },
//   'CD by S and RegMD001': {
//     key: 'CD by S and RegMD001',
//     name: 'Deposit by Sector and Region',
//     description: 'Deposit breakdown by sector and region',
//     frequency: 'Monthly',
//     isWeekly: false,
//   },
//   NBE_20_DEP_MR001: {
//     key: 'NBE_20_DEP_MR001',
//     name: 'Quarterly Top 20 Depositors',
//     description: 'Top 20 depositors for the quarter',
//     frequency: 'Quarterly',
//     isWeekly: false,
//   },
//   'CDby Range and RegCM002': {
//     key: 'CDby Range and RegCM002',
//     name: 'Deposit by Range and Region',
//     description: 'Deposit distribution by range and region',
//     frequency: 'Monthly',
//     isWeekly: false,
//   },
//   'CDby Sector and RegMD002': {
//     key: 'CDby Sector and RegMD002',
//     name: 'Deposit by Sector and Region MD002',
//     description: 'Alternative deposit breakdown by sector and region',
//     frequency: 'Monthly',
//     isWeekly: false,
//   },
};

export const REPORT_KEYS = Object.keys(REPORT_METADATA);