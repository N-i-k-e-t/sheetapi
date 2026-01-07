import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, AppSettings, BackupEntry } from '../services/db';

const Upload: React.FC = () => {
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [backups, setBackups] = useState<BackupEntry[]>([]); // Init empty, fetch later
  const [sheetIdInput, setSheetIdInput] = useState(settings.googleSheetId);
  const [syncTimeInput, setSyncTimeInput] = useState(settings.syncTime || '13:00');
  const [lastBatch, setLastBatch] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch of backups
    setBackups(db.getBackups());
  }, []);

  const processWorkbook = async (workbook: XLSX.WorkBook) => {
    const allRows: any[] = [];
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      allRows.push(...json);
    });

    if (allRows.length === 0) throw new Error("The workbook contains no data in any sheets.");


    const timestamp = new Date().toISOString();
    let insertedCount = 0;

    // Batch Process Loop (Chunk Size: 50)
    // This prevents browser freezing on 10k+ rows
    const chunkSize = 50;
    for (let i = 0; i < allRows.length; i += chunkSize) {
      const chunk = allRows.slice(i, i + chunkSize);

      // Parallelize checking for this chunk
      const promises = chunk.map(row => db.saveRecordSmart({
        date: timestamp,
        raw_data: row
      }));

      const results = await Promise.all(promises);
      insertedCount += results.filter(r => r === 'INSERTED').length;
    }

    setLastBatch(allRows.slice(0, 5));
    // Return BOTH total rows found and actual new insertions
    return { timestamp, count: allRows.length, new: insertedCount };
  };

  const syncGoogleSheet = async () => {
    // Validation: Check if input exists. We accept IDs or Full URLs now.
    if (!sheetIdInput || sheetIdInput.trim().length < 5) {
      setErrorMessage("Invalid Input.");
      setStatus('ERROR');
      return;
    }

    const startTime = performance.now();
    setStatus('LOADING');
    try {
      // SMART URL BUILDER
      let url = '';
      if (sheetIdInput.startsWith('http')) {
        // User pasted full URL (e.g. 2PACX)
        // If it's a "pubhtml" or "edit", force it to CSV
        url = sheetIdInput
          .replace('/pubhtml', '/pub?output=csv')
          .replace('/edit', '/export?format=csv');

        // Fallback if no specific ending found but it is a 2PACX
        if (!url.includes('output=csv') && !url.includes('format=csv')) {
          if (url.includes('pub')) url += '?output=csv';
        }
      } else {
        // User pasted just an ID
        url = `https://docs.google.com/spreadsheets/d/${sheetIdInput}/export?format=csv`;
      }

      console.log("Fetching via Proxy: ", url);

      // Use our own Vercel Proxy to bypass Google CORS
      const proxyResponse = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!proxyResponse.ok) throw new Error(`Proxy failed: ${proxyResponse.status}`);

      const csvText = await proxyResponse.text();

      // Check for HTML error pages
      if (csvText.includes('<!DOCTYPE html') || csvText.includes('<html')) {
        throw new Error("Invalid Link. Ensure Sheet is 'Published to Web' as CSV.");
      }

      // Convert CSV Text -> Workbook
      const workbook = XLSX.read(csvText, { type: 'string' });
      // const response = await fetch(url); // Old Direct Fetch logic replaced
      const result = await processWorkbook(workbook);



      const endTime = performance.now();

      const newSettings = {
        ...settings,
        googleSheetId: sheetIdInput,
        lastSync: result.timestamp,
        syncTime: syncTimeInput
      };

      db.saveSettings(newSettings);
      db.addSyncLog({
        status: 'SUCCESS',
        message: `Synced ${result.count} check. +${result.new} New.`,
        duration: Math.round(endTime - startTime)
      });

      // Auto-backup after successful sync
      await db.createBackup('Sync Success');
      setBackups(db.getBackups());
      setSettings(db.getSettings());

      setStatus('SUCCESS');
      setTimeout(() => setStatus('IDLE'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown sync error';
      setErrorMessage(msg);
      setStatus('ERROR');
      db.addSyncLog({ status: 'ERROR', message: msg });
    }
  };

  const handleRestore = async (id: string) => {
    if (confirm("Restore this data snapshot? Current data will be replaced.")) {
      setStatus('LOADING');
      await db.restoreBackup(id);
      alert("Restore successful!");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Cloud Sync Section */}
      <section className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Daily Auto-Sync</h2>
            <p className="text-indigo-700/60 text-sm">Automated Marathi data pulls from Google Sheets.</p>
          </div>
          <div className="flex items-center bg-white/50 px-3 py-1.5 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-black text-indigo-400 uppercase mr-3">Active</span>
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={() => {
                const s = { ...settings, autoSync: !settings.autoSync };
                db.saveSettings(s);
                setSettings(s);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Spreadsheet ID</label>
            <input
              type="text"
              value={sheetIdInput}
              onChange={(e) => setSheetIdInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-transparent focus:border-indigo-400 outline-none shadow-inner"
              placeholder="e.g. 1BxiMVs..."
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Sync Time (24h)</label>
            <input
              type="time"
              value={syncTimeInput}
              onChange={(e) => setSyncTimeInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-transparent focus:border-indigo-400 outline-none shadow-inner"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              const s = { ...settings, syncTime: syncTimeInput, googleSheetId: sheetIdInput };
              db.saveSettings(s);
              setSettings(s);
              alert("Settings updated!");
            }}
            className="px-6 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-xs font-black uppercase hover:bg-indigo-100 transition-colors"
          >
            Save Schedule
          </button>
          <button
            onClick={syncGoogleSheet}
            disabled={status === 'LOADING'}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {status === 'LOADING' ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {status === 'ERROR' && (
          <div className="mt-4 p-4 bg-white border border-red-100 text-red-600 rounded-xl text-xs font-bold animate-in slide-in-from-top-1">
            Error: {errorMessage}
          </div>
        )}
      </section>

      {/* Manual File Upload Section */}
      <section className="bg-white border-2 border-slate-100 rounded-[2rem] p-8">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Manual File Upload</h2>
        <div className="flex items-center justify-center w-full">
          <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className="text-sm text-slate-500 font-bold">Click to upload <span className="font-normal text-slate-400">or drag and drop</span></p>
              <p className="text-xs text-slate-400">XLSX or CSV</p>
            </div>
            <input id="dropzone-file" type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              try {
                setStatus('LOADING');
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const result = await processWorkbook(workbook);

                db.addSyncLog({
                  status: 'SUCCESS',
                  message: `Manual Upload: ${result.new} New Rows Added.`
                });

                setStatus('SUCCESS');
                setTimeout(() => setStatus('IDLE'), 3000);
                alert(`Success! Added ${result.new} new unique records.`);
                window.location.reload();
              } catch (err: any) {
                setStatus('ERROR');
                setErrorMessage(err.message);
              }
            }} />
          </label>
        </div>
      </section>

      {/* Backup & Snapshot System */}
      <section className="bg-white border-2 border-slate-100 rounded-[2rem] p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">System Backups</h2>
          <button
            onClick={async () => {
              await db.createBackup('Manual');
              setBackups(db.getBackups());
            }}
            className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 uppercase"
          >
            Create Snapshot
          </button>
        </div>

        <div className="space-y-2">
          {backups.length > 0 ? backups.map(b => (
            <div key={b.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:border-indigo-200 transition-all">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshot {b.id}</span>
                <span className="text-xs font-bold text-slate-700">{new Date(b.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400">{b.recordCount} Records</span>
                <button
                  onClick={() => handleRestore(b.id)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                >
                  Restore
                </button>
              </div>
            </div>
          )) : (
            <div className="py-8 text-center text-slate-400 text-xs italic">No snapshots available yet.</div>
          )}
        </div>
      </section>

      {/* History & Logs */}
      <section className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-xl">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Sync Performance Logs</h2>
        <div className="space-y-1">
          {settings.syncLogs.map((log, i) => (
            <div key={i} className="flex justify-between items-center text-[10px] font-mono py-1.5 border-b border-slate-800 last:border-0">
              <span className={log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>
                [{log.status}] {log.message}
              </span>
              <span className="text-slate-500">
                {log.duration ? `${log.duration}ms · ` : ''}
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {settings.syncLogs.length === 0 && <p className="text-slate-600 text-[10px] italic">No activity recorded.</p>}
        </div>
      </section>
    </div>
  );
};

export default Upload;
