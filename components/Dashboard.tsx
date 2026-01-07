import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, AppSettings, BackupEntry, ApiCallLog } from '../services/db';
import { ExcelRecord } from '../types';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SYNC' | 'DATA' | 'INTEGRATE' | 'HEALTH'>('SYNC');

  // Data States
  const [records, setRecords] = useState<ExcelRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [backups, setBackups] = useState<BackupEntry[]>(db.getBackups());
  const [apiLogs, setApiLogs] = useState<ApiCallLog[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetId, setSheetId] = useState(settings.googleSheetId);
  const [syncTime, setSyncTime] = useState(settings.syncTime || '13:00');
  const [manualRow, setManualRow] = useState<string>('');

  // Initial Data Load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const recs = await db.getRecords();
    const key = await db.getApiKey();
    setRecords(recs);
    setApiKey(key);

    // These remain local for now
    setBackups(db.getBackups());
    setSettings(db.getSettings());
    const logs = await db.getApiLogs();
    setApiLogs(logs);
    setIsLoading(false);
  };

  const refreshState = async () => {
    await loadData();
  };

  const handleSync = async () => {
    if (!sheetId) return alert("Please provide a Sheet ID");
    setIsSyncing(true);
    const start = performance.now();
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Sync failed. Check 'Publish to Web' settings.");

      const buffer = await res.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      let count = 0;
      const ts = new Date().toISOString();

      db.createBackup('Auto-Backup Before Sync');

      // Process sequentially to not kill the browser/db connection
      for (const name of workbook.SheetNames) {
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
        // Batch upload could be better, but let's loop for now
        for (const row of json) {
          await db.saveRecord({ date: ts, raw_data: row });
          count++;
        }
      }

      const dur = Math.round(performance.now() - start);
      db.saveSettings({ ...settings, googleSheetId: sheetId, lastSync: ts });
      db.addSyncLog({ status: 'SUCCESS', message: `Pulled ${count} Marathi items.`, duration: dur });

      await refreshState();
      alert(`Success! Imported ${count} rows.`);
    } catch (e: any) {
      db.addSyncLog({ status: 'ERROR', message: e.message || 'Network error' });
      alert(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRow.trim()) return;
    try {
      const parsed = JSON.parse(manualRow);
      await db.saveRecord({ date: new Date().toISOString(), raw_data: parsed });
      setManualRow('');
      await refreshState();
      alert("Marathi row recorded!");
    } catch {
      alert("Invalid JSON format. Check brackets and quotes.");
    }
  };

  const simulateApiCall = async () => {
    await db.logApiCall('Internal Test Client');
    await refreshState();
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <p className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Syncing with Cloud DB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-100 mb-8 pb-px space-x-10 no-scrollbar">
        {[
          { id: 'SYNC', label: 'Dashboard', icon: '🏠' },
          { id: 'DATA', label: 'Marathi Data', icon: '📝' },
          { id: 'INTEGRATE', label: 'Developer API', icon: '🔌' },
          { id: 'HEALTH', label: 'System Health', icon: '🛡️' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 text-[10px] font-black tracking-[0.2em] uppercase flex items-center space-x-2 transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            <span className="text-sm grayscale brightness-125">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 animate-in fade-in zoom-in-95 duration-500">
        {activeTab === 'SYNC' && (
          <div className="space-y-10">
            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white border-2 border-slate-100 p-6 rounded-3xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Rows</span>
                <p className="text-3xl font-black text-indigo-600">{records.length.toLocaleString()}</p>
              </div>
              <div className="bg-white border-2 border-slate-100 p-6 rounded-3xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Last Sync</span>
                <p className="text-lg font-black text-slate-800">{settings.lastSync ? new Date(settings.lastSync).toLocaleDateString('mr-IN') : 'Never'}</p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100">
                <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest block mb-2">Next Auto-Pull</span>
                <p className="text-3xl font-black">{settings.syncTime}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Sync Engine</h3>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Google Sheet ID</label>
                    <input
                      type="text" value={sheetId} onChange={(e) => setSheetId(e.target.value)}
                      className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-transparent focus:border-indigo-400 outline-none shadow-sm text-sm"
                      placeholder="1BxiMVs..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Daily Pull Time</label>
                      <input
                        type="time" value={syncTime} onChange={(e) => setSyncTime(e.target.value)}
                        className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-transparent focus:border-indigo-400 outline-none shadow-sm text-sm font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button onClick={handleSync} disabled={isSyncing} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        {isSyncing ? 'Running...' : 'Run Sync'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Recent Activity</h3>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl h-[280px] overflow-auto custom-scrollbar">
                  {settings.syncLogs.map((log, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] py-3 border-b border-white/5 last:border-0">
                      <span className={log.status === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{log.status}</span>
                      <span className="text-white/60 flex-1 px-4 truncate">{log.message}</span>
                      <span className="text-white/20 tabular-nums">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {settings.syncLogs.length === 0 && <p className="text-slate-600 text-xs italic text-center py-20">No sync logs found.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Marathi Data Explorer</h3>
                <button onClick={() => { if (confirm("Wipe all?")) { db.clearRecords(); refreshState(); } }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">Clear Feed</button>
              </div>
              <div className="bg-slate-900 rounded-[2.5rem] p-10 max-h-[500px] overflow-auto border-4 border-slate-800 custom-scrollbar shadow-2xl">
                <pre className="text-indigo-200 text-xs font-mono leading-relaxed">
                  {JSON.stringify({
                    status: "authorized",
                    count: records.length,
                    feed: records.map(r => ({ date: r.date, data: r.raw_data }))
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Manual Entry</h3>
              <form onSubmit={handleManualAdd} className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] shadow-sm space-y-5">
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Add a single Marathi record directly to the historical log.</p>
                <textarea
                  value={manualRow}
                  onChange={(e) => setManualRow(e.target.value)}
                  className="w-full h-48 bg-slate-50 p-5 rounded-2xl border border-slate-200 outline-none focus:border-indigo-400 text-sm font-mono text-indigo-700 resize-none"
                  placeholder='{ "नाव": "सुनील", "पत्ता": "मुंबई" }'
                />
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all">Add to Feed</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'INTEGRATE' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Authorization Key</h3>
                <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[2.5rem] text-center">
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-4">Master Bearer Token</p>
                  {apiKey ? (
                    <code className="block bg-white p-6 rounded-2xl border border-emerald-200 text-emerald-700 font-mono text-lg break-all select-all shadow-inner">
                      {apiKey}
                    </code>
                  ) : (
                    <button onClick={async () => { await db.generateApiKey(); loadData(); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-emerald-200">Generate New Key</button>
                  )}

                  <p className="text-[10px] text-emerald-500 mt-4 font-medium italic">Provide this to your external developer.</p>
                </div>

                <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem]">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Integration Guide</h4>
                  <div className="space-y-4 text-xs font-medium text-slate-600 leading-relaxed">
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl">
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                      <span>Endpoint: <strong>{window.location.origin}/api/data</strong></span>
                    </div>
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl">
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                      <span>Method: <strong>GET</strong></span>
                    </div>
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl">
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                      <span>Header: <strong>Authorization: Bearer [KEY]</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">API Traffic Log</h3>
                  <button onClick={simulateApiCall} className="text-[10px] font-black text-indigo-600 hover:underline uppercase">Test API Call</button>
                </div>
                <div className="bg-slate-900 rounded-[2.5rem] p-8 h-[400px] overflow-auto custom-scrollbar border-4 border-slate-800">
                  {apiLogs.length > 0 ? apiLogs.map((log, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-mono py-3 border-b border-white/5 last:border-0">
                      <div className="flex items-center space-x-3">
                        <span className="text-emerald-400">200 OK</span>
                        <span className="text-white/40 uppercase">{log.id}</span>
                      </div>
                      <span className="text-white/60">{log.origin}</span>
                      <span className="text-white/20">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )) : (
                    <div className="py-20 text-center text-slate-700 italic text-xs">Waiting for external requests...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'HEALTH' && (
          <div className="space-y-10">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Database Snapshots</h3>
              <button onClick={() => { db.createBackup('Manual Health Check'); refreshState(); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Create Recovery Point</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {backups.map(b => (
                <div key={b.id} className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] group hover:border-indigo-400 transition-all">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Snapshot {b.id}</span>
                  <h4 className="font-bold text-slate-800 mb-1">{new Date(b.timestamp).toLocaleString('mr-IN')}</h4>
                  <p className="text-[10px] text-indigo-500 font-bold mb-6">{b.recordCount} Marathi rows</p>
                  <button onClick={() => { if (confirm("Restore database?")) { db.restoreBackup(b.id); window.location.reload(); } }} className="w-full py-3 bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all">Restore Data</button>
                </div>
              ))}
              {backups.length === 0 && <div className="col-span-3 py-24 text-center text-slate-300 italic">No snapshots available.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
