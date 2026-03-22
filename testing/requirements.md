# NHS Wheelchair Referral Management System — Requirements Specification

## 1. Document & Data Ingestion

**REQ-1.1 PDF Upload**
The system shall allow users to upload ALAC Screening Form PDFs (max 20 MB) via a web interface with drag-and-drop and file picker support.

**REQ-1.2 Form Detection**
The system shall automatically detect whether an uploaded PDF is a valid ALAC Screening Form and reject unrecognised documents with a clear error message.

**REQ-1.3 Field Extraction**
The system shall extract all observed-state fields from the ALAC Screening Form PDF, mapping them to the three input sections:
- Patient Observed States (15 fields): Age/DOB, Sex, Weight, Height, Mobility, Posture, Seizure, Hip width, Upper leg length, Lower leg length, Abnormal posture, Limited joint/limb affecting sitting, Self Propelled, Fatigue profile, Transfer ability
- Clinical Decisions (6 fields): Diagnosis (MND, MS, None), Primary Reason, In hospital, Fall Risk, Reasons for wider chair, Contraindications
- Environment Observed States (8 fields): Living Alone, Level of Support, Smallest Door, Stairs/Lifts, Minimum Turning Circle, Need to Access Multiple Environment, Motability

**REQ-1.4 Missing Field Validation**
The system shall identify any required fields that could not be extracted and return a structured error listing each missing field by name and section, along with any partially extracted data.

**REQ-1.5 Video and Image Attachment**
The system shall allow a video or image file (MP4, WebM, or MOV, max 6 MB) to be uploaded alongside a referral PDF. A video/image shall not be accepted without an accompanying PDF.

---

## 2. Bayesian Network Inference - GregNet

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

## 3. Clinician Review & Override

**REQ-3.1 Recommendation Display**
The system shall present the Bayesian network outputs (Size, Type, Modification, Referrals, Urgency) to the reviewing clinician alongside the extracted form data and hidden layer inferences.

**REQ-3.2 Hidden Variable Transparency**
The system shall display the intermediate hidden layer values (Fall Risk (H), Powered in 12 months, Progression, Housing Stability, Actual self propelled) so clinicians can understand the reasoning behind the recommendations.

**REQ-3.3 Clinician Override**
The system shall allow a clinician to accept, request more information or reject each individual output recommendation. When requesting more information or rejecting, the clinician shall be required to provide a free-text reason.

**REQ-3.5 Final Decision Recording**
The system shall record the clinician's final decisions (accepted recommendations) as the authoritative outcome of the referral, distinct from the model's recommendations.

---

## 4. Referral Workflow & Lifecycle

**REQ-4.1 Referral Statuses**
The system shall support the following referral lifecycle statuses:
- Submitted
- Accepted
- Rejected
- Returned for Information

**REQ-4.2 Status Transitions**
The system shall enforce valid status transitions:
- Submitted → Under Review (by reviewer/system)
- Under Review → Accepted / Rejected / Returned for Information (by reviewer)
- Returned for Information → Submitted (by referrer after amendment)

**REQ-4.3 Assignment**
The system shall allow referrals to be assigned to a specific reviewer or review team.

**REQ-4.4 Priority Flagging**
The system shall support urgency levels (routine, urgent, 2-week wait) which may be initially set by the Bayesian network's Urgency output and overridden by a clinician.

**REQ-4.6 Return with Comments**
When a referral is returned for information, the reviewer shall be able to attach comments specifying what additional information is required.

---

## 6. Search, Filtering & Reporting

**REQ-6.2 Filtering**
The system shall allow filtering the referral list by: status.

---

## 9. Document & Media Management

**REQ-9.1 Multiple Attachments**
The system shall support multiple file attachments per referral (PDFs, images).

**REQ-9.3 Video Playback**
The system shall provide in-browser video playback for attached assessment videos.

---

## 11. Accessibility & Usability

**REQ-11.1 WCAG Compliance**
The system shall meet WCAG 2.1 Level AA accessibility standards.

**REQ-11.2 Responsive Design**
The system shall be usable on desktop, tablet, and mobile devices.

**REQ-11.3 Keyboard Navigation**
All functionality shall be accessible via keyboard navigation.

---

## 13. Non-Functional Requirements

**REQ-13.1 Performance**
The system shall return inference results within 30 seconds of submission for a single referral.

**REQ-13.2 Availability**
The system shall target 99.5% uptime during business hours (08:00–18:00 Mon–Fri).
