
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum BuildingType {
  None = 'None',
  Road = 'Road',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  Park = 'Park',
  Farm = 'Farm',
  Defense = 'Defense',
}

export enum Era {
  Primitive = 'Primitive',
  Industrial = 'Industrial',
  Modern = 'Modern',
  Future = 'Future',
}

export enum Weather {
  Sunny = 'Sunny',
  Rain = 'Rain',
  Snow = 'Snow',
}

export enum ResourceType {
  None = 'None',
  Water = 'Water',
  Forest = 'Forest',
  Stone = 'Stone',
}

export interface BuildingConfig {
  type: BuildingType;
  costMoney: number;
  costWood: number;
  costStone: number;
  name: string;
  description: string;
  color: string; // Main color for 3D material
  popGen: number; // Population generation per tick
  incomeGen: number; // Money generation per tick
}

export interface TileData {
  x: number;
  y: number;
  buildingType: BuildingType;
  variant: number; // Random seed for visual variation
  resourceType: ResourceType;
  landValue: number; // 0.0 to 1.0+
}

export type Grid = TileData[][];

export interface CityStats {
  money: number;
  wood: number;
  stone: number;
  food: number;
  population: number;
  day: number;
  era: Era;
  weather: Weather;
}

export interface Enemy {
  id: string;
  x: number; // Grid X (interpolated for smooth movement)
  y: number; // Grid Y
  hp: number;
  maxHp: number;
  targetX?: number;
  targetY?: number;
  attackCooldown: number;
}

export interface AIGoal {
  description: string;
  targetType: 'population' | 'money' | 'building_count' | 'resource_stockpile';
  targetValue: number;
  buildingType?: BuildingType; // If target is building_count
  reward: number;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}
