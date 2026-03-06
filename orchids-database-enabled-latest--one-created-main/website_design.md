<user_request>BLOCKCHAIN-BASED MEDICAL REPORT & DISTRIBUTION SYSTEM

Technology Stack & Requirements

Blockchain Network: Ganache (Local) or Testnet

Wallet Integration: MetaMask (for blockchain account authentication & transactions)

Smart Contracts: For registration, appointment management, secure data sharing, and medical record storage references (IPFS/File System)

Frontend: HTML5, CSS3, JavaScript, ReactJS (preferred for animations & modern UI)

Backend: Node.js / ExpressJS

Database (off-chain storage): MongoDB or MySQL (only for non-sensitive data like names, roles, and references to blockchain file hashes)

File Storage: IPFS or Encrypted Cloud for medical records (PDFs/digital formats)

Design Preference: Modern, minimalistic, dark-light mode capable UI with smooth animations (Framer Motion / GSAP)

Accessibility: Fully responsive and user-friendly interface

Security: Unique blockchain address per user (doctor/patient), email & username cannot be duplicated, all sensitive actions must use blockchain confirmation via MetaMask

User Roles
1. Patient

Registers with unique email & username

On registration, a new blockchain wallet account is automatically assigned

Logs in through email + MetaMask blockchain verification

Dashboard contains:

Profile Section: Enter/edit personal details

Medical Records Section: Upload medical reports (PDF or digital text)

Appointment Section:

Book appointment with selected doctor

View current & past appointments

Cancel appointment option

Access Requests Tab:

View requests from doctors to access medical records

Approve or reject doctor access

Results Tab: View test results or prescriptions uploaded by doctors in PDF/digital format

2. Doctor

Registers with unique email & username

Blockchain wallet account auto-generated & assigned on registration

Logs in using email + MetaMask authentication

Dashboard consists of:

Doctor Profile: Display and edit specialization, availability, qualification

Appointment Management: View appointments, approve, reject, or reschedule

Medical Access Requests:

Send request to access patient medical report

Upload diagnosis reports or test results (PDF/digital format)

Core Functional Flow

User Registration:

Input: Username, Email, Role (Doctor/Patient), Password

On successful validation, blockchain smart contract creates a new wallet address and associates it with this user.

Confirmation notification with assigned blockchain ID.

User Login:

Email is validated

User must click "Connect to Blockchain via MetaMask"

If blockchain ID matches email record, access to dashboard is granted.

Medical Record Storage:

Files are uploaded and stored in IPFS/encrypted storage

Smart contract stores record hash and metadata

Accessible only when patient grants permission

Appointment Lifecycle:

Patient requests appointment

Doctor receives notification

Doctor can accept / reschedule / reject

Patient can cancel confirmed appointment

Data Sharing via Blockchain Access Control:

Doctors must request access to patient medical records

Patient receives request and approves via blockchain transaction

Once approved, doctor can view/download only during valid access period

Report Notification System:

Doctor uploads medical test report (PDF/digital)

Patient is instantly notified and can view under "Results" tab

Design and UI Specifications

Full-screen modern dashboard design

Dark mode default

Use card components with glassmorphism & neon glow edges

Animated transitions when switching tabs

Attractive onboarding flow with animated graphics

Icons & charts for appointment stats

Loading animations during blockchain transactions

Responsive layout for desktop, tablet, mobile

Key Features to Highlight Visually

✅ Decentralized Data Security
✅ Patient Ownership and Access Control
✅ Blockchain-verified Appointments
✅ Encrypted Report Storage (IPFS + Smart Contract Hash)
✅ MetaMask Seamless Authentication
✅ Automated Blockchain Wallet Creation

Design Goal

Create a futuristic, secure, and user-friendly blockchain-powered healthcare system that ensures:

Data privacy

Transparent access control

Real-time appointment management

Efficient medical report distribution between patients and doctors

Deliverables Expected from Design/Development

Complete responsive UI (frontend code)

Integrated MetaMask authentication module

Smart contract scripts for user management, appointment, and file access control

Animated dashboard UI for both patient and doctor</user_request>

<todo_list>
1. Create authentication system with MetaMask integration, registration/login pages with blockchain wallet connection, and role selection (patient/doctor) with glassmorphism UI and dark mode
2. Build patient dashboard with profile management, medical records upload (simulated IPFS), appointment booking interface, access requests approval system, and results viewing with animated tab navigation
3. Build doctor dashboard with profile/specialization management, appointment management (approve/reject/reschedule), patient access request system, and report upload functionality
4. Implement simulated blockchain smart contract layer using local storage with appointment lifecycle, medical record access control, and transaction confirmation modals
5. Create landing page with feature highlights, modern animations, and update main page to showcase the blockchain medical system with hero section and call-to-action
</todo_list>