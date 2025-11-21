
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, Era, Weather, ResourceType, Enemy, Boat } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, ENEMY_TICK_RATE_MS, BOAT_TICK_RATE_MS, INITIAL_STATS, ERA_THRESHOLDS, UPGRADE_MULTIPLIER } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';

const createInitialGrid = (): Grid => {
  const grid: Grid = [];
  const center = GRID_SIZE / 2;

  // Noise helper (simple)
  const noise = (x: number, y: number) => Math.sin(x * 0.3) * Math.cos(y * 0.3) + Math.sin(x*0.7 + y*0.5)*0.5;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const dist = Math.sqrt((x-center)*(x-center) + (y-center)*(y-center));
      const nVal = noise(x, y);
      
      let rType = ResourceType.None;
      let isLand = false;

      // Main Island
      if (dist < 4.5 + nVal) {
          isLand = true;
      } 
      // Satellite Islands
      else if (Math.abs(x - 3) < 2 && Math.abs(y - 3) < 2) isLand = true;
      else if (Math.abs(x - 16) < 3 && Math.abs(y - 15) < 2) isLand = true;
      else if (Math.abs(x - 14) < 2 && Math.abs(y - 4) < 2) isLand = true;

      if (!isLand) {
          rType = ResourceType.Water;
      } else {
          // Resources on land
          const rand = Math.random();
          if (rand > 0.90) rType = ResourceType.Stone;
          else if (rand > 0.75) rType = ResourceType.Forest;
      }

      // Only center is explored initially
      const explored = dist < 6;

      row.push({ 
          x, y, 
          buildingType: BuildingType.None, 
          resourceType: rType,
          landValue: 1.0,
          variant: Math.random(),
          level: 1,
          explored
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
            if (tile.buildingType === BuildingType.Defense) value += 0.05;
            if (tile.level > 1) value += 0.1 * (tile.level - 1);
        }
    });
    return Math.max(0.5, Math.min(2.5, value));
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
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  const [hoveredLandValue, setHoveredLandValue] = useState<number | null>(null);
  
  // AI State
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const boatsRef = useRef(boats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { boatsRef.current = boats; }, [boats]);
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
    addNewsItem({ id: Date.now().toString(), text: "Settlement established. Explore the unknown.", type: 'positive' });
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
          const levelMult = tile.level; // Linear scaling with level
          const income = (config.incomeGen * levelMult) * tile.landValue;
          
          dailyIncome += income;
          dailyPopGrowth += config.popGen * levelMult;
          buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;

          // Special Resource Logic
          if (tile.buildingType === BuildingType.Farm) dailyFood += 15 * levelMult;
          if (tile.buildingType === BuildingType.Industrial) {
              if (tile.resourceType === ResourceType.Forest) dailyWood += 5 * levelMult;
              else if (tile.resourceType === ResourceType.Stone) dailyStone += 3 * levelMult;
              else dailyIncome += 5 * levelMult;
          }
          if (tile.buildingType === BuildingType.Port) {
              dailyIncome += 5 * levelMult; // Trade income
          }
        }
      });

      setStats(prev => {
        const foodConsumption = Math.ceil(prev.population * 0.2); 
        let newFood = prev.food + dailyFood - foodConsumption;
        let starving = false;
        
        if (newFood < 0) {
            newFood = 0;
            starving = true;
        }

        const resCount = buildingCounts[BuildingType.Residential] || 0;
        // Rough max pop approximation. Doesn't account for levels perfectly but good enough limit.
        const maxPop = (resCount * 50) * 3; 
        
        let newPop = prev.population + (starving ? -5 : dailyPopGrowth);
        if (newPop > maxPop) newPop = maxPop; 
        if (newPop < 0) newPop = 0;

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

          // Movement
          setEnemies(prevEnemies => {
              return prevEnemies.map(enemy => {
                  let targetX = -1, targetY = -1;
                  let minDist = 999;
                  
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

                  if (targetX === -1) return enemy;

                  let nx = enemy.x;
                  let ny = enemy.y;
                  if (minDist > 0.5) {
                      const dx = targetX - enemy.x;
                      const dy = targetY - enemy.y;
                      const moveSpeed = 0.1; 
                      nx += (dx !== 0 ? Math.sign(dx) : 0) * moveSpeed;
                      ny += (dy !== 0 ? Math.sign(dy) : 0) * moveSpeed;
                  }

                  let hp = enemy.hp;
                  
                  // Turret Damage
                  const gridX = Math.round(nx);
                  const gridY = Math.round(ny);
                  const range = [[-1,0],[1,0],[0,-1],[0,1],[0,0], [-1,-1], [-1,1], [1,-1], [1,1]];
                  
                  range.forEach(([dx, dy]) => {
                       const tx = gridX+dx, ty = gridY+dy;
                       if(tx>=0 && tx<GRID_SIZE && ty>=0 && ty<GRID_SIZE) {
                           const tile = gridRef.current[ty][tx];
                           if (tile.buildingType === BuildingType.Defense) {
                               hp -= 5 * tile.level; // Scaled damage
                           }
                       }
                  });

                  if (minDist < 1.0 && enemy.attackCooldown <= 0) {
                       if (Math.random() > 0.8) {
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

  // --- Boat Logic ---
  useEffect(() => {
      if (!gameStarted) return;
      const boatInterval = setInterval(() => {
          const grid = gridRef.current;
          
          setBoats(prev => {
              if (prev.length === 0) return prev;

              // Find unexplored targets
              let unexploredTiles: {x:number, y:number}[] = [];
              for(let y=0; y<GRID_SIZE; y++) {
                  for(let x=0; x<GRID_SIZE; x++) {
                      if (!grid[y][x].explored) unexploredTiles.push({x,y});
                  }
              }
              
              if (unexploredTiles.length === 0) return prev;

              return prev.map(boat => {
                  if (!boat.targetX || grid[boat.targetY!][boat.targetX!].explored) {
                      // Find new target
                      let closest = unexploredTiles[0];
                      let minD = 999;
                      unexploredTiles.forEach(t => {
                          const d = Math.abs(t.x - boat.x) + Math.abs(t.y - boat.y);
                          if (d < minD) { minD = d; closest = t; }
                      });
                      boat.targetX = closest.x;
                      boat.targetY = closest.y;
                      boat.state = 'exploring';
                  }

                  // Move
                  let nx = boat.x;
                  let ny = boat.y;
                  const dx = boat.targetX! - boat.x;
                  const dy = boat.targetY! - boat.y;
                  const speed = 0.2;
                  
                  nx += (dx !== 0 ? Math.sign(dx) : 0) * speed;
                  ny += (dy !== 0 ? Math.sign(dy) : 0) * speed;
                  
                  // Reveal logic
                  if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) {
                       // Reveal Area
                       const gx = Math.round(nx);
                       const gy = Math.round(ny);
                       const range = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];
                       let foundSomething = false;
                       
                       setGrid(g => {
                           const ng = g.map(row => [...row]);
                           range.forEach(([rx, ry]) => {
                               if (gy+ry >=0 && gy+ry < GRID_SIZE && gx+rx >=0 && gx+rx < GRID_SIZE) {
                                   const t = ng[gy+ry][gx+rx];
                                   if (!t.explored) {
                                        t.explored = true;
                                        // Pillage / Discovery
                                        if (t.resourceType !== ResourceType.None && t.resourceType !== ResourceType.Water) {
                                            foundSomething = true;
                                            // Add resources
                                            if(t.resourceType === ResourceType.Forest) setStats(s => ({...s, wood: s.wood + 20}));
                                            if(t.resourceType === ResourceType.Stone) setStats(s => ({...s, stone: s.stone + 10}));
                                        }
                                   }
                               }
                           });
                           return ng;
                       });
                       
                       if (foundSomething) {
                           addNewsItem({id: Date.now().toString(), text: "Expedition discovered resources!", type: 'positive'});
                           setStats(s => ({...s, money: s.money + 50}));
                       }
                  }

                  return { ...boat, x: nx, y: ny };
              });
          });

      }, BOAT_TICK_RATE_MS);
      return () => clearInterval(boatInterval);
  }, [gameStarted, addNewsItem]);


  // --- Interaction ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; 

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool;
    
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const currentTile = currentGrid[y][x];
    if (!currentTile.explored) return; // Cant build in fog

    const buildingConfig = BUILDINGS[tool];

    // UPGRADE LOGIC
    if (tool !== BuildingType.None && currentTile.buildingType === tool) {
        if (currentTile.level >= 3) {
            addNewsItem({id: Date.now().toString(), text: "Building at max level.", type: 'neutral'});
            return;
        }
        
        // Calc Upgrade Cost
        const multiplier = Math.pow(UPGRADE_MULTIPLIER, currentTile.level);
        const costMoney = Math.floor(buildingConfig.costMoney * multiplier);
        const costWood = Math.floor(buildingConfig.costWood * multiplier);
        const costStone = Math.floor(buildingConfig.costStone * multiplier);

        if (currentStats.money >= costMoney && currentStats.wood >= costWood && currentStats.stone >= costStone) {
             setStats(prev => ({ 
                ...prev, 
                money: prev.money - costMoney,
                wood: prev.wood - costWood,
                stone: prev.stone - costStone
            }));
            
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { ...currentTile, level: currentTile.level + 1 };
            // Recalculate values logic omitted for brevity but land value should update
            setGrid(newGrid);
            addNewsItem({id: Date.now().toString(), text: `${buildingConfig.name} upgraded to Level ${currentTile.level+1}!`, type: 'positive'});
        } else {
            addNewsItem({id: Date.now().toString(), text: `Upgrade costs $${costMoney}, W${costWood}, S${costStone}.`, type: 'negative'});
        }
        return;
    }

    if (tool === BuildingType.None) {
      if (currentTile.buildingType !== BuildingType.None) {
        const demolishCost = 5;
        if (currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { ...currentTile, buildingType: BuildingType.None, level: 1 };
            
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
            if (currentTile.resourceType === ResourceType.Forest) {
                 setStats(prev => ({ ...prev, wood: prev.wood + 10 }));
            }
        }
      }
      return;
    }

    // Build
    if (currentTile.buildingType === BuildingType.None) {
      // Water check
      if (currentTile.resourceType === ResourceType.Water && tool !== BuildingType.Port && tool !== BuildingType.Road) {
           addNewsItem({id: Date.now().toString(), text: "Can only build Ports or Bridges on water.", type: 'negative'});
           return;
      }
      if (tool === BuildingType.Port && currentTile.resourceType !== ResourceType.Water) {
            addNewsItem({id: Date.now().toString(), text: "Ports must be built on water.", type: 'negative'});
            return;
      }

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
        newGrid[y][x] = { ...currentTile, buildingType: tool, level: 1 };
        
        // Spawn boat if Port
        if (tool === BuildingType.Port) {
             setBoats(prev => [...prev, { id: Date.now().toString(), x: x, y: y, state: 'idle' }]);
        }
        
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
          return prev.map(e => e.id === id ? { ...e, hp: e.hp - 20 } : e).filter(e => e.hp > 0);
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
        boats={boats}
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
