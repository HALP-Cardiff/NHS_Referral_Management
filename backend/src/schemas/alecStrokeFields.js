const SECTIONS = {
  patient: "Patient Observed States",
  clinical: "Clinical Decisions",
  environment: "Environment Observed States",
};

const SECTION_ORDER = ["patient", "clinical", "environment"];

const ALEC_STROKE_FIELDS = [
  // Patient Observed States
  { key: "age_dob",             label: "Age/ DOB",                            required: true,  section: "patient" },
  { key: "sex",                 label: "Sex",                                 required: true,  section: "patient" },
  { key: "weight",              label: "Weight",                              required: true,  section: "patient" },
  { key: "height",              label: "Height",                              required: true,  section: "patient" },
  { key: "mobility",            label: "Mobility (limited/walking)",          required: true,  section: "patient" },
  { key: "posture",             label: "Posture",                             required: true,  section: "patient" },
  { key: "seizure",             label: "Seizure",                             required: true,  section: "patient" },
  { key: "hip_width",           label: "Hip width",                           required: true,  section: "patient" },
  { key: "upper_leg_length",    label: "Upper leg length",                    required: true,  section: "patient" },
  { key: "lower_leg_length",    label: "Lower leg length",                    required: true,  section: "patient" },
  { key: "abnormal_posture",    label: "Abnormal posture",                    required: true,  section: "patient" },
  { key: "limited_joint_limb",  label: "Limited joint/limb affecting sitting", required: true, section: "patient" },
  { key: "self_propelled",      label: "Self Propelled",                      required: true,  section: "patient" },
  { key: "fatigue_profile",     label: "Fatigue profile",                     required: true,  section: "patient" },
  { key: "transfer_ability",    label: "Transfer ability",                    required: true,  section: "patient" },

  // Clinical Decisions
  { key: "diagnosis",           label: "Diagnosis",                           required: true,  section: "clinical" },
  { key: "primary_reason",      label: "Primary Reason",                      required: true,  section: "clinical" },
  { key: "in_hospital",         label: "In hospital",                         required: true,  section: "clinical" },
  { key: "fall_risk",           label: "Fall Risk",                           required: true,  section: "clinical" },
  { key: "reasons_wider_chair", label: "Reasons for wider chair",             required: true,  section: "clinical" },
  { key: "contraindications",   label: "Contraindications",                   required: true,  section: "clinical" },

  // Environment Observed States
  { key: "living_alone",             label: "Living Alone",             required: true,  section: "environment" },
  { key: "level_of_support",         label: "Level of Support",         required: true,  section: "environment" },
  { key: "smallest_door",            label: "Smallest Door",            required: true,  section: "environment" },
  { key: "stairs_lifts",             label: "Stairs/Lifts",             required: true,  section: "environment" },
  { key: "minimum_turning_circle",   label: "Minimum Turning Circle",   required: true,  section: "environment" },
  { key: "motability",               label: "Motability",               required: true,  section: "environment" },
];

module.exports = { ALEC_STROKE_FIELDS, SECTIONS, SECTION_ORDER };
