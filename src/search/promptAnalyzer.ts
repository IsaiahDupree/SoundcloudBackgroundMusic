import OpenAI from 'openai';
import { env } from '../config/env';
import { QueryAnalysis } from '../types/query';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a music search assistant. Given a natural language query about music, extract structured search parameters.

Respond with JSON only (no markdown):
{
  "search_text": "key descriptive words for embedding search",
  "mood": "one word mood (e.g. chill, energetic, melancholic, uplifting, dark, dreamy)",
  "energy_range": [min, max] or null (0-1 scale: 0=silent, 0.05=ambient, 0.1=chill, 0.2=moderate, 0.35=energetic),
  "bpm_range": [min, max] or null,
  "genre_hints": ["genre1", "genre2"],
  "context": "brief description of the use case"
}

Examples:
- "chill lofi for coding" → energy_range: [0.03, 0.12], bpm_range: [60, 95], genre: ["lo-fi", "hip-hop"]
- "upbeat electronic workout" → energy_range: [0.2, 0.5], bpm_range: [120, 160], genre: ["electronic", "edm"]
- "calm ambient for sleeping" → energy_range: [0.01, 0.05], bpm_range: [40, 80], genre: ["ambient"]`;

export async function analyzePrompt(prompt: string): Promise<QueryAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const text = response.choices[0]?.message?.content?.trim() || '';
    // Strip markdown code fences if present
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      search_text: parsed.search_text || prompt,
      mood: parsed.mood || '',
      energy_range: parsed.energy_range || null,
      bpm_range: parsed.bpm_range || null,
      genre_hints: parsed.genre_hints || [],
      context: parsed.context || '',
    };
  } catch (err: any) {
    logger.warn(`Prompt analysis failed, using raw prompt: ${err.message}`);
    return {
      search_text: prompt,
      mood: '',
      energy_range: null,
      bpm_range: null,
      genre_hints: [],
      context: '',
    };
  }
}
