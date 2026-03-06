# Supabase Multi-Hospital Migration Plan

## Requirements
Migrate the MediChain healthcare app from localStorage-based storage to Supabase cloud database to enable:
1. **Cross-browser/device access**: Data persists and syncs across all browsers and systems
2. **Multi-hospital support**: Separate databases per hospital for data isolation
3. **Doctors working across hospitals**: Doctors can be affiliated with multiple hospitals
4. **Dual authentication**: Both traditional email/password AND MetaMask blockchain verification
5. **Data migration**: Preserve existing test data from localStorage

## Current Architecture Analysis

### Current Storage (localStorage-based)
- `src/lib/storage.ts` - All data operations using browser localStorage
- Data types: Users, MedicalRecords, Appointments, AccessRequests, TestResults, EmergencyAccessRecords
- No persistence across browsers/devices
- No multi-hospital support

### Current Authentication
- `src/contexts/AuthContext.tsx` - React context using localStorage
- MetaMask blockchain address verification required for login/register
- Roles: `patient` | `doctor`

### Current Features
- Patient dashboard: Profile, medical records upload, appointments, access control
- Doctor dashboard: Profile, appointment management, patient access requests, test result uploads, emergency access

## Proposed Architecture

### Database Structure (Per-Hospital Supabase Projects)

Each hospital gets its own Supabase project for maximum data isolation (HIPAA-compliant approach).

#### Central Management Project
Stores hospital registry and credential mappings:

```sql
-- hospitals table (central project)
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  supabase_project_ref TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- doctor_hospital_affiliations (central - for multi-hospital doctors)
CREATE TABLE doctor_hospital_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  hospital_id UUID REFERENCES hospitals(id),
  blockchain_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, hospital_id)
);
```

#### Per-Hospital Project Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (patients and doctors at this hospital)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
  blockchain_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient profiles
CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  blood_type TEXT,
  allergies TEXT,
  emergency_contact TEXT,
  address TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor profiles
CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  specialization TEXT,
  qualification TEXT,
  experience TEXT,
  availability TEXT,
  phone TEXT,
  license_number TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical records
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  patient_name TEXT NOT NULL,
  patient_blockchain_address TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  reason TEXT,
  notes TEXT,
  blockchain_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access requests (doctor requesting patient records)
CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  blockchain_tx_hash TEXT,
  expires_at TIMESTAMPTZ
);

-- Test results (uploaded by doctors for patients)
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  doctor_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  test_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency access logs
CREATE TABLE emergency_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL
);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for medical_records)
CREATE POLICY "Patients can view own records" ON medical_records
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors with access can view records" ON medical_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM access_requests 
      WHERE access_requests.doctor_id = auth.uid() 
      AND access_requests.patient_id = medical_records.patient_id 
      AND access_requests.status = 'approved'
      AND (access_requests.expires_at IS NULL OR access_requests.expires_at > NOW())
    )
  );

CREATE POLICY "Patients can insert own records" ON medical_records
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can delete own records" ON medical_records
  FOR DELETE USING (auth.uid() = patient_id);
```

### Authentication Flow (Dual: Email + MetaMask)

```
1. User selects hospital (subdomain or selector)
2. User enters email/password 
3. Supabase Auth validates credentials
4. App requests MetaMask signature to verify blockchain address
5. App validates blockchain_address matches user record
6. Session established with both Supabase + blockchain verification
```

## Implementation Phases

### Phase 1: Setup Supabase Infrastructure
- Create central Supabase management project
- Create first hospital Supabase project
- Setup database schema and RLS policies
- Configure Supabase Auth with custom claims
- Add `@supabase/supabase-js` and `@supabase/ssr` packages

### Phase 2: Create Supabase Client Layer
- Create `src/lib/supabase/client.ts` for browser client
- Create `src/lib/supabase/server.ts` for server components
- Create `src/lib/supabase/middleware.ts` for auth middleware
- Create tenant/hospital resolution logic
- Setup environment variables

### Phase 3: Migrate Storage Functions
- Create `src/lib/supabase/storage.ts` mirroring current storage.ts API
- Replace localStorage calls with Supabase queries
- Maintain same function signatures for minimal refactoring
- Add real-time subscriptions for live updates

### Phase 4: Update Authentication
- Modify `src/contexts/AuthContext.tsx` to use Supabase Auth
- Keep MetaMask verification as additional layer
- Add hospital context/selection
- Update login/register pages for dual auth flow

### Phase 5: Update Dashboard Components
- Update patient dashboard to use new storage layer
- Update doctor dashboard to use new storage layer
- Add hospital selector for multi-hospital doctors
- Add real-time updates for appointments/access requests

### Phase 6: Data Migration Utility
- Create migration script to export localStorage data
- API endpoint to import data to Supabase
- Validate data integrity after migration

### Phase 7: File Storage Migration
- Setup Supabase Storage buckets for medical files
- Migrate from base64 localStorage to Supabase Storage URLs
- Update upload/download flows

### Phase 8: Multi-Hospital Features
- Add hospital management admin panel
- Doctor hospital affiliation management
- Cross-hospital doctor authentication
- Hospital-specific theming/branding

## File Changes Summary

### New Files to Create
```
src/lib/supabase/
├── client.ts          # Browser Supabase client
├── server.ts          # Server Supabase client  
├── middleware.ts      # Auth middleware helpers
├── storage.ts         # Storage functions (replaces localStorage)
├── types.ts           # Database types
└── hospital.ts        # Hospital/tenant resolution

src/app/api/
├── auth/
│   └── callback/route.ts    # Supabase auth callback
├── migrate/
│   └── route.ts             # Data migration endpoint
└── hospitals/
    └── route.ts             # Hospital management

src/components/
└── HospitalSelector.tsx     # Hospital selection component

src/middleware.ts            # Next.js middleware for auth
```

### Files to Modify
```
src/contexts/AuthContext.tsx     # Use Supabase Auth + MetaMask
src/app/login/page.tsx           # Add hospital selection, Supabase login
src/app/register/page.tsx        # Add hospital selection, Supabase register
src/app/patient/dashboard/page.tsx  # Use new storage layer
src/app/doctor/dashboard/page.tsx   # Use new storage layer, hospital switcher
src/lib/storage.ts               # Keep as fallback, deprecate gradually
package.json                     # Add Supabase dependencies
```

### Environment Variables Required
```env
# Central Supabase Project
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# App Config
NEXT_PUBLIC_ROOT_DOMAIN=medichain.com
NEXT_PUBLIC_DEFAULT_HOSPITAL_ID=xxx
```

## Migration Strategy

### Step 1: Parallel Operation
- New Supabase layer runs alongside localStorage
- Feature flag to toggle between storage backends
- Allows testing without breaking existing functionality

### Step 2: Data Export
- User clicks "Export Data" button
- Exports all localStorage data to JSON
- Stores locally as backup

### Step 3: Data Import
- User authenticates with Supabase
- Uploads exported JSON
- Server validates and imports to Supabase
- Links data to authenticated user

### Step 4: Switch Over
- Enable Supabase as primary storage
- localStorage becomes read-only fallback
- Monitor for issues

### Step 5: Cleanup
- Remove localStorage fallback
- Delete migration utilities
- Update documentation

## Security Considerations

1. **HIPAA Compliance**: Requires Supabase Enterprise plan with signed BAA
2. **RLS Policies**: All PHI tables must have row-level security
3. **Encryption**: Enable TLS, consider column-level encryption for sensitive data
4. **Audit Logging**: Enable Supabase audit logs for compliance
5. **MetaMask Verification**: Maintains blockchain-based identity verification
6. **Session Management**: Supabase handles secure session tokens

## Dependencies to Add

```json
{
  "@supabase/supabase-js": "^2.x",
  "@supabase/ssr": "^0.x"
}
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Export backup, parallel operation period |
| Auth disruption | High | Gradual rollout, feature flags |
| Performance issues | Medium | Supabase edge functions, caching |
| Cost increase | Medium | Start with Pro plan, scale as needed |
| Breaking MetaMask flow | High | Test extensively, keep as verification layer |

## Success Criteria

1. Users can access data from any browser/device
2. Doctors can work across multiple hospitals
3. Each hospital's data is isolated
4. Existing test data successfully migrated
5. Both email/password and MetaMask auth working
6. Real-time updates for appointments and access requests
7. No data loss during migration
