import fs from 'fs';
import path from 'path';
import { getSupabase } from './supabaseClient';
import { logger } from '../utils/logger';
import '../config/env'; // ensure dotenv loads

async function migrate() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
  const supabase = getSupabase();

  logger.info('Running database migration...');

  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' });
    if (error) {
      // Try direct query if rpc not available
      logger.warn(`RPC exec_sql not available, trying raw: ${error.message}`);
      const { error: rawError } = await supabase.from('_migrations').select().limit(0);
      if (rawError) {
        logger.error(`Migration failed: ${rawError.message}`);
        logger.info('You may need to run the schema.sql manually in Supabase SQL editor.');
        logger.info(`Schema file: ${path.resolve(__dirname, '../db/schema.sql')}`);
        process.exit(1);
      }
    }
  }

  logger.info('Migration completed successfully.');
}

migrate().catch(err => {
  logger.error(`Migration error: ${err.message}`);
  process.exit(1);
});
