// Simulated blockchain smart contract storage using localStorage

export interface User {
  id: string;
  email: string;
  username: string;
  password: string; // In production, this would be hashed
  role: 'patient' | 'doctor';
  blockchainAddress: string;
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
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  fileName: string;
  fileHash: string; // Simulated IPFS hash
  fileUrl: string; // Base64 or URL
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
}

// Storage keys
const STORAGE_KEYS = {
  USERS: 'blockchain_medical_users',
  MEDICAL_RECORDS: 'blockchain_medical_records',
  APPOINTMENTS: 'blockchain_appointments',
  ACCESS_REQUESTS: 'blockchain_access_requests',
  TEST_RESULTS: 'blockchain_test_results',
  EMERGENCY_ACCESS: 'blockchain_emergency_access',
  CURRENT_USER: 'blockchain_current_user',
};

// Helper to safely access localStorage
const getFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setToStorage = (key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// User Management
export const createUser = (user: User): void => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  users.push(user);
  setToStorage(STORAGE_KEYS.USERS, users);
};

export const getUserByEmail = (email: string): User | null => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
};

export const getUserByUsername = (username: string): User | null => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
};

export const getUserByBlockchainAddress = (address: string): User | null => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.find(u => u.blockchainAddress.toLowerCase() === address.toLowerCase()) || null;
};

export const getUserById = (id: string): User | null => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.find(u => u.id === id) || null;
};

export const updateUserProfile = (userId: string, profile: PatientProfile | DoctorProfile): void => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].profile = profile;
    setToStorage(STORAGE_KEYS.USERS, users);
  }
};

export const getAllDoctors = (): User[] => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.filter(u => u.role === 'doctor');
};

// Emergency Access
export const logEmergencyAccess = (record: EmergencyAccessRecord): void => {
  const records = getFromStorage<EmergencyAccessRecord[]>(STORAGE_KEYS.EMERGENCY_ACCESS, []);
  records.push(record);
  setToStorage(STORAGE_KEYS.EMERGENCY_ACCESS, records);
};

export const getEmergencyAccessByPatient = (patientId: string): EmergencyAccessRecord[] => {
  const records = getFromStorage<EmergencyAccessRecord[]>(STORAGE_KEYS.EMERGENCY_ACCESS, []);
  return records.filter(r => r.patientId === patientId).sort((a, b) => 
    new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
  );
};

export const getAllPatients = (): User[] => {
  const users = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
  return users.filter(u => u.role === 'patient');
};

// Current User Session
export const setCurrentUser = (user: User): void => {
  setToStorage(STORAGE_KEYS.CURRENT_USER, user);
};

export const getCurrentUser = (): User | null => {
  return getFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
};

export const clearCurrentUser = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

// Medical Records
export const createMedicalRecord = (record: MedicalRecord): void => {
  const records = getFromStorage<MedicalRecord[]>(STORAGE_KEYS.MEDICAL_RECORDS, []);
  records.push(record);
  setToStorage(STORAGE_KEYS.MEDICAL_RECORDS, records);
};

export const getMedicalRecordsByPatient = (patientId: string): MedicalRecord[] => {
  const records = getFromStorage<MedicalRecord[]>(STORAGE_KEYS.MEDICAL_RECORDS, []);
  return records.filter(r => r.patientId === patientId);
};

export const deleteMedicalRecord = (recordId: string): void => {
  const records = getFromStorage<MedicalRecord[]>(STORAGE_KEYS.MEDICAL_RECORDS, []);
  const filteredRecords = records.filter(r => r.id !== recordId);
  setToStorage(STORAGE_KEYS.MEDICAL_RECORDS, filteredRecords);
};

// Appointments
export const createAppointment = (appointment: Appointment): void => {
  const appointments = getFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  appointments.push(appointment);
  setToStorage(STORAGE_KEYS.APPOINTMENTS, appointments);
};

export const getAppointmentsByPatient = (patientId: string): Appointment[] => {
  const appointments = getFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  return appointments.filter(a => a.patientId === patientId).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getAppointmentsByDoctor = (doctorId: string): Appointment[] => {
  const appointments = getFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  return appointments.filter(a => a.doctorId === doctorId).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const updateAppointmentStatus = (
  appointmentId: string, 
  status: Appointment['status'],
  txHash?: string
): void => {
  const appointments = getFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  const index = appointments.findIndex(a => a.id === appointmentId);
  if (index !== -1) {
    appointments[index].status = status;
    if (txHash) {
      appointments[index].blockchainTxHash = txHash;
    }
    setToStorage(STORAGE_KEYS.APPOINTMENTS, appointments);
  }
};

// Access Requests
export const createAccessRequest = (request: AccessRequest): void => {
  const requests = getFromStorage<AccessRequest[]>(STORAGE_KEYS.ACCESS_REQUESTS, []);
  requests.push(request);
  setToStorage(STORAGE_KEYS.ACCESS_REQUESTS, requests);
};

export const getAccessRequestsByPatient = (patientId: string): AccessRequest[] => {
  const requests = getFromStorage<AccessRequest[]>(STORAGE_KEYS.ACCESS_REQUESTS, []);
  return requests.filter(r => r.patientId === patientId).sort((a, b) => 
    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
};

export const getAccessRequestsByDoctor = (doctorId: string): AccessRequest[] => {
  const requests = getFromStorage<AccessRequest[]>(STORAGE_KEYS.ACCESS_REQUESTS, []);
  return requests.filter(r => r.doctorId === doctorId);
};

export const updateAccessRequestStatus = (
  requestId: string,
  status: AccessRequest['status'],
  txHash?: string,
  expiresAt?: string
): void => {
  const requests = getFromStorage<AccessRequest[]>(STORAGE_KEYS.ACCESS_REQUESTS, []);
  const index = requests.findIndex(r => r.id === requestId);
  if (index !== -1) {
    requests[index].status = status;
    requests[index].respondedAt = new Date().toISOString();
    if (txHash) {
      requests[index].blockchainTxHash = txHash;
    }
    if (status === 'approved') {
      // Use provided expiration or default to 30 days
      if (expiresAt) {
        requests[index].expiresAt = expiresAt;
      } else {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        requests[index].expiresAt = expiryDate.toISOString();
      }
    }
    setToStorage(STORAGE_KEYS.ACCESS_REQUESTS, requests);
  }
};

export const hasActiveAccess = (doctorId: string, patientId: string): boolean => {
  const requests = getFromStorage<AccessRequest[]>(STORAGE_KEYS.ACCESS_REQUESTS, []);
  const approvedRequest = requests.find(
    r => r.doctorId === doctorId && 
         r.patientId === patientId && 
         r.status === 'approved' &&
         (!r.expiresAt || new Date(r.expiresAt) > new Date())
  );
  return !!approvedRequest;
};

// Test Results
export const createTestResult = (result: TestResult): void => {
  const results = getFromStorage<TestResult[]>(STORAGE_KEYS.TEST_RESULTS, []);
  results.push(result);
  setToStorage(STORAGE_KEYS.TEST_RESULTS, results);
};

export const getTestResultsByPatient = (patientId: string): TestResult[] => {
  const results = getFromStorage<TestResult[]>(STORAGE_KEYS.TEST_RESULTS, []);
  return results.filter(r => r.patientId === patientId).sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
};

export const getTestResultsByDoctor = (doctorId: string): TestResult[] => {
  const results = getFromStorage<TestResult[]>(STORAGE_KEYS.TEST_RESULTS, []);
  return results.filter(r => r.doctorId === doctorId).sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
};

export const deleteTestResult = (resultId: string): void => {
  const results = getFromStorage<TestResult[]>(STORAGE_KEYS.TEST_RESULTS, []);
  const filteredResults = results.filter(r => r.id !== resultId);
  setToStorage(STORAGE_KEYS.TEST_RESULTS, filteredResults);
};