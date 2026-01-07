import { supabase } from '../src/lib/supabase';
import { ExcelRecord } from '../types';

// Storage Keys (Only for local settings/auth state)
const AUTH_KEY = 'sheet_api_auth';
const SETTINGS_KEY = 'sheet_api_settings';

export interface SyncLog {
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  message: string;
  duration?: number;
}

export interface AppSettings {
  googleSheetId: string;
  lastSync: string | null;
  autoSync: boolean;
  syncTime: string;
  lastScheduledSyncDate: string | null;
  syncLogs: SyncLog[];
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
  data: string; // JSON string of records
}

const BACKUP_KEY = 'sheet_api_backups';

export const db = {
  // --- DATA RECORDS (SUPABASE) ---

  getRecords: async (): Promise<ExcelRecord[]> => {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Fetch Error:', error);
      return [];
    }

    // Map Supabase shape to App shape if needed, or straight pass
    // Currently Supabase 'raw_data' is a JSONB column, we need to merge it or return it.
    // Our ExcelRecord type expects { id, date, raw_data: any }
    return (data || []).map(row => ({
      id: row.id,
      date: row.date, // ensure string/date match
      raw_data: row.raw_data
    }));
  },

  saveRecord: async (record: Omit<ExcelRecord, 'id'>) => {
    // We assume 'date' is a string in ISO or YYYY-MM-DD format
    const { error } = await supabase
      .from('records')
      .insert({
        date: record.date.split('T')[0], // Extract YYYY-MM-DD
        raw_data: record.raw_data,
        uploaded_by: 'admin'
      });

    if (error) console.error('Supabase Insert Error:', error);
  },

  // SMART SAVE (Upsert Logic)
  // Hashes the row content. If hash exists for this date, skip it.
  saveRecordSmart: async (record: Omit<ExcelRecord, 'id'>) => {
    // 1. Check if this EXACT row exists for this date
    const { data } = await supabase
      .from('records')
      .select('id')
      .eq('date', record.date.split('T')[0])
      .contains('raw_data', record.raw_data) // Supabase JSONB containment
      .limit(1);

    // 2. If duplicate found, skip
    if (data && data.length > 0) {
      return 'SKIPPED';
    }

    // 3. Otherwise, insert
    const { error } = await supabase
      .from('records')
      .insert({
        date: record.date.split('T')[0],
        raw_data: record.raw_data,
        uploaded_by: 'admin_smart_sync'
      });

    if (error) {
      console.error('Info: Smart Duplicate Checked', error);
      return 'ERROR';
    }
    return 'INSERTED';
  },

  clearRecords: async () => {
    // Dangerous! Using a filter that deletes all.
    // In RLS "Public Access" this allows wiping the table.
    const { error } = await supabase
      .from('records')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete not-null IDs (all)

    if (error) console.error('Supabase Clear Error:', error);
  },

  // --- API KEYS (SUPABASE) ---

  getApiKey: async (): Promise<string | null> => {
    // For admin display, we just grab the first active key.
    const { data } = await supabase
      .from('api_keys')
      .select('key_value')
      .eq('is_active', true)
      .limit(1);

    return data?.[0]?.key_value || null;
  },

  generateApiKey: async (): Promise<string> => {
    const newKey = 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error } = await supabase
      .from('api_keys')
      .insert({
        key_value: newKey,
        owner_name: 'Admin Generated',
        is_active: true
      });

    if (error) console.error('Key Gen Error:', error);
    return newKey;
  },

  // --- SETTINGS (LOCAL STORAGE) ---
  // Settings remain local because they are per-device preferences (e.g. sync time)

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

  // --- LOGGING (SUPABASE) ---

  // --- LOGGING (SUPABASE) ---

  getApiLogs: async (): Promise<ApiCallLog[]> => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    // Map to ApiCallLog interface
    return (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      method: 'GET', // Default since we only have pull
      endpoint: '/api/v1/data',
      status: row.status === 'SUCCESS' ? 200 : 500,
      origin: row.details
    }));
  },

  logApiCall: async (origin: string = 'External Platform') => {
    await supabase.from('audit_logs').insert({
      action: 'API_PULL',
      status: 'SUCCESS',
      details: origin // Storing origin in details column
    });
  },

  // --- BACKUP SYSTEM (LOCAL STORAGE FOR SNAPSHOTS) ---
  // We keep backups local for now as "Client-side Snapshots"

  getBackups: (): BackupEntry[] => {
    const data = localStorage.getItem(BACKUP_KEY);
    return data ? JSON.parse(data) : [];
  },

  createBackup: async (reason: string = 'Automatic') => {
    // Fetch current data from Cloud to snapshot it
    const records = await db.getRecords();

    // Save to LocalStorage
    const backups = db.getBackups();
    const newBackup: BackupEntry = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      timestamp: new Date().toISOString(),
      recordCount: records.length,
      data: JSON.stringify(records)
    };
    const updated = [newBackup, ...backups].slice(0, 5); // Keep last 5
    localStorage.setItem(BACKUP_KEY, JSON.stringify(updated));
    return newBackup;
  },

  restoreBackup: async (id: string) => {
    const backups = db.getBackups();
    const target = backups.find(b => b.id === id);
    if (!target) return false;

    // 1. Clear Cloud
    await db.clearRecords();

    // 2. Restore from Snapshot
    const rows = JSON.parse(target.data);

    // Batch insert (chunks of 50 to avoid payload limits)
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('records').insert(
        chunk.map((r: any) => ({
          date: r.date.split('T')[0],
          raw_data: r.raw_data,
          uploaded_by: 'restore_function'
        }))
      );
      if (error) console.error("Restore Chunk Error", error);
    }
    return true;
  },

  // --- AUTH (LOCAL STORAGE) ---
  // Simple "Gatekeeper" - not real auth.

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
