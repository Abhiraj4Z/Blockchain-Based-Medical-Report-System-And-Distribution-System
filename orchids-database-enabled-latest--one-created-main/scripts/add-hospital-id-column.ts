// One-time migration: adds hospital_id TEXT column to doctor_profiles
// Run with: npx tsx scripts/add-hospital-id-column.ts

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
}

async function migrate() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('✅ Connected to database');

    try {
        await client.query(`
      ALTER TABLE doctor_profiles
      ADD COLUMN IF NOT EXISTS hospital_id TEXT;
    `);
        console.log('✅ hospital_id TEXT column added to doctor_profiles (or already existed)');
    } finally {
        await client.end();
    }
}

migrate().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
