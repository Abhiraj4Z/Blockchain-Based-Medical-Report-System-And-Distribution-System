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
        // Add all columns that the code tries to insert but may be missing
        const columns = [
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS doctor_email TEXT`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS hospital_name TEXT`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS hospital_id TEXT`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN DEFAULT true`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS doctor_name TEXT`,
            `ALTER TABLE emergency_access_logs ADD COLUMN IF NOT EXISTS patient_name TEXT`,
        ];
        for (const sql of columns) {
            await client.query(sql);
            const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
            console.log(`✅ ${col} column ensured on emergency_access_logs`);
        }
    } finally {
        await client.end();
    }
}

migrate().catch((err) => { console.error('❌ Migration failed:', err.message); process.exit(1); });
