
import React, { useState, useEffect, useRef } from 'react';
import { db } from './services/db';
import { ViewState } from './types';
import * as XLSX from 'xlsx';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [isAuth, setIsAuth] = useState<boolean>(db.isLoggedIn());
  const [isSyncing, setIsSyncing] = useState(false);
  const heartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    // Generate initial master key if missing
    const initKey = async () => {
      const key = await db.getApiKey();
      if (!key) await db.generateApiKey();
    };
    initKey();

    const triggerAutoPull = async () => {
      const settings = db.getSettings();
      if (!settings.googleSheetId || !settings.autoSync) return;

      setIsSyncing(true);
      try {
        const url = `https://docs.google.com/spreadsheets/d/${settings.googleSheetId}/export?format=csv`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Auto-sync fetch failed.");

        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        const timestamp = new Date().toISOString();
        const todayStr = timestamp.split('T')[0];
        let rowCount = 0;

        await db.createBackup('Scheduled Auto-Sync Backup');

        for (const name of workbook.SheetNames) {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
          for (const r of rows) {
            const res = await db.saveRecordSmart({ date: timestamp, raw_data: r });
            if (res === 'INSERTED') rowCount++;
          }
        }

        db.saveSettings({ ...settings, lastSync: timestamp, lastScheduledSyncDate: todayStr });
        db.addSyncLog({ status: 'SUCCESS', message: `Daily Auto-Pull: +${rowCount} New Items.` });
      } catch (e: any) {
        db.addSyncLog({ status: 'ERROR', message: "Daily pull failed. Check internet/permissions." });
      } finally {
        setIsSyncing(false);
      }
    };

    const monitorSchedule = () => {
      const settings = db.getSettings();
      if (!settings.autoSync || !settings.googleSheetId) return;

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentHM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const targetTime = settings.syncTime || '13:00';

      // Rule: Sync if we hit target time and haven't synced successfully yet today
      if (settings.lastScheduledSyncDate !== today && currentHM >= targetTime) {
        console.log(`[AutoPull] System clock ${currentHM} matched target ${targetTime}. Initializing pull.`);
        triggerAutoPull();
      }
    };

    if (isAuth) {
      monitorSchedule(); // Run on mount
      heartbeatRef.current = window.setInterval(monitorSchedule, 60000); // 1-minute check
    }

    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [isAuth]);

  if (!isAuth) return <Login onLogin={() => setIsAuth(true)} />;

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FBFF]">
      {/* Dynamic Nav */}
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 transition-all ${isSyncing ? 'animate-pulse scale-105' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}>
            {isSyncing ? (
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            )}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">SheetAPI</h1>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 block">मराठी डेटा गेटवे v2</span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Server Running</span>
          </div>
          <button onClick={() => { db.logout(); setIsAuth(false); }} className="text-[10px] font-black text-slate-400 hover:text-red-600 transition-colors uppercase tracking-[0.2em]">Sign Out</button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-10">
        <div className="bg-white rounded-[3.5rem] shadow-2xl shadow-indigo-100/30 border border-slate-100 p-8 sm:p-14 min-h-[700px]">
          <Dashboard />
        </div>
      </main>

      {/* Localized Footer */}
      <footer className="py-10 text-center">
        <div className="text-slate-300 text-[11px] font-black uppercase tracking-[0.4em] mb-2">
          Marathi UTF-8 Protocol • Zero-Server Architecture • {new Date().toLocaleDateString('mr-IN')}
        </div>
        <p className="text-slate-200 text-[9px] font-medium tracking-widest">Designed for Vercel Free Setup</p>
      </footer>
    </div>
  );
};

export default App;
