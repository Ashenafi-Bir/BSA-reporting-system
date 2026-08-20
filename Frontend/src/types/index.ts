export interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  allowedReports: string[];
}

export interface Submission {
  id: number;
  report_key: string;
  filename: string;
  start_date: string;
  end_date: string;
  submitted_at: string;
  status: string;
  bsa_status: string | null;
  response: string;
  error: string | null;
  processing_results: string | null;
}

export interface Report {
  key: string;
  name: string;
  isWeekly: boolean;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
  };
  error?: string;
}