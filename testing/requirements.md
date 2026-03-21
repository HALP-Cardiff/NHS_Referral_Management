# NHS Wheelchair Referral Management System — Requirements Specification

## 1. Document & Data Ingestion ??? NEEDS REVIEWING

**REQ-1.1 PDF Upload**
The system shall allow users to upload ALAC Screening Form PDFs (max 20 MB) via a web interface with drag-and-drop and file picker support. ???? WHAT IS GOING TO BE THE MAX SIZE?

**REQ-1.2 Form Detection**
The system shall automatically detect whether an uploaded PDF is a valid ALAC Screening Form and reject unrecognised documents with a clear error message.

**REQ-1.3 Field Extraction**
The system shall extract all observed-state fields from the ALAC Screening Form PDF, mapping them to the three input sections:
- Patient Observed States (15 fields): Age/DOB, Sex, Weight, Height, Mobility, Posture, Seizure, Hip width, Upper leg length, Lower leg length, Abnormal posture, Limited joint/limb affecting sitting, Self Propelled, Fatigue profile, Transfer ability
- Clinical Decisions (6 fields): Diagnosis (MND, MS, None), Primary Reason, In hospital, Fall Risk, Reasons for wider chair, Contraindications
- Environment Observed States (8 fields): Living Alone, Level of Support, Smallest Door, Stairs/Lifts, Minimum Turning Circle, Need to Access Multiple Environment, Motability

**REQ-1.4 Missing Field Validation**
The system shall identify any required fields that could not be extracted and return a structured error listing each missing field by name and section, along with any partially extracted data.

**REQ-1.5 Video Attachment**
The system shall allow a video file (MP4, WebM, or MOV, max 200 MB) to be uploaded alongside a referral PDF. A video shall not be accepted without an accompanying PDF. ???? - WHAT IS THE MAX SIZE 

**REQ-1.6 Multi-Form Type Support**
The system shall support multiple ALAC form variants (e.g., stroke, amputee, neurological, paediatric) and auto-detect the form type from the uploaded PDF content.

**REQ-1.7 Need to Access Multiple Environment Field**
The system shall extract and store the "Need to Access Multiple Environment" field from the ALAC form, which is present in the Bayesian network but currently missing from the schema.

---

## 2. Bayesian Network Inference - GregNet ??? NEEDS REVIEWING

**REQ-2.1 Inference Engine**
The system shall implement or integrate a Bayesian network inference engine that accepts the extracted ALAC form fields as evidence and computes probability distributions for all hidden and output nodes.

**REQ-2.2 Hidden Layer Computation**
The system shall compute the following hidden/latent variables from the observed inputs:
- Fall Risk (H) — computed fall risk assessment
- Powered in 12 months — probability the patient will require a powered wheelchair within 12 months
- Progression — estimated condition progression
- Housing Stability — derived from environment observed states
- Actual self propelled — realistic self-propulsion capability considering clinical factors

**REQ-2.3 Output Recommendations**
The system shall produce the following five output recommendations, each with an associated probability distribution:

| Output | Description |
|---|---|
| Size | Recommended wheelchair size |
| Type | Wheelchair type (manual, powered, tilt-in-space, etc.) |
| Modification | Required wheelchair modifications |
| Referrals | Additional service referrals (OT, physiotherapy, housing adaptation, etc.) |
| Urgency | Urgency level for wheelchair provision |

**REQ-2.4 Confidence Scores**
Each output recommendation shall include a confidence/probability score so clinicians can assess the strength of the recommendation.

**REQ-2.5 Inference Persistence**
The system shall store the inference results (hidden layer values and output recommendations) alongside the referral record for audit and review purposes.

**REQ-2.6 Re-inference**
The system shall allow re-running inference on a referral if the underlying Bayesian network model is updated, and shall retain a history of previous inference results.

---

## 3. Clinician Review & Override ??? NEEDS REVIEWING

**REQ-3.1 Recommendation Display**
The system shall present the Bayesian network outputs (Size, Type, Modification, Referrals, Urgency) to the reviewing clinician alongside the extracted form data and hidden layer inferences.

**REQ-3.2 Hidden Variable Transparency**
The system shall display the intermediate hidden layer values (Fall Risk (H), Powered in 12 months, Progression, Housing Stability, Actual self propelled) so clinicians can understand the reasoning behind the recommendations.

**REQ-3.3 Clinician Override**
The system shall allow a clinician to accept, modify, or reject each individual output recommendation. When modifying or rejecting, the clinician shall be required to provide a free-text reason.

**REQ-3.4 What-If Exploration**
The system shall allow a clinician to temporarily adjust one or more input field values and see the resulting changes to hidden and output layer values in real time, without modifying the stored referral data.

**REQ-3.5 Final Decision Recording**
The system shall record the clinician's final decisions (accepted recommendations and any overrides) as the authoritative outcome of the referral, distinct from the model's recommendations.

---

## 4. Referral Workflow & Lifecycle ??? NEEDS REVIEWING

**REQ-4.1 Referral Statuses**
The system shall support the following referral lifecycle statuses:
- Draft
- Submitted
- Under Review
- Accepted
- Rejected
- Returned for Information

**REQ-4.2 Status Transitions**
The system shall enforce valid status transitions:
- Draft → Submitted (by referrer)
- Submitted → Under Review (by reviewer/system)
- Under Review → Accepted / Rejected / Returned for Information (by reviewer)
- Returned for Information → Submitted (by referrer after amendment)

**REQ-4.3 Assignment**
The system shall allow referrals to be assigned to a specific reviewer or review team.

**REQ-4.4 Priority Flagging**
The system shall support urgency levels (routine, urgent, 2-week wait) which may be initially set by the Bayesian network's Urgency output and overridden by a clinician.

**REQ-4.5 Status Change Notifications**
The system shall notify relevant users when a referral's status changes, via in-app notification and optionally email.

**REQ-4.6 Return with Comments**
When a referral is returned for information, the reviewer shall be able to attach comments specifying what additional information is required.

---

## 5. Patient Management ??? NICE TO HAVES/CAN BE EXPLAINED IN PRESENTATION

**REQ-5.1 Patient Record**
The system shall maintain a patient record including: name, NHS number, date of birth, address, GP practice.

**REQ-5.2 NHS Number Validation**
The system shall validate NHS numbers using the standard modulus 11 check digit algorithm.

**REQ-5.3 Referral History**
The system shall display all referrals associated with a patient in a single view, ordered by date.

**REQ-5.4 Duplicate Detection**
The system shall flag when a new referral is submitted for a patient who already has an active (non-terminal status) referral.

---

## 6. Search, Filtering & Reporting ??? NEEDS REVIEWING

**REQ-6.1 Search**
The system shall support full-text search across referral data including patient name, NHS number, diagnosis, and extracted form text.

**REQ-6.2 Filtering**
The system shall allow filtering the referral list by: status, date range, referrer, form type, urgency, diagnosis, and assigned reviewer.

**REQ-6.3 Dashboard**
The system shall provide a summary dashboard showing:
- Referral counts by status
- Average time from submission to decision
- Rejection/return rate
- Referrals by diagnosis type
- Referrals by urgency

**REQ-6.4 Export**
The system shall support exporting filtered referral data as CSV and PDF reports.

---

## 7. User Authentication & Access Control ??? NEEDS REVIEWING

**REQ-7.1 Authentication**
The system shall require user authentication before granting access to any referral data.

**REQ-7.2 Roles**
The system shall support the following roles:

| Role | Permissions |
|---|---|
| Referrer | Submit referrals, view own referrals, respond to return-for-info |
| Reviewer | View all referrals, run inference, accept/reject/return referrals, override recommendations |
| Admin | All reviewer permissions plus user management, form template configuration, system settings |

**REQ-7.3 Audit Trail**
The system shall log all significant actions (upload, status change, override, deletion) with the acting user, timestamp, and details of the change.

---

## 8. Communication & Collaboration ??? NEEDS REVIEWING

**REQ-8.1 Referral Comments**
The system shall support a threaded comment/notes feature on each referral, visible to both referrer and reviewer.

**REQ-8.2 Internal Notes**
The system shall support internal notes on a referral visible only to the reviewing team.

---

## 9. Document & Media Management ??? NEEDS REVIEWING

**REQ-9.1 Multiple Attachments**
The system shall support multiple file attachments per referral (PDFs, images, clinical letters).

**REQ-9.2 Document Versioning**
The system shall support re-uploading a corrected form, retaining the previous version for audit.

**REQ-9.3 Video Playback**
The system shall provide in-browser video playback for attached assessment videos.

---

## 10. Compliance & Data Governance ??? NEEDS REVIEWING

**REQ-10.1 Data Encryption**
The system shall encrypt all data at rest and in transit (TLS 1.2+).

**REQ-10.2 Data Retention**
The system shall support configurable data retention policies with automated purge of records past the retention period.

**REQ-10.3 Consent Tracking**
The system shall record patient consent for data processing and sharing.

**REQ-10.4 GDPR/DPA Compliance**
The system shall support data subject access requests and right-to-erasure requests in compliance with UK GDPR and the Data Protection Act 2018.

---

## 11. Accessibility & Usability ??? NEEDS REVIEWING

**REQ-11.1 WCAG Compliance**
The system shall meet WCAG 2.1 Level AA accessibility standards.

**REQ-11.2 Responsive Design**
The system shall be usable on desktop, tablet, and mobile devices.

**REQ-11.3 Keyboard Navigation**
All functionality shall be accessible via keyboard navigation.

---

## 12. Integration (Future) ??? NEEDS REVIEWING

**REQ-12.1 NHS Spine / PDS**
The system should support integration with the NHS Personal Demographics Service for patient lookup by NHS number.

**REQ-12.2 e-Referral Service**
The system should support interoperability with the NHS e-Referral Service (e-RS).

**REQ-12.3 GP Systems**
The system should support integration with GP clinical systems (EMIS, SystmOne) for referral submission.

**REQ-12.4 NHS Notify**
The system should support email/SMS notifications via NHS Notify.

---

## 13. Non-Functional Requirements ??? NEEDS REVIEWING

**REQ-13.1 Performance**
The system shall return inference results within 3 seconds of submission for a single referral.

**REQ-13.2 Availability**
The system shall target 99.5% uptime during business hours (08:00–18:00 Mon–Fri).

**REQ-13.3 Scalability**
The system shall support a minimum of 500 concurrent users and 10,000 referrals per month.

**REQ-13.4 Backup & Recovery**
The system shall perform daily automated backups with a recovery point objective (RPO) of 24 hours and recovery time objective (RTO) of 4 hours.
