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
        await client.query(`ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false`);
        console.log('✅ is_revoked column added to emergency_access_logs');
        await client.query(`ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`);
        console.log('✅ revoked_at column added to emergency_access_logs');
    } finally {
        await client.end();
    }
}

migrate().catch((err) => { console.error('❌ Migration failed:', err.message); process.exit(1); });
