'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  User,
  FileText,
  Calendar,
  Shield,
  Upload,
  LogOut,
  Moon,
  Sun,
  CheckCircle,
  XCircle,
  UserCheck,
  Download,
  Edit,
  Eye,
  Trash2,
  AlertTriangle,
  Building2,
  Timer,
  Lock
} from
  'lucide-react';
import {
  DoctorProfile,
  updateUserProfile,
  getAppointmentsByDoctor,
  Appointment,
  updateAppointmentStatus,
  createAccessRequest,
  AccessRequest,
  getAccessRequestsByDoctor,
  getUserById,
  getMedicalRecordsByPatient,
  MedicalRecord,
  hasActiveAccess,
  createTestResult,
  TestResult,
  setCurrentUser,
  getTestResultsByDoctor,
  deleteTestResult,
  logEmergencyAccess,
  getEmergencyAccessByPatient,
  EmergencyAccessRecord
} from
  '@/lib/supabase/storage';
import { BlockchainTransactionModal } from '@/components/BlockchainTransactionModal';
import { EmergencyMFAModal, MFAVerificationResult } from '@/components/EmergencyMFAModal';
import { toast } from 'sonner';

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState<DoctorProfile>(
    { ...(user?.profile || {}), hospitalId: (user?.profile as DoctorProfile)?.hospitalId || '' }
  );

  // Check if profile has been saved (has any data)
  const hasProfileData = () => {
    if (!user?.profile) return false;
    return Object.values(user.profile).some((value) => value && value.toString().trim() !== '');
  };

  const [isEditingProfile, setIsEditingProfile] = useState(!hasProfileData());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txAction, setTxAction] = useState<() => Promise<void>>(() => async () => { });
  const [txTitle, setTxTitle] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resultForm, setResultForm] = useState({
    patientId: '',
    description: '',
    testType: ''
  });
  const [uploadHistory, setUploadHistory] = useState<TestResult[]>([]);
  const [emergencyPatientId, setEmergencyPatientId] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const recordsRef = useRef<HTMLDivElement>(null);

  // Emergency MFA state
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [pendingEmergencyPatient, setPendingEmergencyPatient] = useState<{ id: string; name: string } | null>(null);
  // 10-minute access countdown timer
  const [emergencyAccessTimer, setEmergencyAccessTimer] = useState<number>(0);
  const emergencyTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track the log ID and patient name for real-time revoke detection
  const [activeEmergencyLogId, setActiveEmergencyLogId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const revokePollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'doctor') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router]);

  // Sync profileData with user.profile when user changes
  useEffect(() => {
    if (user?.profile) {
      // hospitalId is stored as text in doctor_profiles.hospital_id
      setProfileData({
        ...user.profile,
        hospitalId: (user.profile as DoctorProfile).hospitalId || '',
      });
      // Update editing state based on whether profile has data
      const hasData = Object.values(user.profile).some((value) => value && value.toString().trim() !== '');
      if (!hasData) {
        setIsEditingProfile(true);
      }
    }
  }, [user]);

  // Real-time revoke check: poll every 10s while emergency access is active
  useEffect(() => {
    if (!activeEmergencyLogId || !selectedPatientId) return;
    if (revokePollingRef.current) clearInterval(revokePollingRef.current);

    const poll = async () => {
      const logs = await getEmergencyAccessByPatient(selectedPatientId);
      const thisLog = logs.find(l => l.id === activeEmergencyLogId);
      if (thisLog?.isRevoked) {
        // Patient revoked access — clear records immediately
        setPatientRecords([]);
        setSelectedPatientId('');
        setSelectedPatientName('');
        setActiveEmergencyLogId(null);
        setEmergencyAccessTimer(0);
        if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
        if (revokePollingRef.current) clearInterval(revokePollingRef.current);
        toast.error('⛔ Emergency access has been revoked by the patient. Records hidden.');
      }
    };

    revokePollingRef.current = setInterval(poll, 10000); // check every 10 seconds
    return () => { if (revokePollingRef.current) clearInterval(revokePollingRef.current); };
  }, [activeEmergencyLogId, selectedPatientId]);

  const loadData = async () => {
    if (!user) return;
    const [appts, requests, history] = await Promise.all([
      getAppointmentsByDoctor(user.id),
      getAccessRequestsByDoctor(user.id),
      getTestResultsByDoctor(user.id),
    ]);
    setAppointments(appts);
    setAccessRequests(requests);
    setUploadHistory(history);
  };

  // Initiate emergency access — show MFA modal first
  const handleEmergencyAccess = (patientId: string, patientName: string) => {
    if (!user || !emergencyReason) {
      toast.error('Please provide a reason for emergency access');
      return;
    }
    // Store pending patient and show MFA modal
    setPendingEmergencyPatient({ id: patientId, name: patientName });
    setShowMFAModal(true);
  };

  // Called after all 3 MFA steps are verified
  const handleMFAVerified = async (result: MFAVerificationResult) => {
    setShowMFAModal(false);
    if (!user || !pendingEmergencyPatient) return;
    const { id: patientId, name: patientName } = pendingEmergencyPatient;

    const doctorProfile = user.profile as DoctorProfile | undefined;

    setTxTitle('Emergency Access Break-Glass');
    setTxDescription(`CRITICAL: Accessing ${patientName}'s records via MFA-verified emergency override. Permanently logged.`);
    setTxAction(() => async () => {
      const log = await logEmergencyAccess({
        doctorId: user.id,
        patientId,
        doctorName: doctorProfile?.fullName || user.username,
        patientName,
        accessedAt: new Date().toISOString(),
        reason: emergencyReason,
        hospitalName: result.hospitalName || doctorProfile?.hospitalName || '',
        hospitalId: doctorProfile?.hospitalId || '',
        doctorEmail: result.doctorEmail || user.email || '',
        verifiedAt: result.verifiedAt || new Date().toISOString(),
        mfaVerified: true,
      });

      // Load records
      const records = await getMedicalRecordsByPatient(patientId);
      setPatientRecords(records);
      setSelectedPatientId(patientId);
      setSelectedPatientName(patientName);
      setActiveEmergencyLogId(log.id); // enables real-time revoke polling
      setEmergencyReason('');
      setPendingEmergencyPatient(null);

      // Start 10-minute countdown
      startEmergencyTimer();

      toast.warning(`EMERGENCY ACCESS LOGGED (MFA Verified). Viewing records for ${patientName}. Access expires in 10 minutes.`);
      setActiveTab('access');
      setTimeout(() => {
        recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
    setShowTxModal(true);
  };

  const startEmergencyTimer = () => {
    if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
    setEmergencyAccessTimer(600); // 10 minutes in seconds
    const interval = setInterval(() => {
      setEmergencyAccessTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Clear patient records when timer expires
          setPatientRecords([]);
          setSelectedPatientId('');
          setSelectedPatientName('');
          setActiveEmergencyLogId(null);
          if (revokePollingRef.current) clearInterval(revokePollingRef.current);
          toast.info('Emergency access window expired. Patient records have been hidden.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    emergencyTimerRef.current = interval;
  };


  const handleProfileUpdate = async () => {
    if (!user) return;

    try {
      await updateUserProfile(user.id, 'doctor', profileData);

      const updatedUser = await getUserById(user.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
        await refreshUser();
      }
      setIsEditingProfile(false);
      toast.success('Profile updated successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Save failed: ${message}`);
      console.error('[Profile Save Error]', err);
    }
  };

  const handleCancelEdit = () => {
    // Only allow cancel if profile has been saved before
    if (hasProfileData()) {
      // Restore profileData including hospitalId, mirroring the sync useEffect
      setProfileData({
        ...(user?.profile || {}),
        hospitalId: (user?.profile as DoctorProfile)?.hospitalId || '',
      });
      setIsEditingProfile(false);
    }
  };

  const handleAppointmentAction = (appointmentId: string, status: Appointment['status']) => {
    const actionText = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Complete';
    setTxTitle(`${actionText} Appointment`);
    setTxDescription(`Confirm to ${actionText.toLowerCase()} this appointment on blockchain`);
    setTxAction(() => async () => {
      await updateAppointmentStatus(appointmentId, status);
      await loadData();
      toast.success(`Appointment ${actionText.toLowerCase()}ed successfully!`);
    });
    setShowTxModal(true);
  };

  const handleRequestAccess = (patientId: string, patientName: string) => {
    if (!user) return;

    setTxTitle('Request Patient Access');
    setTxDescription(`Request access to ${patientName}'s medical records on blockchain`);
    setTxAction(() => async () => {
      // Check if already has active access
      const active = await hasActiveAccess(user.id, patientId);
      if (active) {
        toast.error('You already have active access to this patient\'s records');
        return;
      }

      // Check if pending request exists
      const pending = accessRequests.find(
        (r) => r.patientId === patientId && r.status === 'pending'
      );
      if (pending) {
        toast.error('Access request already pending for this patient');
        return;
      }

      await createAccessRequest({
        doctorId: user.id,
        patientId,
        doctorName: user.username,
        patientName,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      await loadData();
      toast.success(`Access request sent to ${patientName} successfully!`);
    });
    setShowTxModal(true);
  };

  const viewPatientRecords = async (patientId: string) => {
    if (!user) return;

    const active = await hasActiveAccess(user.id, patientId);
    if (!active) {
      toast.error('You need approved access to view patient records');
      return;
    }

    setIsLoadingRecords(true);

    const records = await getMedicalRecordsByPatient(patientId);
    setPatientRecords(records);
    setSelectedPatientId(patientId);
    setIsLoadingRecords(false);

    if (records.length === 0) {
      toast.info('No medical records found for this patient');
    } else {
      toast.success(`Loaded ${records.length} medical record(s)`);
      setTimeout(() => {
        recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadTestResult = async () => {
    if (!user || !selectedFile || !resultForm.patientId) {
      toast.error('Please fill all fields and select a file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const patient = await getUserById(resultForm.patientId);
        if (!patient) {
          toast.error('Patient not found. Please try again.');
          return;
        }

        await createTestResult({
          patientId: resultForm.patientId,
          doctorId: user.id,
          doctorName: user.username,
          fileName: selectedFile.name,
          fileUrl: reader.result as string,
          fileType: selectedFile.type,
          uploadedAt: new Date().toISOString(),
          description: resultForm.description,
          testType: resultForm.testType
        });

        setSelectedFile(null);
        setResultForm({ patientId: '', description: '', testType: '' });
        await loadData();
        toast.success('Test result uploaded successfully!');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload test result. Please try again.');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleRemoveResult = (resultId: string, fileName: string) => {
    setTxTitle('Remove Test Result');
    setTxDescription(`Confirm to remove "${fileName}" from blockchain storage`);
    setTxAction(() => async () => {
      await deleteTestResult(resultId);
      await loadData();
      toast.success('Test result removed successfully!');
    });
    setShowTxModal(true);
  };

  if (!user) return null;

  // Get unique patients from appointments
  const patients = Array.from(new Set(appointments.map((a) => a.patientId))).
    map((id) => {
      const appointment = appointments.find((a) => a.patientId === id);
      return appointment ? { id, name: appointment.patientName } : null;
    }).
    filter(Boolean) as { id: string; name: string; }[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50 animate-in fade-in slide-in-from-top duration-500">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MediChain</h1>
              <p className="text-xs text-muted-foreground">Doctor Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">Dr. {user.username}</p>
              <p className="text-xs text-muted-foreground">
                {user.blockchainAddress.slice(0, 6)}...{user.blockchainAddress.slice(-4)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="transition-transform hover:scale-110">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={handleLogout} className="transition-transform hover:scale-105">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 gap-2 h-auto bg-card/50 backdrop-blur-sm p-2">
            <TabsTrigger value="profile" className="gap-2 transition-all hover:scale-105">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2 transition-all hover:scale-105">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Appointments</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2 transition-all hover:scale-105">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Patient Access</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2 transition-all hover:scale-105">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload Results</span>
            </TabsTrigger>
            <TabsTrigger value="emergency" className="gap-2 transition-all hover:scale-105 text-destructive hover:text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Emergency</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
                <CardDescription>Manage your professional profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={profileData.fullName || ''}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      placeholder="Dr. Full Name"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Specialization</Label>
                    <Input
                      value={profileData.specialization || ''}
                      onChange={(e) => setProfileData({ ...profileData, specialization: e.target.value })}
                      placeholder="e.g., Cardiology, Neurology"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Qualification</Label>
                    <Input
                      value={profileData.qualification || ''}
                      onChange={(e) => setProfileData({ ...profileData, qualification: e.target.value })}
                      placeholder="e.g., MBBS, MD"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>License Number</Label>
                    <Input
                      value={profileData.licenseNumber || ''}
                      onChange={(e) => setProfileData({ ...profileData, licenseNumber: e.target.value })}
                      placeholder="Medical license number"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Experience (years)</Label>
                    <Input
                      value={profileData.experience || ''}
                      onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                      placeholder="Years of experience"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={profileData.phone || ''}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="Contact number"
                      disabled={!isEditingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hospital Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={profileData.hospitalName || ''}
                        onChange={(e) => setProfileData({ ...profileData, hospitalName: e.target.value })}
                        placeholder="Enter hospital name"
                        disabled={!isEditingProfile}
                        className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5 text-destructive" />
                      Hospital ID <Badge variant="destructive" className="text-[9px] ml-1">Required for Emergency MFA</Badge>
                    </Label>
                    <Input
                      value={profileData.hospitalId || ''}
                      onChange={(e) => setProfileData({ ...profileData, hospitalId: e.target.value })}
                      placeholder="e.g. HOSP-2024-001 (used for emergency MFA)"
                      disabled={!isEditingProfile}
                    />
                    {isEditingProfile && (
                      <p className="text-[10px] text-muted-foreground">This ID is required to verify your identity during emergency access attempts.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Availability</Label>
                  <Textarea
                    value={profileData.availability || ''}
                    onChange={(e) => setProfileData({ ...profileData, availability: e.target.value })}
                    placeholder="e.g., Mon-Fri: 9AM-5PM, Sat: 10AM-2PM"
                    rows={3}
                    disabled={!isEditingProfile} />
                </div>
                <div className="flex gap-2">
                  {!isEditingProfile ?
                    <Button onClick={() => setIsEditingProfile(true)} className="w-full sm:w-auto">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button> :
                    <>
                      <Button onClick={handleProfileUpdate} className="w-full sm:w-auto">
                        Save Profile
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Appointment Management</CardTitle>
                <CardDescription>{appointments.length} total appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ?
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No appointments scheduled</p>
                  </div> :
                  <div className="space-y-3">
                    {appointments.map((appointment) =>
                      <div
                        key={appointment.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{appointment.patientName}</h4>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {appointment.patientBlockchainAddress.slice(0, 6)}...{appointment.patientBlockchainAddress.slice(-4)}
                              </Badge>
                              <Badge
                                variant={
                                  appointment.status === 'approved' ? 'default' :
                                    appointment.status === 'pending' ? 'secondary' :
                                      appointment.status === 'cancelled' ? 'destructive' :
                                        'outline'
                                }>
                                {appointment.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
                            </p>
                            {appointment.hospitalName && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Building2 className="h-3 w-3" />
                                {appointment.hospitalName}
                              </p>
                            )}
                            <p className="text-sm mt-2">{appointment.reason}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {appointment.status === 'pending' &&
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAppointmentAction(appointment.id, 'approved')}
                                  className="transition-transform hover:scale-105">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAppointmentAction(appointment.id, 'rejected')}
                                  className="transition-transform hover:scale-105">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            }
                            {appointment.status === 'approved' &&
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAppointmentAction(appointment.id, 'completed')}
                                className="transition-transform hover:scale-105">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            }
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patient Access Tab */}
          <TabsContent value="access" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Request Patient Records Access</CardTitle>
                <CardDescription>Request access to view patient medical records</CardDescription>
              </CardHeader>
              <CardContent>
                {patients.length === 0 ?
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No patients found. Appointments will appear here.</p>
                  </div> :
                  <div className="space-y-3">
                    {patients.map((patient) =>
                      <div
                        key={patient.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div>
                          <h4 className="font-medium">{patient.name}</h4>
                          <p className="text-sm text-muted-foreground">Patient ID: {patient.id.slice(0, 8)}...</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRequestAccess(patient.id, patient.name)}
                            className="transition-transform hover:scale-105">
                            Request Access
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewPatientRecords(patient.id)}
                            disabled={isLoadingRecords}
                            className="transition-transform hover:scale-105">
                            {isLoadingRecords ? (
                              <>
                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                View Records
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                }
              </CardContent>
            </Card>

            {patientRecords.length > 0 && selectedPatientId &&
              <Card ref={recordsRef} className="border-border/50 bg-card/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Patient Medical Records
                        {selectedPatientName && (
                          <span className="text-sm font-normal bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-0.5">
                            👤 {selectedPatientName}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{patientRecords.length} records available · Emergency Access Active</CardDescription>
                    </div>
                    {emergencyAccessTimer > 0 && (
                      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                        <Timer className="h-4 w-4 text-destructive animate-pulse" />
                        <div className="text-right">
                          <p className="text-[10px] text-destructive font-medium">Emergency Access</p>
                          <p className="font-mono text-sm font-bold text-destructive">
                            {Math.floor(emergencyAccessTimer / 60).toString().padStart(2, '0')}:{(emergencyAccessTimer % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {emergencyAccessTimer > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-xs text-amber-700 dark:text-amber-400">
                      ⚠️ Emergency access auto-expires when timer reaches 00:00. Patient details will be hidden.
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patientRecords.map((record) =>
                      <div
                        key={record.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{record.fileName}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="transition-transform hover:scale-110">
                              <a href={record.fileUrl} download={record.fileName}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            }

            <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Access Request History</CardTitle>
                <CardDescription>{accessRequests.length} total requests</CardDescription>
              </CardHeader>
              <CardContent>
                {accessRequests.length === 0 ?
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No access requests sent</p>
                  </div> :
                  <div className="space-y-3">
                    {accessRequests.map((request) =>
                      <div
                        key={request.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{request.patientName}</h4>
                            <p className="text-sm text-muted-foreground">
                              Requested: {new Date(request.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              request.status === 'approved' ? 'default' :
                                request.status === 'rejected' ? 'destructive' :
                                  'secondary'
                            }>
                            {request.status}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Results Tab */}
          <TabsContent value="upload" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Upload Test Results / Prescriptions</CardTitle>
                <CardDescription>Share test results or prescriptions with patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Patient</Label>
                  <Select
                    value={resultForm.patientId}
                    onValueChange={(value) => setResultForm({ ...resultForm, patientId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) =>
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Test Type</Label>
                  <Input
                    value={resultForm.testType}
                    onChange={(e) => setResultForm({ ...resultForm, testType: e.target.value })}
                    placeholder="e.g., Blood Test, X-Ray, MRI" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={resultForm.description}
                    onChange={(e) => setResultForm({ ...resultForm, description: e.target.value })}
                    placeholder="Additional notes or findings"
                    rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Select File</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png" />
                  {selectedFile &&
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                  }
                </div>
                <Button
                  onClick={uploadTestResult}
                  disabled={!selectedFile || !resultForm.patientId}
                  className="w-full transition-transform hover:scale-105">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Result
                </Button>
              </CardContent>
            </Card>

            {/* Upload History */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>{uploadHistory.length} files uploaded</CardDescription>
              </CardHeader>
              <CardContent>
                {uploadHistory.length === 0 ?
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No files uploaded yet</p>
                  </div> :
                  <div className="space-y-3">
                    {uploadHistory.map((result) => (
                      <div
                        key={result.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{result.fileName}</h4>
                              {result.testType &&
                                <Badge variant="secondary">{result.testType}</Badge>
                              }
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Patient ID: {result.patientId.slice(0, 8)}...
                            </p>
                            {result.description &&
                              <p className="text-sm mt-1">{result.description}</p>
                            }
                            <p className="text-xs text-muted-foreground mt-2">
                              Uploaded: {new Date(result.uploadedAt).toLocaleDateString()} at{' '}
                              {new Date(result.uploadedAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="transition-transform hover:scale-110">
                              <a href={result.fileUrl} download={result.fileName}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveResult(result.id, result.fileName)}
                              className="transition-transform hover:scale-110 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emergency Tab */}
          <TabsContent value="emergency" className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-destructive/20 bg-destructive/5 backdrop-blur-xl border-2">
              <CardHeader>
                <div className="flex items-center gap-3 text-destructive">
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                  <CardTitle>Emergency Access (Break-Glass)</CardTitle>
                </div>
                <CardDescription>
                  CRITICAL: Use this only in life-threatening emergencies where patient consent cannot be obtained.
                  You can only access records of patients who have previously booked an appointment with you.
                  All actions are permanently logged on the blockchain and the patient will be notified.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 text-sm">
                  <p className="font-bold mb-1">Legal Notice:</p>
                  <p>Unauthorized use of emergency access is a violation of HIPAA and medical ethics. Your identity, timestamp, and reason for access will be recorded.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Patient in Emergency</Label>
                    <Select
                      value={emergencyPatientId}
                      onValueChange={setEmergencyPatientId}>
                      <SelectTrigger className="border-destructive/30 focus:ring-destructive">
                        <SelectValue placeholder="Search patient by name or ID" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.length === 0 ? (
                          <SelectItem value="__none" disabled>No patients with prior appointments</SelectItem>
                        ) : (
                          patients.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Emergency Justification</Label>
                    <Textarea
                      value={emergencyReason}
                      onChange={(e) => setEmergencyReason(e.target.value)}
                      placeholder="State the clinical emergency requiring immediate access..."
                      className="border-destructive/30 focus:ring-destructive"
                      rows={3}
                    />
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full gap-2 h-12 text-lg font-bold"
                    disabled={!emergencyPatientId || !emergencyReason}
                    onClick={() => {
                      const patient = patients.find(p => p.id === emergencyPatientId);
                      if (patient) handleEmergencyAccess(patient.id, patient.name);
                    }}
                  >
                    <Shield className="h-5 w-5" />
                    AUTHORIZE EMERGENCY OVERRIDE
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BlockchainTransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        onConfirm={txAction}
        onSuccess={loadData}
        title={txTitle}
        description={txDescription} />

      {/* Emergency MFA Modal */}
      <EmergencyMFAModal
        isOpen={showMFAModal}
        onClose={() => { setShowMFAModal(false); setPendingEmergencyPatient(null); }}
        onVerified={handleMFAVerified}
        doctorId={user?.id || ''}
        doctorHospitalId={profileData.hospitalId || (user?.profile as DoctorProfile)?.hospitalId || ''}
        doctorHospitalName={(user?.profile as DoctorProfile)?.hospitalName || ''}
        doctorEmail={user?.email || ''}
      />
    </div>);
}
