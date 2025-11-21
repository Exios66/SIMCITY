
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, Era, Weather, ResourceType, Enemy } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, ENEMY_TICK_RATE_MS, INITIAL_STATS, ERA_THRESHOLDS } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';

const createInitialGrid = (): Grid => {
  const grid: Grid = [];
  const center = GRID_SIZE / 2;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const dist = Math.sqrt((x-center)*(x-center) + (y-center)*(y-center));
      let rType = ResourceType.None;
      
      // Resource Generation (Randomized)
      const rand = Math.random();
      if (dist > center - 2) {
         rType = ResourceType.Water;
      } else if (rand > 0.95) {
         rType = ResourceType.Stone;
      } else if (rand > 0.85) {
         rType = ResourceType.Forest;
      }

      row.push({ 
          x, y, 
          buildingType: BuildingType.None, 
          resourceType: rType,
          landValue: 1.0,
          variant: Math.random()
      });
    }
    grid.push(row);
  }
  return grid;
};

const calculateLandValue = (grid: Grid, x: number, y: number): number => {
    let value = 1.0;
    const neighbors = [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];

    neighbors.forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const tile = grid[ny][nx];
            if (tile.resourceType === ResourceType.Water) value += 0.1;
            if (tile.resourceType === ResourceType.Forest) value += 0.05;
            if (tile.buildingType === BuildingType.Park) value += 0.2;
            if (tile.buildingType === BuildingType.Industrial) value -= 0.15;
            if (tile.buildingType === BuildingType.Defense) value += 0.05; // Safety
        }
    });
    return Math.max(0.5, Math.min(2.0, value));
};

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  const [grid, setGrid] = useState<Grid>(createInitialGrid);
  const [stats, setStats] = useState<CityStats>({ 
      ...INITIAL_STATS,
      day: 1,
      era: Era.Primitive,
      weather: Weather.Sunny
  });
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  const [hoveredLandValue, setHoveredLandValue] = useState<number | null>(null);
  
  // AI State
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { goalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-12), item]);
  }, []);

  const fetchNewGoal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    await new Promise(r => setTimeout(r, 500));
    
    const newGoal = await generateCityGoal(statsRef.current, gridRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      if(aiEnabledRef.current) setTimeout(fetchNewGoal, 5000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  const fetchNews = useCallback(async () => {
    if (!aiEnabledRef.current || Math.random() > 0.2) return; 
    const news = await generateNewsEvent(statsRef.current, null);
    if (news) addNewsItem(news);
  }, [addNewsItem]);

  useEffect(() => {
    if (!gameStarted) return;
    addNewsItem({ id: Date.now().toString(), text: "Settlement established. Beware of wild bands.", type: 'positive' });
    if (aiEnabled) fetchNewGoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);

  // --- Game Loop (Resources & Economy) ---
  useEffect(() => {
    if (!gameStarted) return;

    const intervalId = setInterval(() => {
      let dailyIncome = 0;
      let dailyPopGrowth = 0;
      let dailyWood = 0;
      let dailyStone = 0;
      let dailyFood = 0;
      let buildingCounts: Record<string, number> = {};
      
      gridRef.current.flat().forEach(tile => {
        if (tile.buildingType !== BuildingType.None) {
          const config = BUILDINGS[tile.buildingType];
          const income = config.incomeGen * tile.landValue;
          
          dailyIncome += income;
          dailyPopGrowth += config.popGen;
          buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;

          // Special Resource Logic
          if (tile.buildingType === BuildingType.Farm) dailyFood += 15; // Farm Production
          if (tile.buildingType === BuildingType.Industrial) {
              if (tile.resourceType === ResourceType.Forest) dailyWood += 5;
              else if (tile.resourceType === ResourceType.Stone) dailyStone += 3;
              else dailyIncome += 5; // Extra income if just a factory
          }
        }
      });

      setStats(prev => {
        // Food Consumption
        const foodConsumption = Math.ceil(prev.population * 0.2); 
        let newFood = prev.food + dailyFood - foodConsumption;
        let starving = false;
        
        if (newFood < 0) {
            newFood = 0;
            starving = true;
        }

        const resCount = buildingCounts[BuildingType.Residential] || 0;
        const maxPop = resCount * 50; 
        
        let newPop = prev.population + (starving ? -5 : dailyPopGrowth);
        if (newPop > maxPop) newPop = maxPop; 
        if (newPop < 0) newPop = 0;

        // Era Progression
        let nextEra = prev.era;
        if (prev.era === Era.Primitive && newPop >= ERA_THRESHOLDS[Era.Industrial].pop && prev.money >= ERA_THRESHOLDS[Era.Industrial].money) nextEra = Era.Industrial;
        else if (prev.era === Era.Industrial && newPop >= ERA_THRESHOLDS[Era.Modern].pop && prev.money >= ERA_THRESHOLDS[Era.Modern].money) nextEra = Era.Modern;
        else if (prev.era === Era.Modern && newPop >= ERA_THRESHOLDS[Era.Future].pop && prev.money >= ERA_THRESHOLDS[Era.Future].money) nextEra = Era.Future;

        if (nextEra !== prev.era) {
            addNewsItem({ id: Date.now().toString(), text: `SOCIETAL ADVANCEMENT: Welcome to the ${nextEra} Era!`, type: 'positive' });
        }

        let nextWeather = prev.weather;
        if (Math.random() > 0.95) {
            const weathers = [Weather.Sunny, Weather.Rain, Weather.Snow];
            nextWeather = weathers[Math.floor(Math.random() * weathers.length)];
        }

        const newStats = {
          money: Math.floor(prev.money + dailyIncome),
          wood: prev.wood + dailyWood,
          stone: prev.stone + dailyStone,
          food: newFood,
          population: newPop,
          day: prev.day + 1,
          era: nextEra,
          weather: nextWeather
        };
        
        // Check Goal
        const goal = goalRef.current;
        if (aiEnabledRef.current && goal && !goal.completed) {
          let isMet = false;
          if (goal.targetType === 'money' && newStats.money >= goal.targetValue) isMet = true;
          if (goal.targetType === 'population' && newStats.population >= goal.targetValue) isMet = true;
          if (goal.targetType === 'building_count' && goal.buildingType) {
            if ((buildingCounts[goal.buildingType] || 0) >= goal.targetValue) isMet = true;
          }
          if (isMet) setCurrentGoal({ ...goal, completed: true });
        }
        
        // Alert if starving
        if (starving && prev.population > 0 && prev.day % 3 === 0) {
             addNewsItem({ id: Date.now().toString(), text: "Food shortage! Population is starving.", type: 'negative' });
        }

        return newStats;
      });

      fetchNews();

    }, TICK_RATE_MS);

    return () => clearInterval(intervalId);
  }, [fetchNews, gameStarted, addNewsItem]);

  // --- Enemy Logic ---
  useEffect(() => {
      if (!gameStarted) return;
      
      const enemyInterval = setInterval(() => {
          const currentStats = statsRef.current;
          
          // Spawning
          // Chance increases with population
          const spawnChance = Math.min(0.3, currentStats.population / 500);
          if (Math.random() < spawnChance && enemiesRef.current.length < 10) {
               const edge = Math.floor(Math.random() * 4);
               let ex=0, ey=0;
               if (edge === 0) { ex = Math.random() * GRID_SIZE; ey = 0; }
               if (edge === 1) { ex = Math.random() * GRID_SIZE; ey = GRID_SIZE - 1; }
               if (edge === 2) { ex = 0; ey = Math.random() * GRID_SIZE; }
               if (edge === 3) { ex = GRID_SIZE - 1; ey = Math.random() * GRID_SIZE; }
               
               const newEnemy: Enemy = {
                   id: Date.now() + Math.random().toString(),
                   x: ex, y: ey,
                   hp: 50 + (currentStats.era === Era.Future ? 200 : 0),
                   maxHp: 50 + (currentStats.era === Era.Future ? 200 : 0),
                   attackCooldown: 0
               };
               setEnemies(prev => [...prev, newEnemy]);
               if (Math.random() > 0.7) addNewsItem({id: Date.now().toString(), text: "Hostiles detected approaching the city!", type: 'negative'});
          }

          // Movement & Attack
          setEnemies(prevEnemies => {
              return prevEnemies.map(enemy => {
                  // Find nearest building
                  let targetX = -1, targetY = -1;
                  let minDist = 999;
                  
                  // If already near a target, stay? No, simple aggressive AI
                  for(let y=0; y<GRID_SIZE; y++) {
                      for(let x=0; x<GRID_SIZE; x++) {
                          if (gridRef.current[y][x].buildingType !== BuildingType.None && gridRef.current[y][x].buildingType !== BuildingType.Road) {
                               const dist = Math.abs(enemy.x - x) + Math.abs(enemy.y - y);
                               if (dist < minDist) {
                                   minDist = dist;
                                   targetX = x; targetY = y;
                               }
                          }
                      }
                  }

                  if (targetX === -1) return enemy; // No targets

                  // Move
                  let nx = enemy.x;
                  let ny = enemy.y;
                  if (minDist > 0.5) {
                      const dx = targetX - enemy.x;
                      const dy = targetY - enemy.y;
                      const moveSpeed = 0.1; 
                      nx += (dx !== 0 ? Math.sign(dx) : 0) * moveSpeed;
                      ny += (dy !== 0 ? Math.sign(dy) : 0) * moveSpeed;
                  }

                  // Attack or Defense Damage
                  let hp = enemy.hp;
                  
                  // Check for nearby defenses
                  const gridX = Math.round(nx);
                  const gridY = Math.round(ny);
                  const range = [[-1,0],[1,0],[0,-1],[0,1],[0,0], [-1,-1], [-1,1], [1,-1], [1,1]];
                  
                  range.forEach(([dx, dy]) => {
                       const tx = gridX+dx, ty = gridY+dy;
                       if(tx>=0 && tx<GRID_SIZE && ty>=0 && ty<GRID_SIZE) {
                           if (gridRef.current[ty][tx].buildingType === BuildingType.Defense) {
                               hp -= 5; // Turret damage
                           }
                       }
                  });

                  // Damage Building
                  if (minDist < 1.0 && enemy.attackCooldown <= 0) {
                       // Reduce stats or destroy building chance
                       if (Math.random() > 0.8) {
                           // Steal resources
                           setStats(s => ({...s, money: Math.max(0, s.money - 10), food: Math.max(0, s.food - 5)}));
                       }
                       return { ...enemy, x: nx, y: ny, hp, attackCooldown: 5 };
                  }

                  return { ...enemy, x: nx, y: ny, hp, attackCooldown: Math.max(0, enemy.attackCooldown - 1) };
              }).filter(e => e.hp > 0);
          });

      }, ENEMY_TICK_RATE_MS);

      return () => clearInterval(enemyInterval);
  }, [gameStarted, addNewsItem]);

  // --- Interaction ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; 

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool;
    
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const currentTile = currentGrid[y][x];
    
    if (currentTile.resourceType === ResourceType.Water) {
         addNewsItem({id: Date.now().toString(), text: "Cannot build on water.", type: 'negative'});
         return;
    }

    const buildingConfig = BUILDINGS[tool];

    // Bulldoze
    if (tool === BuildingType.None) {
      if (currentTile.buildingType !== BuildingType.None) {
        const demolishCost = 5;
        if (currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { ...currentTile, buildingType: BuildingType.None };
            
            // Update land values
            const range = [[-1,0],[1,0],[0,-1],[0,1],[0,0]];
            range.forEach(([dx, dy]) => {
                const nx = x+dx, ny = y+dy;
                if(nx>=0 && nx<GRID_SIZE && ny>=0 && ny<GRID_SIZE) {
                    newGrid[ny][nx].landValue = calculateLandValue(newGrid, nx, ny);
                }
            });

            setGrid(newGrid);
            setStats(prev => ({ ...prev, money: prev.money - demolishCost }));
            
            // If bulldozing Forest, get Wood
            if (currentTile.resourceType === ResourceType.Forest) {
                 setStats(prev => ({ ...prev, wood: prev.wood + 10 }));
                 addNewsItem({id: Date.now().toString(), text: "Cleared forest. +10 Wood.", type: 'neutral'});
            }
        }
      }
      return;
    }

    // Place
    if (currentTile.buildingType === BuildingType.None) {
      if (currentStats.money >= buildingConfig.costMoney && 
          currentStats.wood >= buildingConfig.costWood &&
          currentStats.stone >= buildingConfig.costStone) {
              
        setStats(prev => ({ 
            ...prev, 
            money: prev.money - buildingConfig.costMoney,
            wood: prev.wood - buildingConfig.costWood,
            stone: prev.stone - buildingConfig.costStone
        }));
        
        const newGrid = currentGrid.map(row => [...row]);
        newGrid[y][x] = { ...currentTile, buildingType: tool };
        
        // Recalculate Land Value
        const range = [[-1,0],[1,0],[0,-1],[0,1],[0,0],[-1,-1],[-1,1],[1,-1],[1,1]];
        range.forEach(([dx, dy]) => {
             const nx = x+dx, ny = y+dy;
             if(nx>=0 && nx<GRID_SIZE && ny>=0 && ny<GRID_SIZE) {
                 newGrid[ny][nx].landValue = calculateLandValue(newGrid, nx, ny);
             }
        });
        
        setGrid(newGrid);
      } else {
        addNewsItem({id: Date.now().toString() + Math.random(), text: `Insufficient resources for ${buildingConfig.name}.`, type: 'negative'});
      }
    }
  }, [selectedTool, addNewsItem, gameStarted]);

  const handleEnemyClick = useCallback((id: string) => {
      setEnemies(prev => {
          const newEnemies = prev.map(e => e.id === id ? { ...e, hp: e.hp - 20 } : e).filter(e => e.hp > 0);
          return newEnemies;
      });
  }, []);

  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      setStats(prev => ({ ...prev, money: prev.money + currentGoal.reward }));
      addNewsItem({id: Date.now().toString(), text: `Goal achieved!`, type: 'positive'});
      setCurrentGoal(null);
      fetchNewGoal();
    }
  };

  const handleStart = (enabled: boolean) => {
    setAiEnabled(enabled);
    setGameStarted(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-sky-900">
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        stats={stats}
        hoveredLandValue={hoveredLandValue}
        setHoveredLandValue={setHoveredLandValue}
        enemies={enemies}
        onEnemyClick={handleEnemyClick}
      />
      
      {!gameStarted && <StartScreen onStart={handleStart} />}

      {gameStarted && (
        <UIOverlay
          stats={stats}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          hoveredLandValue={hoveredLandValue}
        />
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .mask-image-b { -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%); mask-image: linear-gradient(to bottom, transparent 0%, black 15%); }
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}

export default App;
