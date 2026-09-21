export interface ReportMeta {
  key: string;
  name: string;
  description: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  isWeekly: boolean;
  /**
   * How the frontend should ask for dates:
   *  - 'single' → one date picker ("Report Date"); sends YYYY-MM-DD
   *  - 'range'  → two date pickers (Start + End);  sends YYYY-MM-DD/YYYY-MM-DD
   */
  dateMode: 'single' | 'range';
}

export const REPORT_METADATA: Record<string, ReportMeta> = {
  SINGLE_CURRENCYOP001: {
    key: 'SINGLE_CURRENCYOP001',
    name: 'Daily Foreign Currency Exposure Report',
    description: 'Single currency Daily Open Position Report',
    frequency: 'Daily',
    isWeekly: false,
    dateMode: 'single',
  },
  'LSR-Statutory ZS001': {
    key: 'LSR-Statutory ZS001',
    name: 'Weekly BSD Liquidity Requirement Report',
    description: 'Statutory liquidity requirement report',
    frequency: 'Weekly',
    isWeekly: true,
    dateMode: 'range',
  },
  'CDby Sector and RegMD002': {
    key: 'CDby Sector and RegMD002',
    name: 'Monthly Deposit by Sector and Region',
    description: 'Alternative deposit breakdown by sector and region',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
  'CDby Range and RegCM002': {
    key: 'CDby Range and RegCM002',
    name: 'Monthly Deposit by Range and Region',
    description: 'Deposit distribution by range and region',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
  NBE_20_DEP_MR001: {
    key: 'NBE_20_DEP_MR001',
    name: 'Quarterly Top 20 Depositors',
    description: 'Top 20 depositors for the quarter',
    frequency: 'Quarterly',
    isWeekly: false,
    dateMode: 'range',
  },
  'DIR RANGERD002': {
    key: 'DIR RANGERD002',
    name: 'Monthly Interest Free Deposit by Range and Region',
    description: 'Interest Free Deposit distribution by range and region (IFB branches)',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
    DIFIF002: {
    key: 'DIFIF002',
    name: 'Monthly Interest Free Deposit by Sector and Region',
    description: 'Interest Free Deposit breakdown by sector and region (IFB branches)',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
    MB001MB001: {
    key: 'MB001MB001',
    name: 'Monthly Balance Sheet',
    description: 'Monthly Balance Sheet for NBE reporting',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
    'Key Balance SheetMK001': {
    key: 'Key Balance SheetMK001',
    name: 'Monthly Key Balance Sheet',
    description: 'Key Balance Sheet summary for NBE reporting',
    frequency: 'Monthly',
    isWeekly: false,
    dateMode: 'range',
  },
};

export const REPORT_KEYS = Object.keys(REPORT_METADATA);