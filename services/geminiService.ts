/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from "../types";
import { BUILDINGS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = 'gemini-2.5-flash';

// --- Goal Generation ---

const goalSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, creative description of the goal from the perspective of city council or citizens.",
    },
    targetType: {
      type: Type.STRING,
      enum: ['population', 'money', 'building_count'],
      description: "The metric to track.",
    },
    targetValue: {
      type: Type.INTEGER,
      description: "The target numeric value to reach.",
    },
    buildingType: {
      type: Type.STRING,
      enum: [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park, BuildingType.Road],
      description: "Required if targetType is building_count.",
    },
    reward: {
      type: Type.INTEGER,
      description: "Monetary reward for completion.",
    },
  },
  required: ['description', 'targetType', 'targetValue', 'reward'],
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.

  // Count buildings
  const counts: Record<string, number> = {};
  grid.flat().forEach(tile => {
    counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
  });

  const context = `
    Current City Stats:
    Day: ${stats.day}
    Money: $${stats.money}
    Population: ${stats.population}
    Era: ${stats.era}
    Weather: ${stats.weather}
    Buildings: ${JSON.stringify(counts)}
    Building Costs/Stats: ${JSON.stringify(
      Object.values(BUILDINGS).filter(b => b.type !== BuildingType.None).map(b => ({
        type: b.type, 
        costMoney: b.costMoney,
        costWood: b.costWood,
        costStone: b.costStone, 
        pop: b.popGen, 
        income: b.incomeGen
      }))
    )}
  `;

  const prompt = `You are the AI City Advisor for a simulation game. Based on the current city stats and Era, generate a challenging but achievable short-term goal for the player to help the city grow. 
  If in Primitive era, focus on basic growth. If Future, focus on high density. Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: goalSchema,
        temperature: 0.7,
      },
    });

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
      return { ...goalData, completed: false };
    }
  } catch (error) {
    console.error("Error generating goal:", error);
  }
  return null;
};

// --- News Feed Generation ---

const newsSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A one-sentence news headline representing life in the city." },
    type: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
  },
  required: ['text', 'type'],
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.

  const context = `City Stats - Pop: ${stats.population}, Money: ${stats.money}, Day: ${stats.day}, Era: ${stats.era}, Weather: ${stats.weather}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
  const prompt = "Generate a very short, isometric-sim-city style news headline based on the city state and Era. If it's raining or snowing, mention it. If in Primitive era, use primitive language. If Future, use sci-fi jargon. Can be funny, cynical, or celebratory.";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: newsSchema,
        temperature: 1.1, // High temp for variety
      },
    });

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString() + Math.random(),
        text: data.text,
        type: data.type,
      };
    }
  } catch (error) {
    console.error("Error generating news:", error);
  }
  return null;
};