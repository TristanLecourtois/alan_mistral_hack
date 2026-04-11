# Mia, your Fertility Companion

> AI-powered mobile companion that reads your fertility test results, explains them in plain language, connects to your wearables, and builds a personalized action plan to improve your chances.

## Team

| Name | LinkedIn Profile Link |
| ---- | --------------------- |
| Tristan Lecourtois | [linkedin.com/in/tristan-lecourtois-599812268](https://www.linkedin.com/in/tristan-lecourtois-599812268/) |
| Alice Devilder | [linkedin.com/in/alice-devilder](https://www.linkedin.com/in/alice-devilder/) |
| Max Moock | [linkedin.com/in/maxmoock](https://www.linkedin.com/in/maxmoock/) |
| Nubia Tomita | [linkedin.com/in/itsnubia](https://www.linkedin.com/in/itsnubia/) |

## The Problem

Fertility treatment is one of the most stressful medical journeys a person can go through — yet patients are handed dense lab reports full of clinical jargon and left to interpret them alone. Key metrics like sperm motility, morphology, or FSH levels are compared against WHO norms that most people have never heard of. Appointments with specialists are short, expensive, and months apart. In the meantime, patients have no guidance on what their numbers actually mean, what lifestyle changes could help, or what questions to ask their doctor.

This gap between diagnosis and action leads to anxiety, poor adherence, and missed opportunities to improve outcomes before the next cycle.

## What It Does

Mia is a mobile app (iOS/Android) that turns a photo of any fertility lab report into a personalized, actionable health dashboard.

1. **Scan & Analyse** — The user photographs their lab document (spermogram, hormonal panel, etc.). Mistral's OCR model extracts every biomarker and compares it against WHO 2021 clinical norms. A global fertility score (0–100) is generated using clinically weighted rules (progressive motility 30%, concentration 20%, total motility 20%, morphology 15%, volume 8%, pH 4%, vitality 3%).

2. **Understand** — Each biomarker is shown on an interactive gauge: the patient's value, the healthy reference range, and a color-coded status (green / amber / red). A plain-language explanation accompanies every result.

3. **Prepare** — The app generates a smart list of questions to ask at the next specialist appointment, personalized to the patient's specific results. A built-in map finds nearby fertility specialists (andrologists, gynecologists, urologists) using geolocation, with direct Doctolib booking links.

4. **Improve** — The user connects their wearable device (Apple Watch, Oura Ring, Garmin, Whoop, Withings) via Thryve. Real-time biometrics — sleep quality, resting heart rate, activity, SpO₂ — are fetched daily and cross-referenced with fertility markers. A personalized improvement plan is generated ranking lifestyle interventions by clinical impact (e.g. reducing scrotal heat, improving sleep, cutting alcohol).

5. **Copilot** — A persistent AI chat companion, fully aware of the patient's results, answers any fertility question in context across multiple saved conversations.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Mobile | React Native (Expo SDK 52) |
| Backend | FastAPI (Python) |
| Document OCR | Mistral OCR (`mistral-ocr-latest`) 🚀 |
| AI chat & scoring | Mistral (`mistral-small-latest`) 🚀 |
| Wearable data | Thryve Health API |
| Geolocation | expo-location + OpenStreetMap Overpass API |
| Specialist booking | Doctolib deep links |

## Special Track

Are you submitting to a special track? If so, which one?

- [ ] Alan Play: Living Avatars
- [ ] Alan Play: Mo Studios
- [ ] Alan Play: Personalized Wrapped
- [ ] Alan Play: Health App in a Prompt
- [x] Alan Precision

## What We'd Do Next

- **Cycle tracking & longitudinal analysis** — Compare results across multiple lab reports over time to detect trends, measure improvement, and predict optimal timing for IVF cycles.
- **Female fertility support** — Extend OCR and scoring to hormonal panels (AMH, FSH, LH, estradiol), follicular ultrasound reports, and cycle phase detection via basal temperature from wearables.
- **LLM-driven insight synthesis** — Combine wearable biometrics and lab results in a single Mistral prompt to generate truly personalized insights (e.g. "your HRV drop coincides with your lowest morphology reading — stress is likely a contributing factor").
- **Specialist integration** — Allow doctors to access the patient's dashboard directly, add annotations, and push tailored recommendations back to the app.
- **Medication & protocol reminders** — Smart notifications for IVF stimulation protocols with dosage tracking and injection reminders tied to the patient's cycle calendar.
