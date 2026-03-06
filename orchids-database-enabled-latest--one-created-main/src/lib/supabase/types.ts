export interface DbUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: 'patient' | 'doctor';
  blockchain_address: string;
  hospital_id: string | null;
  created_at: string;
}

export interface DbPatientProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  address: string | null;
  phone: string | null;
  updated_at: string;
}

export interface DbDoctorProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  specialization: string | null;
  qualification: string | null;
  experience: string | null;
  availability: string | null;
  phone: string | null;
  license_number: string | null;
  hospital_name: string | null;
  hospital_id: string | null;
  updated_at: string;
}

export interface DbMedicalRecord {
  id: string;
  patient_id: string;
  file_name: string;
  file_hash: string;
  file_url: string;
  file_type: string;
  description: string | null;
  uploaded_at: string;
}

export interface DbAppointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  patient_blockchain_address: string;
  doctor_name: string;
  hospital_name: string | null;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  reason: string | null;
  notes: string | null;
  blockchain_tx_hash: string | null;
  created_at: string;
}

export interface DbAccessRequest {
  id: string;
  doctor_id: string;
  patient_id: string;
  doctor_name: string;
  patient_name: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  responded_at: string | null;
  blockchain_tx_hash: string | null;
  expires_at: string | null;
}

export interface DbTestResult {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  file_name: string;
  file_url: string;
  file_type: string;
  description: string | null;
  test_type: string | null;
  uploaded_at: string;
}

export interface DbEmergencyAccessLog {
  id: string;
  doctor_id: string;
  patient_id: string;
  doctor_name: string;
  patient_name: string;
  accessed_at: string;
  reason: string;
  hospital_name: string | null;
  hospital_id: string | null;
  mfa_verified: boolean | null;
  doctor_email: string | null;
  verified_at: string | null;
  is_revoked: boolean | null;
  revoked_at: string | null;
}

export interface DbHospital {
  id: string;
  name: string;
  subdomain: string;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  created_at: string;
  is_active: boolean;
}
