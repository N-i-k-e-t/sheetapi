
import { ExcelRecord } from '../types';

const STORAGE_KEY = 'sheet_api_data';
const AUTH_KEY = 'sheet_api_auth';
const API_KEY_STORE = 'sheet_api_key';
const SETTINGS_KEY = 'sheet_api_settings';
const BACKUP_KEY = 'sheet_api_backups';
const API_LOG_KEY = 'sheet_api_traffic';

export interface SyncLog {
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  message: string;
  duration?: number;
}

export interface ApiCallLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  origin: string;
}

export interface BackupEntry {
  id: string;
  timestamp: string;
  recordCount: number;
  data: string;
}

export interface AppSettings {
  googleSheetId: string;
  lastSync: string | null;
  autoSync: boolean;
  syncTime: string;
  lastScheduledSyncDate: string | null;
  syncLogs: SyncLog[];
}

export const db = {
  // Data Records
  getRecords: (): ExcelRecord[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  saveRecord: (record: Omit<ExcelRecord, 'id'>) => {
    const records = db.getRecords();
    const newRecord: ExcelRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9)
    };
    records.push(newRecord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },

  clearRecords: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Settings
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { 
      googleSheetId: '', 
      lastSync: null, 
      autoSync: true,
      syncTime: '13:00',
      lastScheduledSyncDate: null,
      syncLogs: []
    };
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  addSyncLog: (log: Omit<SyncLog, 'timestamp'>) => {
    const settings = db.getSettings();
    const newLog = { ...log, timestamp: new Date().toISOString() };
    const updatedLogs = [newLog, ...settings.syncLogs].slice(0, 15);
    db.saveSettings({ ...settings, syncLogs: updatedLogs });
  },

  // API Call Logging (Traffic Monitoring)
  getApiLogs: (): ApiCallLog[] => {
    const data = localStorage.getItem(API_LOG_KEY);
    return data ? JSON.parse(data) : [];
  },

  logApiCall: (origin: string = 'External Platform') => {
    const logs = db.getApiLogs();
    const newLog: ApiCallLog = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      timestamp: new Date().toISOString(),
      method: 'GET',
      endpoint: '/api/v1/marathi-data',
      status: 200,
      origin
    };
    const updated = [newLog, ...logs].slice(0, 50); // Keep last 50 requests
    localStorage.setItem(API_LOG_KEY, JSON.stringify(updated));
  },

  // Backup System
  getBackups: (): BackupEntry[] => {
    const data = localStorage.getItem(BACKUP_KEY);
    return data ? JSON.parse(data) : [];
  },

  createBackup: (reason: string = 'Automatic') => {
    const records = db.getRecords();
    const backups = db.getBackups();
    const newBackup: BackupEntry = {
      id: Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      recordCount: records.length,
      data: JSON.stringify(records)
    };
    const updated = [newBackup, ...backups].slice(0, 5);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(updated));
    return newBackup;
  },

  restoreBackup: (id: string) => {
    const backups = db.getBackups();
    const target = backups.find(b => b.id === id);
    if (target) {
      localStorage.setItem(STORAGE_KEY, target.data);
      return true;
    }
    return false;
  },

  getApiKey: (): string | null => {
    return localStorage.getItem(API_KEY_STORE);
  },

  generateApiKey: (): string => {
    const newKey = 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(API_KEY_STORE, newKey);
    return newKey;
  },

  login: (password: string): boolean => {
    if (password === 'admin123') {
      localStorage.setItem(AUTH_KEY, 'true');
      return true;
    }
    return false;
  },

  isLoggedIn: (): boolean => {
    return localStorage.getItem(AUTH_KEY) === 'true';
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
  }
};
