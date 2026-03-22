# ALAC-a-zam — Clinical Decision Support System for Wheelchair Referral across Wales


**NHS Hackday #30 — March 22, 2026**

## 🌐 Live Website

**Try ALAC-a-zam:** [https://referral-nhs-management.netlify.app](https://referral-nhs-management.netlify.app)

---

## 👥 Team

- Prem 
- Artin 
- Heledd  
- Daryl
- Greg  
- Ben 
- Chae 
- Joe 
- Rachel

---

## 📋 Problem Statement

There are **45,000+ long-term wheelchair users** in South Wales alone. Only **80.6%** of standard wheelchairs are delivered within 21 days of referral — well below the 95% target. Wales has a **30% disability prevalence** (vs. 25% UK average).

The referral process relies on a **10-page manual form** with 72 questions. The volume of these forms takes a team of band 6 clinicians **4.5 hours a week** to process (~£4,795/year). Forms are often submitted **incomplete with vague answers**, leading to bounced-back referrals and further delays for patients.

---

## 🏥 Existing Solution

Prior to this system, the referral process was entirely manual:

1. A referrer fills out a 10-page paper/PDF ALAC Screening Form with 72 questions covering patient measurements, clinical observations, and environmental data
2. The form is sent to ALAC
3. A clinician reads the form, mentally applies clinical rules, and decides on wheelchair type, size, modifications, and urgency
4. Decisions are recorded separately with no structured link back to the input data
5. There is no probabilistic reasoning — decisions are binary and based on individual clinician experience

---

## 🔍 Requirements Gathering

Requirements were gathered through collaboration with NHS Wales wheelchair services (GPs and OTs) and structured into a formal specification. The full requirements and user stories are documented in [`testing/requirements.md`](testing/requirements.md) and [`testing/user-stories-and-AC.md`](testing/user-stories-and-AC.md).

The process followed four stages:
1. **Requirements** — Researched pain points before defining what the system should do
2. **User Stories** — Identified who uses the system and why (GPs, OTs)
3. **Acceptance Criteria** — Conditions that must be met for each user story to be considered "done"
4. **Implementation** — Developers picked up user stories and acceptance criteria to know exactly what to build

Key requirement areas:
1. **Document & Data Ingestion** — PDF upload with drag-and-drop, automatic form detection, field extraction for 29 fields across 3 sections (Patient Observed States, Clinical Decisions, Environment Observed States), and missing field validation
2. **Bayesian Network Inference (GregNet)** — A probabilistic inference engine that computes hidden variables (Fall Risk, Powered in 12 months, Housing Suitability, Actual Self-Propulsion) and output recommendations (Size, Type, Modification, Referrals, Urgency) with confidence scores
3. **Clinician Review & Override** — Display of recommendations alongside extracted data and hidden layer reasoning, with the ability to accept, reject, or request more information on each recommendation
4. **Accessibility** — WCAG 2.1 Level AA compliance, responsive design, keyboard navigation

---

## 🛠️ What We Implemented

### Architecture

```
North & South Wales Referrals
        │
  PDF + Video + Images (from GPs, OTs)
        │
        ▼
    ┌─────────┐     ┌──────────────────┐     ┌──────────────────────┐
    │ Frontend│────▶│     Parsing      │────▶│  Bayesian Network    │
    │(Next.js)│     │ PDF → text → JSON│     │  (Design informed    │
    └─────────┘     │ Verify all fields│     │   by OT expert)      │
        │           │ Bounce if missing│     │                      │
        │           └──────────────────┘     └──────────┬───────────┘
        │                                               │
        │           ┌──────────────────┐                │
        │           │    BenBot LLM    │◀───────────────┘
        │           │    Summary       │
        │           │ "I recommend     │
        │           │  [features]      │
        │           │  because         │
        │           │  [reasons]"      │
        │           └──────────┬───────┘
        │                      │
        ▼                      ▼
    ┌──────────────────────────────────┐
    │         Human Decision           │
    │  OT reviews recommendations      │
    │  alongside evidence.             │
    │  Able to override BN             │
    │  recommendations.                │
    └──────────────────────────────────┘

    ~20 seconds inference
```

### 1. Frontend — Next.js (React/TypeScript/Tailwind CSS)
- PDF upload with drag-and-drop and file picker
- Video/image attachment alongside referrals
- Extracted field display grouped by section (Patient, Clinical, Environment)
- Missing field highlighting — instantly flags incomplete forms
- AI analysis results display with Pathway, References, and Clinical Reasoning sections
- Bayesian Network inference results with confidence scores and probability distributions
- Referral list with document management (view, delete)
- In-browser video playback
- Responsive design with accessibility features (skip links, ARIA attributes, keyboard navigation)
- Deployed on **Netlify**

### 2. Backend — Express.js (Node.js)
- REST API for document upload, listing, retrieval, and deletion
- PDF parsing service (PDF → plaintext → JSON) that detects ALAC Screening Forms and extracts all 29 fields using flexible regex matching
- Verifies all required fields are filled — bounces back if missing
- Integration with Google Gemini AI (gemma-3-27b-it model) for clinical reasoning ("BenBot" LLM summary)
- Knowledge base encoding the full Bayesian network structure: 4 tiers of nodes, 15 absolute rules, 6 soft rules, and all causal edges
- Two analysis modes: BN-augmented (primary) and LLM-only fallback
- SQLite database for referral persistence with video attachment support
- Deployed on **Render**

### 3. Bayesian Network Service — FastAPI (Python)
- Full Bayesian network implemented using **pgmpy** with exact variable elimination inference
- Design informed by OT expert knowledge — not trained on biased historical data
- 4-tier DAG: Tier 0 (17 patient observables) → Tier 1 (8 environment observables) → Tier 2 (4 hidden/inferred nodes) → Tier 3 (5 output nodes)
- BN infers unstated information (e.g. fall risk) from different factors provided (e.g. diagnosis, age)
- Conditional Probability Tables (CPTs) encoding clinical knowledge
- ALAC-to-BN field mapper that converts free-text PDF values to discrete BN states (24 individual mapper functions handling unit conversion, keyword matching, and threshold classification)
- Two-pass inference: probabilistic inference followed by absolute rule enforcement (13 rules including seizure/powered restriction, bariatric override, door width/turning circle checks, posture/harness requirements, referral accumulation)
- Risk flagging with configurable thresholds
- API key authentication
- Deployed on **Render** via Docker

### Why a Bayesian Network?

- **BNs weigh multiple clinical factors** and show *why* a recommendation was made — a clinician can see the reasoning and push back
- **Designed with expert knowledge** — old referral data can be biased to certain population groups; we design with expert knowledge to reduce bias and standardise referral quality (same method used by Green et al.)
- **Infers unstated information** — the BN infers unstated factors (e.g. fall risk) from different factors provided (e.g. diagnosis, age)
- **Scalable for different referrals** — with expert knowledge and criteria, the service can be scaled out to different referral services (e.g. home blood pressure monitors)

---

## 🛡️ Safety and Ethics

- **Human in the loop** — AI output is advisory only. It is decision support which can be accepted, rejected, and overridden by the clinician. The service augments clinical decision making, doesn't replace it.
- **No autonomous referral** — ALAC-a-zam cannot submit a referral
- **Data handling** — Form data processed transiently. No patient data stored beyond the session. Designed to align with NHS GDPR standards.
- **Explainable AI** — Every recommendation surfaces its weighted factors — clinicians can see exactly why a suggestion was made and challenge it.

---

## 📈 Impact

### For Patients
- **Faster triage** — less waiting caused by incomplete or bounced-back forms
- **More consistent referrals** — wheelchair prescription based on expert consensus

### For Clinicians & NHS Service
- **Trained on expert knowledge**, not biased historical data
- **Instantly flags incomplete forms** and recommends the right pathway
- **Weighted rationale** the OT can see, use, and challenge
- **Structured feedback** to pass back to the referrer on what's missing

---

## 🗺️ Real-World Implementation Roadmap

| Phase | Description |
|-------|-------------|
| ✅ **Now** | Working prototype — form parsing + LLM extraction + Bayesian recommendation + output. Tested by OT. |
| **Phase 1** — OT Pilot | 10 OTs, 30 referrals via Cardiff ALAS referrer training programme. Measure flag accuracy + OT confidence. |
| **Phase 2** — Service Integration | Connect to existing referral portal. Test for 6 months as a parallel trial. |
| **Phase 3** — Scale | Roll out across North & South Wales. Feedback loop to improve model with real service outcome data. |

---

## ⚠️ Limitations

1. **Designed using one clinician's knowledge** — the network needs to be redesigned by experts who specialise in the area
2. **Hasn't been tested against real-life users** — unclear whether this is well designed for use
3. **Uses LLMs in some places** — LLMs are used to format the data; the clinical reasoning layer depends on Google Gemini API availability and is subject to rate limits
4. **Single form type** — currently only supports the ALAC Screening Form (stroke variant)
5. **No user authentication** — no login or role-based access control
6. **CPT accuracy** — probabilities are expert-estimated, not trained on real patient outcome data
7. **No FHIR/HL7 integration** — does not integrate with existing NHS clinical systems

---

## 📚 What We Learned

1. **Teamwork** — we are a very multidisciplined team who had a lot of fun across the past 2 days
2. **Healthcare professionals were key in shaping the requirements** — real world experience shaped what our system does
3. **Strengths of expert models over LLMs** — deterministic outcomes which can be held accountable

---

## 📖 References

1. Multiple Sclerosis Society Cymru. *Wheelchair waiting times in Wales.* Report No.: HWLG(3)-24-09 Paper 1.
2. GOV.UK. *Family Resources Survey: financial year 2023 to 2024.* https://www.gov.uk/government/statistics/family-resources-survey-financial-year-2023-to-2024
3. Cardiff and Vale University Health Board. *Wheelchair Service.* https://cavuhb.nhs.wales/our-services/artificial-limb-and-appliance-service/wheelchair-service/
4. Kyrimi E, et al. *Bayesian networks in healthcare: What is preventing their adoption?* Artificial Intelligence in Medicine. 2021;116:102079.
5. Tagliaferri SD, et al. *Artificial intelligence to improve back pain outcomes.* npj Digit Med. 2020;3(1):93.
6. Huang CR, et al. *Wheelchair Detection Using Cascaded Decision Tree.* IEEE Trans Inf Technol Biomed. 2010;14(2):292–300.
7. Green A, et al. *Using Bayesian networks to identify musculoskeletal symptoms influencing the risk of developing psoriatic arthritis.* Rheumatology. 2021;61(2):581–590.

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.12
- A Google Gemini API key (for clinical reasoning)

### Backend
```bash
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm install
npm run dev
# Runs on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
# Runs on http://localhost:3000
```

### Bayesian Network Service
```bash
cd python/alac-wheelchair-bn
pip install -e .
cd ../../bn-service
pip install -r requirements.txt
uvicorn app.main:app --port 10000
# Runs on http://localhost:10000
```

### Docker (BN Service only)
```bash
docker build -f bn-service/Dockerfile -t alac-bn .
docker run -p 10000:10000 alac-bn
```

---

## 📁 Project Structure

```
├── frontend/                # Next.js frontend (React/TypeScript/Tailwind)
│   └── app/page.tsx         # Main application page
├── backend/                 # Express.js API server
│   └── src/
│       ├── services/        # PDF parser + Gemini AI integration
│       ├── routes/          # REST API endpoints
│       ├── knowledge/       # Wheelchair BN knowledge base
│       └── schemas/         # ALAC form field definitions
├── bn-service/              # FastAPI Bayesian Network inference service
│   └── app/
│       ├── routers/         # /api/bn/classify, /api/bn/classify-from-alac
│       ├── mapping/         # ALAC field → BN evidence mapper
│       └── schemas/         # Pydantic request/response models
├── python/
│   └── alac-wheelchair-bn/  # Core BN package (pgmpy)
│       ├── src/alac/        # Network, nodes, CPTs, rules, inference
│       ├── tests/           # Unit tests
│       └── data/            # Test scenarios
├── testing/                 # Requirements spec + user stories
├── render.yaml              # Render deployment config
└── netlify.toml             # Netlify deployment config
```
