# NHS Wheelchair Referral Management System — User Stories

## 1. Document & Data Ingestion

### US-1.1 PDF Upload (REQ-1.1)
**As a** referrer,
**I want to** upload an ALAC Screening Form PDF via drag-and-drop or file picker,
**So that** I can submit a wheelchair referral digitally.

**Acceptance Criteria:**
- The upload interface supports both drag-and-drop and file picker selection
- PDFs up to 20 MB are accepted
- Non-PDF file types are rejected with a clear error message

---

### US-1.2 Form Detection (REQ-1.2)
**As a** referrer,
**I want** the system to automatically validate that my uploaded PDF is a recognised ALAC Screening Form,
**So that** I am immediately informed if I have uploaded the wrong document.

**Acceptance Criteria:**
- Valid ALAC Screening Forms are accepted and proceed to field extraction
- Unrecognised documents are rejected with a clearnerror message
- The error message indicates the document was not recognised as an ALAC Screening Form

---

### US-1.3 Field Extraction (REQ-1.3)
**As a** referrer,
**I want** the system to automatically extract all form fields from my uploaded ALAC Screening Form,
**So that** I do not have to manually re-enter patient data.

**Acceptance Criteria:**
- All 15 Patient Observed States fields are extracted (Age/DOB, Sex, Weight, Height, Mobility, Posture, Seizure, Hip width, Upper leg length, Lower leg length, Abnormal posture, Limited joint/limb affecting sitting, Self Propelled, Fatigue profile, Transfer ability)
- All 6 Clinical Decisions fields are extracted (Diagnosis, Primary Reason, In hospital, Fall Risk, Reasons for wider chair, Contraindications)
- All 6 Environment Observed States fields are extracted (Living Alone, Level of Support, Smallest Door, Stairs/Lifts, Minimum Turning Circle, Motability)
- Extracted data is mapped to the correct section and field name

---

### US-1.4 Missing Field Validation (REQ-1.4)
**As a** referrer,
**I want** to be told which fields could not be extracted from my uploaded form,
**So that** I can provide the missing information in another form.

**Acceptance Criteria:**
- Missing fields are listed by name and grouped by section (Patient Observed States, Clinical Decisions, Environment Observed States)
- Any partially extracted data is still displayed alongside the missing field list
- The user can clearly distinguish between successfully extracted and missing fields

---

### US-1.5 Video/Image Attachment (REQ-1.5)
**As a** referrer,
**I want to** attach a video or image file alongside my referral PDF,
**So that** the reviewer has additional visual context for the assessment.

**Acceptance Criteria:**
- MP4, WebM, and MOV video formats are accepted
- Image files are accepted
- Maximum file size is 6 MB; files exceeding this are rejected with a clear error
- A video/image cannot be uploaded without an accompanying PDF
- An error is shown if a user attempts to upload media without a PDF

---

## 2. Bayesian Network Inference — GregNet

### US-2.1 Automated Inference (REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4)
**As a** clinician,
**I want** the system to automatically run the extracted form data through the Bayesian network and produce wheelchair recommendations,
**So that** I have an evidence-based starting point for my clinical decision.

**Acceptance Criteria:**
- Inference runs automatically after successful field extraction
- The following hidden variables are computed: Fall Risk (H), Powered in 12 months, Progression, Housing Stability, Actual self propelled
- The following output recommendations are produced: Size, Type, Modification, Referrals, Urgency
- Each output recommendation includes a confidence/probability score
- Each hidden variable includes its computed probability distribution

---

### US-2.5 Inference Persistence (REQ-2.5)
**As an** auditor,
**I want** inference results to be stored alongside the referral record,
**So that** I can review the model's recommendations at any point in the future.

**Acceptance Criteria:**
- Hidden layer values and output recommendations are persisted with the referral record
- Stored inference results are retrievable when viewing a referral

---

### US-2.6 Re-inference (REQ-2.6)
**As a** system administrator,
**I want to** re-run inference on existing referrals when the Bayesian network model is updated,
**So that** referrals can benefit from model improvements.

**Acceptance Criteria:**
- Re-inference can be triggered on an existing referral
- Previous inference results are retained as history
- The most recent inference result is clearly distinguished from historical results

---

## 3. Clinician Review & Override

### US-3.1 Recommendation Review (REQ-3.1, REQ-3.2)
**As a** reviewing clinician,
**I want to** see the model's recommendations alongside the extracted form data and hidden layer reasoning,
**So that** I can make an informed clinical decision.

**Acceptance Criteria:**
- The five output recommendations (Size, Type, Modification, Referrals, Urgency) are displayed with their confidence scores
- The five hidden variables (Fall Risk (H), Powered in 12 months, Progression, Housing Stability, Actual self propelled) are displayed
- The extracted form data is visible alongside the recommendations

---

### US-3.2 Clinician Override (REQ-3.3)
**As a** reviewing clinician,
**I want to** accept, request more information on, or reject each individual recommendation,
**So that** I can apply my clinical judgement to the model's output.

**Acceptance Criteria:**
- Each of the five output recommendations can be individually accepted, have more information requested, or be rejected
- When requesting more information or rejecting, a free-text reason field is required
- The clinician cannot submit a rejection or information request without providing a reason

---

### US-3.3 Final Decision Recording (REQ-3.5)
**As a** reviewing clinician,
**I want** my final decisions to be recorded as the authoritative outcome,
**So that** the referral outcome reflects clinical judgement, not just the model's output.

**Acceptance Criteria:**
- The clinician's accepted recommendations are stored as the final referral outcome
- Final decisions are clearly distinguished from the model's original recommendations
- The referral record shows both the model output and the clinician's final decisions

---

## 4. Referral Workflow & Lifecycle

### US-4.1 Referral Status Tracking (REQ-4.1, REQ-4.2)
**As a** referrer,
**I want to** see the current status of my referral,
**So that** I know where it is in the review process.

**Acceptance Criteria:**
- Referrals display one of the following statuses: Submitted, Under Review, Accepted, Rejected, Returned for Information
- Status transitions follow the valid flow: Submitted → Under Review → Accepted / Rejected / Returned for Information
- Returned for Information → Submitted is supported when the referrer amends and resubmits
- Invalid status transitions are prevented by the system

---

### US-4.2 Referral Assignment (REQ-4.3)
**As a** team lead,
**I want to** assign referrals to a specific reviewer or review team,
**So that** workload is distributed and responsibility is clear.

**Acceptance Criteria:**
- A referral can be assigned to a specific reviewer or review team
- The assigned reviewer is visible on the referral record

---

### US-4.3 Priority Flagging (REQ-4.4)
**As a** reviewing clinician,
**I want** referrals to have an urgency level that can be set by the model and overridden by me,
**So that** urgent cases are prioritised appropriately.

**Acceptance Criteria:**
- Urgency levels supported: routine, urgent, 2-week wait
- The Bayesian network's Urgency output sets the initial urgency level
- A clinician can override the urgency level
- The current urgency level is clearly displayed on the referral

---

### US-4.4 Return with Comments (REQ-4.6)
**As a** reviewing clinician,
**I want to** return a referral for more information with comments explaining what is needed,
**So that** the referrer knows exactly what additional information to provide.

**Acceptance Criteria:**
- When returning a referral, the reviewer can attach free-text comments
- Comments specify what additional information is required
- The referrer can see the reviewer's comments when viewing the returned referral

---

## 5. Search, Filtering & Reporting

### US-5.1 Referral Filtering (REQ-6.2)
**As a** user,
**I want to** filter the referral list by status,
**So that** I can quickly find referrals in a particular stage of the workflow.

**Acceptance Criteria:**
- The referral list can be filtered by status (Submitted, Under Review, Accepted, Rejected, Returned for Information)
- Filtering updates the displayed list without a full page reload
- Clearing the filter shows all referrals

---

## 6. Document & Media Management

### US-6.1 Multiple Attachments (REQ-9.1)
**As a** referrer,
**I want to** attach multiple files to a single referral,
**So that** all relevant documentation is kept together.

**Acceptance Criteria:**
- Multiple PDFs and images can be attached to a single referral
- All attachments are accessible from the referral record

---

### US-6.2 Video Playback (REQ-9.3)
**As a** reviewing clinician,
**I want to** play assessment videos directly in the browser,
**So that** I can review visual assessments without downloading files.

**Acceptance Criteria:**
- Attached videos play in-browser with standard playback controls (play, pause, seek)
- Supported formats: MP4, WebM, MOV

---

## 7. Accessibility & Usability

### US-7.1 Accessible Interface (REQ-11.1, REQ-11.3)
**As a** user with accessibility needs,
**I want** the system to meet WCAG 2.1 Level AA standards and support full keyboard navigation,
**So that** I can use all features regardless of ability.

**Acceptance Criteria:**
- The system passes WCAG 2.1 Level AA automated checks
- All interactive elements are reachable and operable via keyboard
- Focus order is logical and visible
- Screen reader compatible labels and ARIA attributes are present where needed

---

### US-7.2 Responsive Design (REQ-11.2)
**As a** user,
**I want** the system to work on desktop, tablet, and mobile devices,
**So that** I can access referrals from any device.

**Acceptance Criteria:**
- The interface is usable at desktop (≥1024px), tablet (≥768px), and mobile (≥320px) viewport widths
- No horizontal scrolling is required at any supported viewport width
- All core functionality is accessible on all device sizes

---

## 8. Non-Functional

### US-8.1 Inference Performance (REQ-13.1)
**As a** user,
**I want** inference results to be returned within 30 seconds,
**So that** I am not kept waiting during the submission process.

**Acceptance Criteria:**
- Inference results are returned within 30 seconds of submission for a single referral
- A loading indicator is shown while inference is in progress

---

### US-8.2 System Availability (REQ-13.2)
**As a** user,
**I want** the system to be available during working hours,
**So that** I can rely on it for my daily workflow.

**Acceptance Criteria:**
- The system targets 99.5% uptime during business hours (08:00–18:00 Mon–Fri)
