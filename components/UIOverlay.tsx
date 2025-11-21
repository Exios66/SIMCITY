
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef } from 'react';
import { BuildingType, CityStats, AIGoal, NewsItem, Era, Weather } from '../types';
import { BUILDINGS } from '../constants';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  hoveredLandValue: number | null;
}

const tools = [
  BuildingType.None, 
  BuildingType.Road,
  BuildingType.Residential,
  BuildingType.Commercial,
  BuildingType.Industrial,
  BuildingType.Farm,
  BuildingType.Defense,
  BuildingType.Park,
];

const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  stats: CityStats;
}> = ({ type, isSelected, onClick, stats }) => {
  const config = BUILDINGS[type];
  const canAffordMoney = stats.money >= config.costMoney;
  const canAffordWood = stats.wood >= config.costWood;
  const canAffordStone = stats.stone >= config.costStone;
  const canAfford = canAffordMoney && canAffordWood && canAffordStone;
  
  const isBulldoze = type === BuildingType.None;
  const bgColor = isBulldoze ? config.color : config.color;

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && !canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded-lg border-2 transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-white bg-white/20 scale-110 z-10' : 'border-gray-600 bg-gray-900/80 hover:bg-gray-800'}
        ${!isBulldoze && !canAfford ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
      `}
      title={`${config.name} - $${config.costMoney}, ${config.costWood} Wood, ${config.costStone} Stone`}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded mb-0.5 md:mb-1 border border-black/30 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="w-full h-full bg-red-600 text-white flex justify-center items-center font-bold text-base md:text-lg">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-2 bg-gray-800 transform -rotate-45"></div>}
        {type === BuildingType.Defense && <div className="text-[10px]">🛡️</div>}
        {type === BuildingType.Farm && <div className="text-[10px]">🌾</div>}
      </div>
      <span className="text-[7px] md:text-[9px] font-bold text-white uppercase tracking-wider drop-shadow-md leading-none truncate max-w-full px-1">{config.name}</span>
      {config.costMoney > 0 && (
        <div className="flex flex-col items-center leading-none mt-0.5">
            <span className={`text-[8px] md:text-[9px] font-mono ${canAffordMoney ? 'text-green-300' : 'text-red-400'}`}>${config.costMoney}</span>
            {(config.costWood > 0 || config.costStone > 0) && (
                <div className="flex gap-0.5">
                    {config.costWood > 0 && <span className={`text-[7px] ${canAffordWood?'text-amber-500':'text-red-500'}`}>W{config.costWood}</span>}
                    {config.costStone > 0 && <span className={`text-[7px] ${canAffordStone?'text-gray-400':'text-red-500'}`}>S{config.costStone}</span>}
                </div>
            )}
        </div>
      )}
    </button>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  hoveredLandValue
}) => {
  const newsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed]);

  // Determine Era Color
  const eraColor = {
      [Era.Primitive]: 'text-amber-600',
      [Era.Industrial]: 'text-gray-400',
      [Era.Modern]: 'text-blue-400',
      [Era.Future]: 'text-fuchsia-400',
  }[stats.era];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-sans z-10">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start pointer-events-auto gap-2 w-full max-w-full">
        
        {/* Stats */}
        <div className="bg-gray-900/90 text-white p-2 md:p-3 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md flex gap-3 md:gap-4 items-center justify-start overflow-x-auto">
          <div className="flex flex-col min-w-max">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Treasury</span>
            <span className="text-lg md:text-xl font-black text-green-400 font-mono drop-shadow-md">${stats.money.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          
          {/* Resources */}
          <div className="flex flex-col min-w-max">
             <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Res</span>
             <div className="flex gap-2 text-xs md:text-sm font-mono font-bold">
                 <span className="text-amber-600 flex items-center" title="Wood">🌲 {stats.wood}</span>
                 <span className="text-stone-400 flex items-center" title="Stone">🪨 {stats.stone}</span>
                 <span className={`${stats.food < stats.population ? 'text-red-500 animate-pulse' : 'text-lime-500'} flex items-center`} title="Food">🌾 {stats.food}</span>
             </div>
          </div>

          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col min-w-max">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Pop.</span>
            <span className="text-base md:text-xl font-bold text-blue-300 font-mono drop-shadow-md">{stats.population.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col items-center min-w-max">
             <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Era</span>
             <span className={`text-sm md:text-base font-bold font-mono ${eraColor}`}>{stats.era}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col items-end min-w-max">
             <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Day</span>
             <span className="text-base md:text-lg font-bold text-white font-mono">{stats.day}</span>
          </div>
        </div>

        {/* AI Goal */}
        <div className={`w-full md:w-80 bg-indigo-900/90 text-white rounded-xl border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-md overflow-hidden transition-all ${!aiEnabled ? 'opacity-80 grayscale-[0.5]' : ''}`}>
          <div className="bg-indigo-800/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-indigo-600">
            <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 shadow-sm">
              {aiEnabled ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${isGeneratingGoal ? 'bg-yellow-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
                  AI Advisor
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  Sandbox
                </>
              )}
            </span>
            {isGeneratingGoal && aiEnabled && <span className="text-[10px] animate-pulse text-yellow-300 font-mono">Thinking...</span>}
          </div>
          
          <div className="p-3 md:p-4">
            {aiEnabled ? (
              currentGoal ? (
                <>
                  <p className="text-xs md:text-sm font-medium text-indigo-100 mb-2 md:mb-3 leading-tight drop-shadow">"{currentGoal.description}"</p>
                  <div className="flex justify-between items-center mt-1 md:mt-2 bg-indigo-950/60 p-1.5 md:p-2 rounded-lg border border-indigo-700/50">
                    <div className="text-[10px] md:text-xs text-gray-300">
                      Target: <span className="font-mono font-bold text-white">
                        {currentGoal.targetType === 'building_count' ? BUILDINGS[currentGoal.buildingType!].name : 
                         currentGoal.targetType === 'money' ? '$' : 'Pop.'} {currentGoal.targetValue}
                      </span>
                    </div>
                    <div className="text-[10px] md:text-xs text-yellow-300 font-bold font-mono bg-yellow-900/50 px-2 py-0.5 rounded border border-yellow-600/50">
                      +${currentGoal.reward}
                    </div>
                  </div>
                  {currentGoal.completed && (
                    <button
                      onClick={onClaimReward}
                      className="mt-2 md:mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-1.5 md:py-2 px-4 rounded shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all animate-bounce text-xs md:text-sm uppercase tracking-wide border border-green-400/50"
                    >
                      Collect Reward
                    </button>
                  )}
                </>
              ) : (
                <div className="text-xs md:text-sm text-gray-400 py-2 italic flex items-center gap-2">
                  Analyzing city metrics...
                </div>
              )
            ) : (
              <div className="text-xs md:text-sm text-indigo-200/70 py-1"><p className="mb-1">Free play active.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Info Tooltip (Land Value / Weather) */}
      <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-2">
         {hoveredLandValue !== null && (
             <div className="bg-black/70 backdrop-blur text-white p-2 rounded border border-white/20 animate-fade-in">
                 <div className="text-[10px] uppercase text-gray-400 font-bold">Land Value</div>
                 <div className={`text-lg font-mono font-bold ${hoveredLandValue > 1.2 ? 'text-yellow-400' : hoveredLandValue < 0.8 ? 'text-red-400' : 'text-white'}`}>
                     {Math.round(hoveredLandValue * 100)}%
                 </div>
             </div>
         )}
      </div>
      <div className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
          <div className="bg-black/70 backdrop-blur text-white p-2 rounded border border-white/20 flex flex-col items-center">
              <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Forecast</div>
              <div className="text-2xl">
                {stats.weather === Weather.Sunny ? '☀️' : stats.weather === Weather.Rain ? '🌧️' : '❄️'}
              </div>
              <div className="text-xs font-bold">{stats.weather}</div>
          </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        <div className="flex gap-1 md:gap-2 bg-gray-900/80 p-1 md:p-2 rounded-2xl border border-gray-600/50 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
          <div className="flex gap-1 md:gap-2 min-w-max px-1">
            {tools.map((type) => (
              <ToolButton
                key={type}
                type={type}
                isSelected={selectedTool === type}
                onClick={() => onSelectTool(type)}
                stats={stats}
              />
            ))}
          </div>
          <div className="text-[8px] text-gray-500 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-gray-700 pl-1 ml-1 select-none">Build</div>
        </div>

        {/* News Feed */}
        <div className="w-full md:w-80 h-32 md:h-48 bg-black/80 text-white rounded-xl border border-gray-700/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden relative">
          <div className="bg-gray-800/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 border-b border-gray-600 flex justify-between items-center">
            <span>City Feed</span>
            <span className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
          </div>
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-30 z-20"></div>
          
          <div ref={newsRef} className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 text-[10px] md:text-xs font-mono scroll-smooth mask-image-b z-10">
            {newsFeed.length === 0 && <div className="text-gray-500 italic text-center mt-10">No active news stream.</div>}
            {newsFeed.map((news) => (
              <div key={news.id} className={`
                border-l-2 pl-2 py-1 transition-all animate-fade-in leading-tight relative
                ${news.type === 'positive' ? 'border-green-500 text-green-200 bg-green-900/20' : ''}
                ${news.type === 'negative' ? 'border-red-500 text-red-200 bg-red-900/20' : ''}
                ${news.type === 'neutral' ? 'border-blue-400 text-blue-100 bg-blue-900/20' : ''}
              `}>
                {news.text}
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <div className="absolute bottom-1 right-2 md:right-4 text-[8px] md:text-[9px] text-white/30 font-mono text-right pointer-events-auto hover:text-white/60 transition-colors">
        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer">Created by @ammaar</a>
      </div>
    </div>
  );
};

export default UIOverlay;
