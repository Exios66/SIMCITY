/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

interface StartScreenProps {
  onStart: (aiEnabled: boolean) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-sans p-6 bg-black/30 backdrop-blur-sm transition-all duration-1000">
      <div className="max-w-md w-full bg-slate-900/90 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl relative overflow-hidden animate-fade-in">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
            <h1 className="text-5xl font-black mb-2 bg-gradient-to-br from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-tight">
            SkyMetropolis
            </h1>
            <p className="text-slate-400 mb-8 text-sm font-medium uppercase tracking-widest">
            Isometric City Builder
            </p>

            <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 mb-8 hover:border-slate-600 transition-colors shadow-inner">
            <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col gap-1">
                <span className="font-bold text-base text-slate-200 group-hover:text-white transition-colors flex items-center gap-2">
                    AI City Advisor
                    {aiEnabled && <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    Enable dynamic quests & news events via Gemini API
                </span>
                </div>
                
                <div className="relative flex-shrink-0 ml-4">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-white"></div>
                </div>
            </label>
            </div>

            <button 
            onClick={() => onStart(aiEnabled)}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] text-lg tracking-wide"
            >
            Start Building
            </button>

            <div className="mt-8 text-center">
                <a 
                    href="https://x.com/ammaar" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-400 transition-colors font-mono group"
                >
                    <span>Created by</span>
                    <span className="font-bold group-hover:underline decoration-cyan-500/50 underline-offset-2">@ammaar</span>
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;