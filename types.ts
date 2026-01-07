
export interface ExcelRecord {
  id: string;
  date: string;
  raw_data: Record<string, any>;
}

export interface ApiResponse {
  status: "success" | "error";
  updated_at: string;
  data: {
    date: string;
    values: Record<string, any>;
  }[];
}

export type ViewState = 'LOGIN' | 'UPLOAD' | 'API_KEY' | 'PREVIEW';
