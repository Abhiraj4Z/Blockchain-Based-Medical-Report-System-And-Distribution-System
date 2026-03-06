// Supabase-backed storage layer - mirrors the API from the original localStorage storage.ts
// All functions are async since they hit the network

import { supabase } from './client';
import type {
  DbUser,
  DbPatientProfile,
  DbDoctorProfile,
  DbMedicalRecord,
  DbAppointment,
  DbAccessRequest,
  DbTestResult,
  DbEmergencyAccessLog,
  DbHospital,
} from './types';

// Re-export compatible types for the rest of the app
export interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  role: 'patient' | 'doctor';
  blockchainAddress: string;
  hospitalId?: string;
  createdAt: string;
  profile?: PatientProfile | DoctorProfile;
}

export interface PatientProfile {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContact?: string;
  address?: string;
  phone?: string;
}

export interface DoctorProfile {
  fullName?: string;
  specialization?: string;
  qualification?: string;
  experience?: string;
  availability?: string;
  phone?: string;
  licenseNumber?: string;
  hospitalName?: string;
  hospitalId?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  fileName: string;
  fileHash: string;
  fileUrl: string;
  uploadedAt: string;
  description?: string;
  fileType: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  patientBlockchainAddress: string;
  doctorName: string;
  hospitalName?: string;
  date: string;
  time: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  reason?: string;
  notes?: string;
  createdAt: string;
  blockchainTxHash?: string;
}

export interface AccessRequest {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
  blockchainTxHash?: string;
  expiresAt?: string;
}

export interface TestResult {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
  description?: string;
  testType?: string;
}

export interface EmergencyAccessRecord {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  accessedAt: string;
  reason: string;
  hospitalName?: string;
  hospitalId?: string;
  mfaVerified?: boolean;
  doctorEmail?: string;
  verifiedAt?: string;
  isRevoked?: boolean;
  revokedAt?: string;
}

// ---- Mappers ----

function dbUserToUser(dbUser: DbUser, profile?: PatientProfile | DoctorProfile): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    username: dbUser.username,
    password: '', // never expose password hash to client
    role: dbUser.role,
    blockchainAddress: dbUser.blockchain_address,
    hospitalId: dbUser.hospital_id ?? undefined,
    createdAt: dbUser.created_at,
    profile,
  };
}

function dbPatientProfileToProfile(p: DbPatientProfile): PatientProfile {
  return {
    fullName: p.full_name ?? undefined,
    dateOfBirth: p.date_of_birth ?? undefined,
    gender: p.gender ?? undefined,
    bloodType: p.blood_type ?? undefined,
    allergies: p.allergies ?? undefined,
    emergencyContact: p.emergency_contact ?? undefined,
    address: p.address ?? undefined,
    phone: p.phone ?? undefined,
  };
}

function dbDoctorProfileToProfile(p: DbDoctorProfile): DoctorProfile {
  return {
    fullName: p.full_name ?? undefined,
    specialization: p.specialization ?? undefined,
    qualification: p.qualification ?? undefined,
    experience: p.experience ?? undefined,
    availability: p.availability ?? undefined,
    phone: p.phone ?? undefined,
    licenseNumber: p.license_number ?? undefined,
    hospitalName: p.hospital_name ?? undefined,
    hospitalId: p.hospital_id ?? undefined,
  };
}

function dbRecordToRecord(r: DbMedicalRecord): MedicalRecord {
  return {
    id: r.id,
    patientId: r.patient_id,
    fileName: r.file_name,
    fileHash: r.file_hash,
    fileUrl: r.file_url,
    uploadedAt: r.uploaded_at,
    description: r.description ?? undefined,
    fileType: r.file_type,
  };
}

function dbAppointmentToAppointment(a: DbAppointment): Appointment {
  return {
    id: a.id,
    patientId: a.patient_id,
    doctorId: a.doctor_id,
    patientName: a.patient_name,
    patientBlockchainAddress: a.patient_blockchain_address,
    doctorName: a.doctor_name,
    hospitalName: a.hospital_name ?? undefined,
    date: a.appointment_date,
    time: a.appointment_time,
    status: a.status,
    reason: a.reason ?? undefined,
    notes: a.notes ?? undefined,
    createdAt: a.created_at,
    blockchainTxHash: a.blockchain_tx_hash ?? undefined,
  };
}

function dbAccessRequestToRequest(r: DbAccessRequest): AccessRequest {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    patientId: r.patient_id,
    doctorName: r.doctor_name,
    patientName: r.patient_name,
    status: r.status,
    requestedAt: r.requested_at,
    respondedAt: r.responded_at ?? undefined,
    blockchainTxHash: r.blockchain_tx_hash ?? undefined,
    expiresAt: r.expires_at ?? undefined,
  };
}

function dbTestResultToResult(r: DbTestResult): TestResult {
  return {
    id: r.id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    doctorName: r.doctor_name,
    fileName: r.file_name,
    fileUrl: r.file_url,
    fileType: r.file_type,
    uploadedAt: r.uploaded_at,
    description: r.description ?? undefined,
    testType: r.test_type ?? undefined,
  };
}

function dbEmergencyLogToRecord(r: DbEmergencyAccessLog): EmergencyAccessRecord {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    patientId: r.patient_id,
    doctorName: r.doctor_name,
    patientName: r.patient_name,
    accessedAt: r.accessed_at,
    reason: r.reason,
    hospitalName: r.hospital_name ?? undefined,
    hospitalId: r.hospital_id ?? undefined,
    mfaVerified: r.mfa_verified ?? false,
    doctorEmail: r.doctor_email ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    isRevoked: r.is_revoked ?? false,
    revokedAt: r.revoked_at ?? undefined,
  };
}

// ---- User Management ----

export async function createUser(user: {
  email: string;
  username: string;
  password: string;
  role: 'patient' | 'doctor';
  blockchainAddress: string;
  hospitalId?: string;
}): Promise<User> {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: user.email,
      username: user.username,
      password_hash: user.password, // In production hash with bcrypt on server
      role: user.role,
      blockchain_address: user.blockchainAddress,
      hospital_id: user.hospitalId || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Create empty profile
  if (user.role === 'patient') {
    await supabase.from('patient_profiles').insert({ user_id: data.id });
  } else {
    await supabase.from('doctor_profiles').insert({ user_id: data.id });
  }

  return dbUserToUser(data as DbUser);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error || !data) return null;
  const profile = await getProfileForUser(data as DbUser);
  return dbUserToUser(data as DbUser, profile);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .ilike('username', username)
    .maybeSingle();

  if (error || !data) return null;
  const profile = await getProfileForUser(data as DbUser);
  return dbUserToUser(data as DbUser, profile);
}

export async function getUserByBlockchainAddress(address: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .ilike('blockchain_address', address)
    .maybeSingle();

  if (error || !data) return null;
  const profile = await getProfileForUser(data as DbUser);
  return dbUserToUser(data as DbUser, profile);
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  const profile = await getProfileForUser(data as DbUser);
  return dbUserToUser(data as DbUser, profile);
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error || !data) return null;
  // Direct comparison (in production use bcrypt)
  if ((data as DbUser).password_hash !== password) return null;
  const profile = await getProfileForUser(data as DbUser);
  return dbUserToUser(data as DbUser, profile);
}

// Verify a doctor's password without exposing the hash — safe for client-side MFA
export async function verifyDoctorPassword(userId: string, password: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_users')
    .select('password_hash')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { password_hash: string }).password_hash === password;
}

async function getProfileForUser(dbUser: DbUser): Promise<PatientProfile | DoctorProfile | undefined> {
  if (dbUser.role === 'patient') {
    const { data } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', dbUser.id)
      .maybeSingle();
    return data ? dbPatientProfileToProfile(data as DbPatientProfile) : undefined;
  } else {
    const { data } = await supabase
      .from('doctor_profiles')
      .select('*')
      .eq('user_id', dbUser.id)
      .maybeSingle();
    return data ? dbDoctorProfileToProfile(data as DbDoctorProfile) : undefined;
  }
}

export async function updateUserProfile(
  userId: string,
  role: 'patient' | 'doctor',
  profile: PatientProfile | DoctorProfile
): Promise<void> {
  if (role === 'patient') {
    const p = profile as PatientProfile;
    const { error: patientError } = await supabase
      .from('patient_profiles')
      .upsert({
        user_id: userId,
        full_name: p.fullName || null,
        date_of_birth: p.dateOfBirth || null,
        gender: p.gender || null,
        blood_type: p.bloodType || null,
        allergies: p.allergies || null,
        emergency_contact: p.emergencyContact || null,
        address: p.address || null,
        phone: p.phone || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (patientError) throw new Error(patientError.message);
  } else {
    const p = profile as DoctorProfile;
    // Step 1: Save all standard doctor profile fields (WITHOUT hospital_id so this always succeeds)
    const { error: profileError } = await supabase
      .from('doctor_profiles')
      .upsert({
        user_id: userId,
        full_name: p.fullName || null,
        specialization: p.specialization || null,
        qualification: p.qualification || null,
        experience: p.experience || null,
        availability: p.availability || null,
        phone: p.phone || null,
        license_number: p.licenseNumber || null,
        hospital_name: p.hospitalName || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (profileError) throw new Error(profileError.message);

    // Step 2: Save hospital_id separately via the admin API route
    // (handles the case where hospital_id column may not exist yet)
    if (p.hospitalId !== undefined) {
      const res = await fetch('/api/doctor/save-hospital-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, hospitalId: p.hospitalId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // columnMissing means the schema needs updating — provide clear guidance
        if (data.columnMissing) {
          throw new Error(
            'Hospital ID could not be saved: the "hospital_id" column is missing from doctor_profiles. ' +
            'Please run this SQL in your Supabase SQL Editor:\n' +
            'ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS hospital_id TEXT;'
          );
        }
        throw new Error(`Hospital ID save failed: ${data.error || res.statusText}`);
      }
    }
  }
}

export async function getAllDoctors(): Promise<User[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('role', 'doctor');

  if (error || !data) return [];

  const doctors: User[] = [];
  for (const d of data) {
    const profile = await getProfileForUser(d as DbUser);
    doctors.push(dbUserToUser(d as DbUser, profile));
  }
  return doctors;
}

export async function getAllPatients(): Promise<User[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('role', 'patient');

  if (error || !data) return [];

  const patients: User[] = [];
  for (const p of data) {
    const profile = await getProfileForUser(p as DbUser);
    patients.push(dbUserToUser(p as DbUser, profile));
  }
  return patients;
}

// ---- Current User Session (localStorage cache for quick access) ----

const CURRENT_USER_KEY = 'medichain_current_user';

export function setCurrentUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(CURRENT_USER_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function clearCurrentUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ---- Medical Records ----

export async function createMedicalRecord(record: Omit<MedicalRecord, 'id'>): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .insert({
      patient_id: record.patientId,
      file_name: record.fileName,
      file_hash: record.fileHash,
      file_url: record.fileUrl,
      file_type: record.fileType,
      description: record.description || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbRecordToRecord(data as DbMedicalRecord);
}

export async function getMedicalRecordsByPatient(patientId: string): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbRecordToRecord(r as DbMedicalRecord));
}

export async function deleteMedicalRecord(recordId: string): Promise<void> {
  await supabase.from('medical_records').delete().eq('id', recordId);
}

// ---- Appointments ----

export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: appointment.patientId,
      doctor_id: appointment.doctorId,
      patient_name: appointment.patientName,
      patient_blockchain_address: appointment.patientBlockchainAddress,
      doctor_name: appointment.doctorName,
      hospital_name: appointment.hospitalName || null,
      appointment_date: appointment.date,
      appointment_time: appointment.time,
      status: appointment.status || 'pending',
      reason: appointment.reason || null,
      notes: appointment.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbAppointmentToAppointment(data as DbAppointment);
}

export async function getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((a) => dbAppointmentToAppointment(a as DbAppointment));
}

export async function getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((a) => dbAppointmentToAppointment(a as DbAppointment));
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: Appointment['status'],
  txHash?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (txHash) update.blockchain_tx_hash = txHash;

  await supabase.from('appointments').update(update).eq('id', appointmentId);
}

// ---- Access Requests ----

export async function createAccessRequest(request: Omit<AccessRequest, 'id'>): Promise<AccessRequest> {
  const { data, error } = await supabase
    .from('access_requests')
    .insert({
      doctor_id: request.doctorId,
      patient_id: request.patientId,
      doctor_name: request.doctorName,
      patient_name: request.patientName,
      status: request.status || 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbAccessRequestToRequest(data as DbAccessRequest);
}

export async function getAccessRequestsByPatient(patientId: string): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .eq('patient_id', patientId)
    .order('requested_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbAccessRequestToRequest(r as DbAccessRequest));
}

export async function getAccessRequestsByDoctor(doctorId: string): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('requested_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbAccessRequestToRequest(r as DbAccessRequest));
}

export async function updateAccessRequestStatus(
  requestId: string,
  status: AccessRequest['status'],
  txHash?: string,
  expiresAt?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    responded_at: new Date().toISOString(),
  };
  if (txHash) update.blockchain_tx_hash = txHash;
  if (status === 'approved') {
    if (expiresAt) {
      update.expires_at = expiresAt;
    } else {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      update.expires_at = expiryDate.toISOString();
    }
  }

  await supabase.from('access_requests').update(update).eq('id', requestId);
}

export async function hasActiveAccess(doctorId: string, patientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('access_requests')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('patient_id', patientId)
    .eq('status', 'approved')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1);

  if (error || !data) return false;
  return data.length > 0;
}

// ---- Test Results ----

export async function createTestResult(result: Omit<TestResult, 'id'>): Promise<TestResult> {
  const { data, error } = await supabase
    .from('test_results')
    .insert({
      patient_id: result.patientId,
      doctor_id: result.doctorId,
      doctor_name: result.doctorName,
      file_name: result.fileName,
      file_url: result.fileUrl,
      file_type: result.fileType,
      description: result.description || null,
      test_type: result.testType || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbTestResultToResult(data as DbTestResult);
}

export async function getTestResultsByPatient(patientId: string): Promise<TestResult[]> {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbTestResultToResult(r as DbTestResult));
}

export async function getTestResultsByDoctor(doctorId: string): Promise<TestResult[]> {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbTestResultToResult(r as DbTestResult));
}

export async function deleteTestResult(resultId: string): Promise<void> {
  await supabase.from('test_results').delete().eq('id', resultId);
}

// ---- Emergency Access ----

export async function logEmergencyAccess(record: Omit<EmergencyAccessRecord, 'id'>): Promise<EmergencyAccessRecord> {
  const { data, error } = await supabase
    .from('emergency_access_logs')
    .insert({
      doctor_id: record.doctorId,
      patient_id: record.patientId,
      doctor_name: record.doctorName,
      patient_name: record.patientName,
      reason: record.reason,
      hospital_name: record.hospitalName || null,
      hospital_id: record.hospitalId || null,
      mfa_verified: record.mfaVerified ?? true,
      doctor_email: record.doctorEmail || null,
      verified_at: record.verifiedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbEmergencyLogToRecord(data as DbEmergencyAccessLog);
}

export async function getEmergencyAccessByPatient(patientId: string): Promise<EmergencyAccessRecord[]> {
  const { data, error } = await supabase
    .from('emergency_access_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('accessed_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => dbEmergencyLogToRecord(r as DbEmergencyAccessLog));
}

export async function revokeEmergencyAccess(logId: string): Promise<void> {
  const { error } = await supabase
    .from('emergency_access_logs')
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', logId);
  if (error) throw new Error(error.message);
}


// ---- Hospitals ----

export async function getHospitals(): Promise<DbHospital[]> {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error || !data) return [];
  return data as DbHospital[];
}
