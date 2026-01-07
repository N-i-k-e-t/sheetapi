
import React, { useState } from 'react';
import { db } from '../services/db';

const ApiKeyDisplay: React.FC = () => {
  const [apiKey, setApiKey] = useState(db.getApiKey() || '');
  const [copied, setCopied] = useState(false);

  const handleRegenerate = () => {
    if (window.confirm("Are you sure? Previous key will be revoked immediately.")) {
      const newKey = db.generateApiKey();
      setApiKey(newKey);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800">API Access Key</h2>
        <p className="text-slate-500 text-sm">Use this key to fetch your data programmatically via the JSON endpoint.</p>
      </div>

      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Active Key</label>
        <div className="flex space-x-2">
          <div className="flex-1 bg-slate-900 text-green-400 font-mono text-sm p-4 rounded-lg overflow-x-auto border border-slate-800 shadow-inner">
            {apiKey}
          </div>
          <button 
            onClick={copyToClipboard}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3 mt-8">
        <div className="text-amber-500 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-amber-800 text-sm">Keep this key private!</h4>
          <p className="text-amber-700 text-xs mt-1">Anyone with this key can access your entire historical dataset. Do not share it in public repositories.</p>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
        <p className="text-xs text-slate-400 italic">Key generated locally and stored securely in your browser's persistent storage.</p>
        <button 
          onClick={handleRegenerate}
          className="text-sm text-red-500 hover:text-red-700 font-medium"
        >
          Regenerate Key
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDisplay;
