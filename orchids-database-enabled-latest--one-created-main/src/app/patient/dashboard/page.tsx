'use client';

import { useEffect, useState } from 'react';
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
  Download,
  UserCheck,
  Trash2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import {
  PatientProfile,
  updateUserProfile,
  createMedicalRecord,
  getMedicalRecordsByPatient,
  MedicalRecord,
  createAppointment,
  getAppointmentsByPatient,
  Appointment,
  updateAppointmentStatus,
  getAccessRequestsByPatient,
  AccessRequest,
  updateAccessRequestStatus,
  getAllDoctors,
  User as StorageUser,
  getTestResultsByPatient,
  TestResult,
  setCurrentUser,
  getUserById,
  getEmergencyAccessByPatient,
  EmergencyAccessRecord,
  deleteMedicalRecord,
  revokeEmergencyAccess,
} from '@/lib/supabase/storage';
import { BlockchainTransactionModal } from '@/components/BlockchainTransactionModal';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState<PatientProfile>(user?.profile || {});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [emergencyLogs, setEmergencyLogs] = useState<EmergencyAccessRecord[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [doctors, setDoctors] = useState<StorageUser[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txAction, setTxAction] = useState<() => Promise<void>>(() => async () => { });
  const [txTitle, setTxTitle] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [appointmentForm, setAppointmentForm] = useState({
    doctorId: '',
    date: '',
    time: '',
    reason: ''
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [accessDuration, setAccessDuration] = useState<string>('60');
  const [customMinutes, setCustomMinutes] = useState<string>('');

  // Check if profile has any data
  const hasProfileData = () => {
    return Boolean(
      profileData.fullName ||
      profileData.dateOfBirth ||
      profileData.gender ||
      profileData.bloodType ||
      profileData.phone ||
      profileData.emergencyContact ||
      profileData.address ||
      profileData.allergies
    );
  };

  useEffect(() => {
    if (!user || user.role !== 'patient') {
      router.push('/login');
      return;
    }
    loadData();

    // If no profile data exists, start in edit mode
    if (!hasProfileData()) {
      setIsEditingProfile(true);
    }

    // Trigger entrance animation
    setTimeout(() => setIsLoaded(true), 50);
  }, [user, router]);

  // Sync profileData with user changes
  useEffect(() => {
    if (user?.profile) {
      setProfileData(user.profile as PatientProfile);
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    const [records, appts, requests, eLogs, results, docs] = await Promise.all([
      getMedicalRecordsByPatient(user.id),
      getAppointmentsByPatient(user.id),
      getAccessRequestsByPatient(user.id),
      getEmergencyAccessByPatient(user.id),
      getTestResultsByPatient(user.id),
      getAllDoctors(),
    ]);
    setMedicalRecords(records);
    setAppointments(appts);
    setAccessRequests(requests);
    setEmergencyLogs(eLogs);
    setTestResults(results);
    setDoctors(docs);
  };

  const handleProfileUpdate = async () => {
    if (!user) return;

    try {
      await updateUserProfile(user.id, 'patient', profileData);
      const updatedUser = await getUserById(user.id);

      if (updatedUser) {
        setCurrentUser(updatedUser);
        await refreshUser();
      }

      setIsEditingProfile(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadMedicalRecord = async () => {
    if (!user || !selectedFile) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const fileUrl = reader.result as string;
        const record = await createMedicalRecord({
          patientId: user.id,
          fileName: selectedFile.name,
          fileHash: 'ipfs://' + Math.random().toString(36).substring(2, 15),
          fileUrl,
          uploadedAt: new Date().toISOString(),
          description: fileDescription,
          fileType: selectedFile.type
        });

        setMedicalRecords((prev) => [record, ...prev]);
        setSelectedFile(null);
        setFileDescription('');
        toast.success('Medical record uploaded successfully!');
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleBookAppointment = () => {
    if (!user || !appointmentForm.doctorId || !appointmentForm.date || !appointmentForm.time) {
      toast.error('Please fill all fields');
      return;
    }

    const doctor = doctors.find(d => d.id === appointmentForm.doctorId);
    if (!doctor) return;

    setTxTitle('Book Appointment');
    setTxDescription('Confirm appointment booking on blockchain');
    setTxAction(() => async () => {
      await createAppointment({
        patientId: user.id,
        doctorId: appointmentForm.doctorId,
        patientName: user.username,
        patientBlockchainAddress: user.blockchainAddress,
        doctorName: doctor.username,
        hospitalName: (doctor.profile as any)?.hospitalName || '',
        date: appointmentForm.date,
        time: appointmentForm.time,
        status: 'pending',
        reason: appointmentForm.reason,
        createdAt: new Date().toISOString()
      });
      setAppointmentForm({ doctorId: '', date: '', time: '', reason: '' });
      await loadData(); // re-fetch so the new appointment shows immediately
      toast.success('Appointment booked successfully!');
    });
    setShowTxModal(true);
  };

  const handleCancelAppointment = (appointmentId: string) => {
    setTxTitle('Cancel Appointment');
    setTxDescription('Confirm appointment cancellation on blockchain');
    setTxAction(() => async () => {
      await updateAppointmentStatus(appointmentId, 'cancelled');
      await loadData();
    });
    setShowTxModal(true);
  };

  const handleAccessResponse = (requestId: string, approved: boolean) => {
    if (approved) {
      // Show dialog to select time limit
      setSelectedRequestId(requestId);
      setShowAccessDialog(true);
    } else {
      // Reject immediately
      setTxTitle('Reject Access');
      setTxDescription('Confirm to deny doctor access to your medical records');
      setTxAction(() => async () => {
        await updateAccessRequestStatus(requestId, 'rejected');
        await loadData();
      });
      setShowTxModal(true);
    }
  };

  const handleApproveWithDuration = () => {
    let minutes = 0;

    if (accessDuration === 'custom') {
      minutes = parseInt(customMinutes);
      if (!minutes || minutes <= 0) {
        toast.error('Please enter a valid number of minutes');
        return;
      }
    } else {
      minutes = parseInt(accessDuration);
    }

    setShowAccessDialog(false);

    // Convert minutes to readable format for display
    let displayDuration = '';
    if (minutes < 60) {
      displayDuration = `${minutes} minute(s)`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      displayDuration = `${hours} hour(s)`;
    } else {
      const days = Math.floor(minutes / 1440);
      displayDuration = `${days} day(s)`;
    }

    setTxTitle('Approve Access');
    setTxDescription(`Grant doctor access to your medical records for ${displayDuration}`);
    setTxAction(() => async () => {
      // Calculate expiration date
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + minutes);

      await updateAccessRequestStatus(selectedRequestId, 'approved', undefined, expiryDate.toISOString());
      await loadData();

      // Reset dialog state
      setAccessDuration('60');
      setCustomMinutes('');
    });
    setShowTxModal(true);
  };

  const handleRemoveMedicalRecord = (recordId: string, fileName: string) => {
    setTxTitle('Remove Medical Record');
    setTxDescription(`Confirm to remove '${fileName}' from blockchain storage`);
    setTxAction(() => async () => {
      await deleteMedicalRecord(recordId);
      await loadData();
      toast.success('Medical record removed successfully!');
    });
    setShowTxModal(true);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  if (!user) return null;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5"
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out'
      }}
    >
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center transition-transform hover:scale-110 duration-300">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MediChain</h1>
              <p className="text-xs text-muted-foreground">Patient Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {user.blockchainAddress.slice(0, 6)}...{user.blockchainAddress.slice(-4)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="transition-transform hover:scale-110 duration-200">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={handleLogout} className="transition-all hover:scale-105 duration-200">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6" style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateX(0)' : 'translateX(-20px)',
          transition: 'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s'
        }}>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Manage your medical information</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 gap-2 h-auto bg-card/50 backdrop-blur-sm p-2">
            <TabsTrigger value="profile" className="gap-2 transition-all duration-200 hover:scale-105">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="records" className="gap-2 transition-all duration-200 hover:scale-105">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Records</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2 transition-all duration-200 hover:scale-105">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Appointments</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2 transition-all duration-200 hover:scale-105">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Access</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2 transition-all duration-200 hover:scale-105">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 transition-all duration-200 hover:scale-105 text-destructive">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Manage your profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={profileData.fullName || ''}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={profileData.dateOfBirth || ''}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={profileData.gender || ''}
                      onValueChange={(value) => setProfileData({ ...profileData, gender: value })}
                      disabled={!isEditingProfile}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Blood Type</Label>
                    <Select
                      value={profileData.bloodType || ''}
                      onValueChange={(value) => setProfileData({ ...profileData, bloodType: value })}
                      disabled={!isEditingProfile}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={profileData.phone || ''}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="Enter phone number"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Emergency Contact</Label>
                    <Input
                      value={profileData.emergencyContact || ''}
                      onChange={(e) => setProfileData({ ...profileData, emergencyContact: e.target.value })}
                      placeholder="Emergency contact number"
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={profileData.address || ''}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder="Enter your address"
                    rows={3}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <Textarea
                    value={profileData.allergies || ''}
                    onChange={(e) => setProfileData({ ...profileData, allergies: e.target.value })}
                    placeholder="List any known allergies"
                    rows={3}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="flex gap-2">
                  {!isEditingProfile ? (
                    <Button onClick={() => setIsEditingProfile(true)} className="w-full sm:w-auto">
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleProfileUpdate} className="w-full sm:w-auto">
                        Save Profile
                      </Button>
                      <Button onClick={() => setIsEditingProfile(false)} variant="outline" className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medical Records Tab */}
          <TabsContent value="records">
            <div className="space-y-6">
              <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Upload Medical Record</CardTitle>
                  <CardDescription>Store your medical records securely on blockchain</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Brief description of the record"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Select File (PDF, Image, etc.)</Label>
                    <Input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                  </div>
                  <Button
                    onClick={uploadMedicalRecord}
                    disabled={!selectedFile || isUploading}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload Documents'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>My Medical Records</CardTitle>
                  <CardDescription>{medicalRecords.length} records stored</CardDescription>
                </CardHeader>
                <CardContent>
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No medical records uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {medicalRecords.map((record) => (
                        <div
                          key={record.id}
                          className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{record.fileName}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-1">
                                Hash: {record.fileHash}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <a href={record.fileUrl} download={record.fileName}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveMedicalRecord(record.id, record.fileName)}
                                className="transition-transform hover:scale-105 duration-200"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments">
            <div className="space-y-6">
              <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Book Appointment</CardTitle>
                  <CardDescription>Schedule an appointment with a doctor</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Doctor</Label>
                    <Select
                      value={appointmentForm.doctorId}
                      onValueChange={(value) => setAppointmentForm({ ...appointmentForm, doctorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            Dr. {doctor.username} - {(doctor.profile as any)?.specialization || 'General'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={appointmentForm.date}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={appointmentForm.time}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason for Visit</Label>
                    <Textarea
                      value={appointmentForm.reason}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                      placeholder="Describe your symptoms or reason for visit"
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleBookAppointment} className="w-full">
                    Book Appointment
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>My Appointments</CardTitle>
                  <CardDescription>{appointments.length} total appointments</CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No appointments scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {appointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="p-4 rounded-lg border border-border/50 bg-muted/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">Dr. {appointment.doctorName}</h4>
                                <Badge
                                  variant={
                                    appointment.status === 'approved' ? 'default' :
                                      appointment.status === 'pending' ? 'secondary' :
                                        appointment.status === 'cancelled' ? 'destructive' :
                                          'outline'
                                  }
                                >
                                  {appointment.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
                              </p>
                              {appointment.hospitalName && (
                                <p className="text-xs flex items-center gap-1 mt-1">
                                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
                                    {appointment.hospitalName}
                                  </span>
                                </p>
                              )}
                              <p className="text-sm mt-2">{appointment.reason}</p>
                            </div>
                            {appointment.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelAppointment(appointment.id)}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Access Requests Tab */}
          <TabsContent value="access">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Medical Record Access Requests</CardTitle>
                <CardDescription>
                  {accessRequests.filter(r => r.status === 'pending').length} pending requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accessRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No access requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {accessRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">Dr. {request.doctorName}</h4>
                              <Badge
                                variant={
                                  request.status === 'approved' ? 'default' :
                                    request.status === 'rejected' ? 'destructive' :
                                      'secondary'
                                }
                              >
                                {request.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Requested: {new Date(request.requestedAt).toLocaleDateString()}
                            </p>
                            {request.status === 'approved' && request.expiresAt && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Access expires: {new Date(request.expiresAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAccessResponse(request.id, true)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAccessResponse(request.id, false)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Results Tab */}
          <TabsContent value="results">
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Test Results & Prescriptions</CardTitle>
                <CardDescription>{testResults.length} results available</CardDescription>
              </CardHeader>
              <CardContent>
                {testResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No test results yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {testResults.map((result) => (
                      <div
                        key={result.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{result.fileName}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Uploaded by Dr. {result.doctorName}
                            </p>
                            {result.description && (
                              <p className="text-sm mt-2">{result.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Date: {new Date(result.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={result.fileUrl} download={result.fileName}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-destructive/20 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Security Audit & Emergency Access Log</CardTitle>
                </div>
                <CardDescription>
                  Monitor all emergency access to your records. These actions were performed using the "Break-Glass" override with multi-factor authentication.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emergencyLogs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary opacity-20" />
                    <p className="text-lg font-medium">No Emergency Access Detected</p>
                    <p className="text-sm text-muted-foreground">Your records have not been accessed via emergency override.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 text-sm mb-6">
                      <p className="font-bold flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        Security Alert:
                      </p>
                      <p>If you do not recognize an emergency access event below, please contact the medical board or administrator immediately.</p>
                    </div>

                    {emergencyLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 rounded-lg border-2 border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-all"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center flex-wrap gap-2">
                              <h4 className="font-bold text-destructive">Dr. {log.doctorName}</h4>
                              <Badge variant="destructive" className="animate-pulse">EMERGENCY ACCESS</Badge>
                              {log.mfaVerified && (
                                <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400 text-[10px]">
                                  ✓ MFA Verified
                                </Badge>
                              )}
                              {!log.mfaVerified && (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px]">
                                  ⚠ MFA Unverified
                                </Badge>
                              )}
                            </div>
                            {log.hospitalName && (
                              <p className="text-sm flex items-center gap-1.5">
                                <span className="font-medium">🏥 Hospital:</span>
                                <span className="text-muted-foreground">{log.hospitalName}</span>
                              </p>
                            )}
                            <p className="text-sm font-medium">Reason: {log.reason}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.accessedAt).toLocaleString()}
                            </p>

                            {/* Login Details Section */}
                            <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📋 Login Details</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {log.doctorEmail && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">📧 OTP Email:</span>
                                    <span className="font-mono text-foreground">{log.doctorEmail}</span>
                                  </div>
                                )}
                                {log.hospitalId && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">🏷️ Hospital ID:</span>
                                    <span className="font-mono font-medium text-foreground">{log.hospitalId}</span>
                                  </div>
                                )}
                                {log.verifiedAt && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">🔐 MFA Verified At:</span>
                                    <span className="font-mono text-foreground">{new Date(log.verifiedAt).toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">⏱️ Access Window:</span>
                                  <span className="font-medium text-destructive">10 minutes (auto-expired)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <p className="text-[10px] font-mono text-muted-foreground">Log ID: {log.id.slice(0, 8)}...</p>
                            <Badge variant="outline" className="border-destructive/30 text-destructive">Blockchain Verified</Badge>
                            {log.isRevoked ? (
                              <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
                                ✓ Access Revoked {log.revokedAt ? `· ${new Date(log.revokedAt).toLocaleDateString()}` : ''}
                              </Badge>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="text-xs h-7 px-3"
                                onClick={async () => {
                                  try {
                                    await revokeEmergencyAccess(log.id);
                                    await loadData();
                                    toast.success('Emergency access revoked successfully.');
                                  } catch {
                                    toast.error('Failed to revoke access. Please try again.');
                                  }
                                }}
                              >
                                🚫 Deny Access
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Access Duration Dialog */}
      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Access Duration</DialogTitle>
            <DialogDescription>
              Choose how long the doctor can access your medical records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Access Duration</Label>
              <Select value={accessDuration} onValueChange={setAccessDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Minutes</SelectItem>
                  <SelectItem value="60">1 Hour</SelectItem>
                  <SelectItem value="120">2 Hours</SelectItem>
                  <SelectItem value="360">6 Hours</SelectItem>
                  <SelectItem value="720">12 Hours</SelectItem>
                  <SelectItem value="1440">1 Day</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {accessDuration === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Duration (Minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter number of minutes"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
              </div>
            )}
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>
                  The doctor will have access to your medical records for the selected duration.
                  After this period, access will automatically expire.
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveWithDuration}>
              Approve Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BlockchainTransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        onConfirm={txAction}
        onSuccess={loadData}
        title={txTitle}
        description={txDescription}
      />
    </div>
  );
}
