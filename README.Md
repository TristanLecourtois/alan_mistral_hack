# Fertility Copilot

A medical AI assistant that transforms fertility documents into clear insights and actionable decisions — built for patients, not doctors.

## What it does

Upload any fertility-related document (PDF, photo, lab results) and get back a structured, easy-to-understand analysis of your reproductive health. The app extracts key biomarkers, flags anomalies, tracks trends over time, and helps you prepare for your next medical appointment.

---

## Core Features

### 1. Document Analysis Pipeline

- **Upload** — PDF, photo, or lab result
- **Extraction** — OCR + structured JSON parsing of biomarkers (AMH, FSH, motility, etc.)
- **Interpretation** — two-layer system: medical thresholds (rules) + LLM contextualisation
- **Synthesis** — color-coded dashboard with a global fertility score and recommended actions

```
🟢 OK   🟡 To monitor   🔴 Important
```

Example output:
```
🔴 AMH low for your age
🟡 Slightly reduced motility
Score: Female fertility 6/10 · Male fertility 7/10
```

---

### 2. Weak Signal Detection

A lightweight medical rules engine that detects patterns suggesting conditions like:

- **PCOS** — irregular cycles + LH > FSH + consistent ultrasound
- **Male factor** — low concentration + low motility
- **Diminished ovarian reserve** — low AMH + age > 30

Each detected pattern is explained in plain language via LLM and displayed in a dedicated "Detected points of attention" section.

---

### 3. Patient Timeline

Longitudinal view of biomarker evolution across multiple documents:

```
2022 ---- 2023 ---- 2024 ---- 2025
AMH: 2.1 → 1.8 → 1.3 → 1.1
```

Auto-generated trend summaries: *"Downward trend in ovarian reserve over 2 years"*

---

### 4. Doctor Appointment Prep

Generates personalised questions based on the patient's specific results and detected signals, so they can make the most of their consultation.

Examples:
- *"Does my AMH level justify urgent treatment?"*
- *"Should I redo a spermogram? Are there modifiable factors?"*
- *"What is the main factor in our infertility?"*

---

## Tech Stack

- **Frontend** — React + Vite
- **Styling** — CSS Modules
- **Document parsing** — OCR + structured extraction
- **AI layer** — LLM for contextualisation and question generation
- **Charts** — timeline visualisation

## Getting Started

```bash
npm install
npm run dev
```