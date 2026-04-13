import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  RAPIDAPI_KEY: required('RAPIDAPI_KEY'),
  SOUNDCLOUD_USERNAME: optional('SOUNDCLOUD_USERNAME', 'soursides'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_KEY: required('SUPABASE_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY', ''),
  PORT: parseInt(optional('PORT', '3850'), 10),
};
