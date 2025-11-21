
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { BuildingConfig, BuildingType, Era } from './types';

// Map Settings
export const GRID_SIZE = 20; // Increased size for exploration

// Game Settings
export const TICK_RATE_MS = 2000; // Game loop updates every 2 seconds
export const ENEMY_TICK_RATE_MS = 500; // Enemies move faster
export const BOAT_TICK_RATE_MS = 800;
export const INITIAL_STATS = {
    money: 1500,
    wood: 100,
    stone: 50,
    food: 200,
    population: 0,
};
export const UPGRADE_MULTIPLIER = 1.5; // Cost multiplier per level

export const ERA_THRESHOLDS = {
  [Era.Primitive]: { pop: 0, money: 0 },
  [Era.Industrial]: { pop: 50, money: 3000 },
  [Era.Modern]: { pop: 300, money: 15000 },
  [Era.Future]: { pop: 1000, money: 60000 },
};

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.None]: {
    type: BuildingType.None,
    costMoney: 0, costWood: 0, costStone: 0,
    name: 'Bulldoze',
    description: 'Clear tile / Harvest',
    color: '#ef4444', 
    popGen: 0, incomeGen: 0,
  },
  [BuildingType.Road]: {
    type: BuildingType.Road,
    costMoney: 5, costWood: 0, costStone: 0,
    name: 'Road',
    description: 'Connects zones. Bridge on water.',
    color: '#374151',
    popGen: 0, incomeGen: 0,
  },
  [BuildingType.Residential]: {
    type: BuildingType.Residential,
    costMoney: 50, costWood: 10, costStone: 0,
    name: 'Housing',
    description: '+5 Pop. Click to Upgrade.',
    color: '#f87171',
    popGen: 5, incomeGen: 5, // Taxes
  },
  [BuildingType.Commercial]: {
    type: BuildingType.Commercial,
    costMoney: 100, costWood: 20, costStone: 5,
    name: 'Business',
    description: 'Generates Money. Click to Upgrade.',
    color: '#60a5fa',
    popGen: 0, incomeGen: 25,
  },
  [BuildingType.Industrial]: {
    type: BuildingType.Industrial,
    costMoney: 200, costWood: 30, costStone: 10,
    name: 'Industry',
    description: 'Extracts Resources. Click to Upgrade.',
    color: '#facc15',
    popGen: 0, incomeGen: 10, // Lower passive income, but resource gen
  },
  [BuildingType.Farm]: {
    type: BuildingType.Farm,
    costMoney: 30, costWood: 5, costStone: 0,
    name: 'Farm',
    description: 'Produces Food.',
    color: '#84cc16', // lime-500
    popGen: 0, incomeGen: 5,
  },
  [BuildingType.Defense]: {
    type: BuildingType.Defense,
    costMoney: 150, costWood: 20, costStone: 40,
    name: 'Defense',
    description: 'Protects area. Click to Upgrade.',
    color: '#7f1d1d', // red-900
    popGen: 0, incomeGen: -5, // Maintenance
  },
  [BuildingType.Park]: {
    type: BuildingType.Park,
    costMoney: 50, costWood: 10, costStone: 5,
    name: 'Park',
    description: 'Boosts Land Value',
    color: '#4ade80',
    popGen: 1, incomeGen: 0,
  },
  [BuildingType.Port]: {
    type: BuildingType.Port,
    costMoney: 300, costWood: 50, costStone: 20,
    name: 'Port',
    description: 'Explores & Pillages map.',
    color: '#0ea5e9',
    popGen: 2, incomeGen: 10,
  },
};
