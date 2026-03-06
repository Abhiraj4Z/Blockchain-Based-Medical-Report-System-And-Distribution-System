import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL not found'); process.exit(1); }

async function migrate() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('✅ Connected to database');
    try {
        await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_name TEXT;`);
        console.log('✅ hospital_name TEXT column added to appointments');
    } finally {
        await client.end();
    }
}

migrate().catch((err) => { console.error('❌ Migration failed:', err.message); process.exit(1); });
