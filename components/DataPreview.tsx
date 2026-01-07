
import React, { useState } from 'react';
import { db } from '../services/db';
import { ApiResponse } from '../types';

const DataPreview: React.FC = () => {
  const [records, setRecords] = useState(db.getRecords());
  
  const handleReset = () => {
    if (window.confirm("ARE YOU SURE? This will permanently delete ALL historical records. This action is destructive and cannot be undone.")) {
      db.clearRecords();
      setRecords([]);
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(apiResponse, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `api_dataset_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const apiResponse: ApiResponse = {
    status: "success",
    updated_at: records.length > 0 ? records[records.length - 1].date : new Date().toISOString(),
    data: records.map(r => ({
      date: r.date,
      values: r.raw_data
    }))
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">API Output</h2>
          <p className="text-slate-400 text-sm font-medium">Real-time JSON feed synchronized with your spreadsheets.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Stored Items</span>
            <p className="text-xl font-black text-indigo-600 leading-none">{records.length}</p>
          </div>
          <button 
            onClick={handleDownload}
            disabled={records.length === 0}
            className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-black transition-all disabled:opacity-30 flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>JSON</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-slate-800">
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Application / JSON</span>
        </div>
        <div className="p-8 overflow-auto max-h-[600px] font-mono text-xs leading-relaxed custom-scrollbar">
          {records.length > 0 ? (
            <pre className="text-indigo-200">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          ) : (
            <div className="py-20 text-center text-slate-600 italic">
              Dataset is currently empty. Start by syncing a Google Sheet.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
          <h3 className="font-black text-slate-800 mb-4 text-xs uppercase tracking-widest">Integration Endpoint</h3>
          <div className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-500 mb-4">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase text-[9px]">GET</span>
            <code className="truncate">/api/v1/data</code>
          </div>
          <div className="bg-slate-900 p-4 rounded-2xl font-mono text-[10px] text-indigo-300 leading-relaxed overflow-x-auto">
            <code className="whitespace-pre">
{`curl -X GET 'https://api.gateway.com/data' \\
  -H 'Authorization: Bearer YOUR_KEY'`}
            </code>
          </div>
        </div>

        <div className="flex flex-col justify-between border-2 border-dashed border-slate-200 rounded-3xl p-8">
          <div>
            <h3 className="font-black text-slate-800 mb-2 text-xs uppercase tracking-widest">Maintenance Mode</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">Resetting the data will wipe the local browser database. This is typically done before migrating or starting a new data cycle.</p>
          </div>
          <button 
            onClick={handleReset}
            className="mt-6 text-[10px] font-black text-red-500 hover:bg-red-50 py-3 rounded-2xl border border-red-100 transition-colors uppercase tracking-widest"
          >
            Purge Historical Records
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
