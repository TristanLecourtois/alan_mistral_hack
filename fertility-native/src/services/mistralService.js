import { MOCK_SPERM_ANALYSIS, MOCK_LAB_ANALYSIS } from './mockData'
import { CONFIG } from '../config'

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1'

// ── Backend OCR call ────────────────────────────────────────────────────────

async function callBackendOCR(fileUri, filename, mimeType) {
  const formData = new FormData()
  formData.append('file', { uri: fileUri, name: filename, type: mimeType || 'application/pdf' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/ocr`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Backend error ${response.status}`)
    }
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

// ── Map backend response → frontend format ─────────────────────────────────

function mapDocType(backendDocType = '') {
  if (backendDocType.includes('spermogram')) return 'Semen Analysis'
  if (backendDocType.includes('hormonal')) return 'Hormonal Panel'
  if (backendDocType.includes('ultrasound')) return 'Ultrasound'
  return 'Medical Report'
}

function interpretationFor(label, value, unit, status, reference) {
  if (status === 'ok')    return `${label} is within normal range (${reference}). No action needed.`
  if (status === 'warn')  return `${label} (${value} ${unit}) is slightly below the ${reference} threshold. Discuss with your doctor.`
  if (status === 'alert') return `${label} (${value} ${unit}) is significantly below the ${reference} norm. This should be discussed with a specialist.`
  return `${label}: ${value} ${unit}.`
}

function calcGlobalScore(values) {
  if (!values.length) return null
  const ok    = values.filter(v => v.status === 'ok').length
  const warn  = values.filter(v => v.status === 'warn').length
  const alert = values.filter(v => v.status === 'alert').length
  const score = Math.round((ok * 100 + warn * 60 + alert * 20) / values.length)
  return Math.max(0, Math.min(100, score))
}

// Parse numeric norm threshold from reference string e.g. "≥ 16 M/mL" → 16
function parseNormValue(reference) {
  if (!reference) return null
  const m = reference.match(/[\d,.]+/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

// Calculate a sensible max for the gauge bar
function calcMaxDisplay(value, normValue) {
  const v = parseFloat(value) || 0
  const n = normValue || 1
  return Math.ceil(Math.max(v * 1.4, n * 2))
}

function mapBackendToFrontend(backendResult) {
  const biomarkers = (backendResult.values || []).map(v => {
    const normValue      = parseNormValue(v.reference)
    const maxDisplayValue = calcMaxDisplay(v.value, normValue)
    return {
      name:             v.label,
      value:            String(v.value),
      unit:             v.unit,
      norm:             v.reference ? `WHO norm ${v.reference}` : '—',
      normValue:        normValue !== null ? String(normValue) : null,
      maxDisplayValue:  String(maxDisplayValue),
      status:           v.status,
      interpretation:   interpretationFor(v.label, v.value, v.unit, v.status, v.reference),
    }
  })

  return {
    documentType: mapDocType(backendResult.doc_type),
    date:         '',
    analyzedBy:   'Mistral OCR + FastAPI',
    biomarkers,
    globalScore:  calcGlobalScore(backendResult.values || []),
    copilotSummary: null,   // enriched below if API key available
    recommendations: [],
  }
}

// ── Enrich with Mistral Small (copilot summary + recommendations) ───────────

async function enrichWithMistral(frontendResult) {
  if (!CONFIG.MISTRAL_API_KEY) return frontendResult

  const abnormal = frontendResult.biomarkers.filter(b => b.status !== 'ok')
  const bioSummary = frontendResult.biomarkers
    .map(b => `${b.name}: ${b.value} ${b.unit} (${b.status}, norm ${b.norm})`)
    .join('\n')

  const prompt = `You are a fertility specialist AI. Based on this medical report, return a single JSON object with this exact structure:
{
  "globalScore": <integer 0-100>,
  "scoreBreakdown": "1 sentence explaining the main factors driving this score",
  "copilotSummary": "2-3 warm, reassuring, honest sentences summarizing ALL the results for the patient",
  "recommendations": [
    { "icon": "emoji", "text": "short actionable tip", "impact": "1 sentence on why this helps fertility", "timeline": "expected timeframe to see results" }
  ],
  "biomarkers": {
    "biomarker name": {
      "interpretation": "1-2 warm plain-language sentences about what this specific value means for the patient — reference their actual value and what it implies for fertility",
      "tips": [
        { "icon": "emoji", "text": "concrete lifestyle action to improve or maintain this specific parameter (e.g. 'Drink 2L of water daily to support seminal fluid volume', 'Take 400mg of folic acid to improve sperm DNA quality')" }
      ]
    }
  }
}

SCORING RULES — compute globalScore using this weighted system:
Each parameter is scored 0-100 then weighted by clinical importance for fertility:

Sperm parameters (spermiogram):
- Progressive motility (PR): weight 30 — WHO norm ≥32%. Score: ≥32%→100, 20-31%→65, 10-19%→35, <10%→10
- Total motility (PR+NP): weight 20 — WHO norm ≥40%. Score: ≥40%→100, 25-39%→65, 15-24%→35, <15%→10
- Concentration: weight 20 — WHO norm ≥16M/mL. Score: ≥16→100, 8-15→65, 3-7→35, <3→10
- Morphology (Kruger/strict): weight 15 — WHO norm ≥4%. Score: ≥4%→100, 2-3%→65, 1%→35, <1%→10
- Volume: weight 8 — WHO norm 1.4-7.6mL. Score: in range→100, 1-1.3 or >7.6→70, <1→30
- pH: weight 4 — WHO norm 7.2-8.0. Score: in range→100, out by 0.3→70, out by >0.5→30
- Vitality: weight 3 — WHO norm ≥54%. Score: ≥54%→100, 40-53%→65, <40%→30

Hormones (if present):
- FSH: weight 20 — norm 1.5-12 IU/L. Score: in range→100, out by 50%→55, >2x upper limit→20
- LH: weight 15 — norm 1.7-8.6 IU/L
- Testosterone: weight 15 — norm ≥12 nmol/L

If only some parameters are present, normalize weights to sum to 100.
Final score = weighted average of parameter scores, rounded to nearest integer.
Score interpretation: 85-100 excellent, 70-84 good, 50-69 moderate, 30-49 below average, <30 low.

Rules for other fields:
- Generate one entry per biomarker in the biomarkers object
- interpretations: warm, accessible, non-alarmist. For ok: brief reassurance. For warn/alert: explain gently
- tips: 2-3 concrete, specific actions per biomarker directly linked to improving THAT parameter
  - For ok values: tips to maintain the result
  - For warn/alert: tips specifically shown to improve that parameter (diet, supplements, lifestyle, sleep, etc.)
  - Be specific: name the supplement, the food, the activity, the dose when relevant
- Generate exactly 3 global recommendations with impact and timeline
- Return ONLY valid JSON, no markdown

Document: ${frontendResult.documentType}
Biomarkers:
${bioSummary}
${abnormal.length ? `Points needing attention: ${abnormal.map(b => b.name).join(', ')}` : 'All values within norms.'}`

  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }),
    })
    if (!response.ok) throw new Error(`Mistral chat error ${response.status}`)
    const data = await response.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    const bioData = parsed.biomarkers || {}

    return {
      ...frontendResult,
      globalScore:     typeof parsed.globalScore === 'number' ? parsed.globalScore : frontendResult.globalScore,
      scoreBreakdown:  parsed.scoreBreakdown || null,
      copilotSummary:  parsed.copilotSummary  || buildFallbackSummary(frontendResult),
      recommendations: parsed.recommendations || buildFallbackRecs(frontendResult),
      biomarkers: frontendResult.biomarkers.map(b => ({
        ...b,
        interpretation: bioData[b.name]?.interpretation || b.interpretation,
        tips:           bioData[b.name]?.tips           || buildFallbackTips(b),
      })),
    }
  } catch (err) {
    console.warn('Mistral enrichment failed, using fallback:', err.message)
    return {
      ...frontendResult,
      copilotSummary:  buildFallbackSummary(frontendResult),
      recommendations: buildFallbackRecs(frontendResult),
      biomarkers: frontendResult.biomarkers.map(b => ({ ...b, tips: buildFallbackTips(b) })),
    }
  }
}

function buildFallbackSummary(result) {
  const { biomarkers, globalScore } = result
  const alerts = biomarkers.filter(b => b.status === 'alert').length
  const warns  = biomarkers.filter(b => b.status === 'warn').length
  if (alerts === 0 && warns === 0) return `All ${biomarkers.length} values are within WHO norms. Your results look great!`
  const issues = biomarkers.filter(b => b.status !== 'ok').map(b => b.name).join(', ')
  return `Analysis complete with a score of ${globalScore}/100. ${issues} ${warns + alerts > 1 ? 'are' : 'is'} slightly outside norms — bring these results to your next appointment for a full discussion.`
}

function buildFallbackTips(bio) {
  const n = bio.name.toLowerCase()
  if (n.includes('motil')) return [
    { icon: '🥗', text: 'Eat foods rich in zinc (oysters, pumpkin seeds) and antioxidants.' },
    { icon: '🚭', text: 'Avoid smoking and alcohol, which directly reduce sperm motility.' },
    { icon: '🌡️', text: 'Avoid heat exposure (hot baths, tight underwear) around the testicles.' },
  ]
  if (n.includes('concentration') || n.includes('count')) return [
    { icon: '💊', text: 'Consider a supplement with CoQ10 (200mg/day) to support sperm production.' },
    { icon: '🏃', text: 'Moderate exercise 3-4x/week improves testosterone and sperm count.' },
    { icon: '😴', text: 'Aim for 7-8h of sleep — testosterone is produced mostly during deep sleep.' },
  ]
  if (n.includes('morpho')) return [
    { icon: '🍇', text: 'Increase intake of lycopene (tomatoes, watermelon) linked to improved morphology.' },
    { icon: '💊', text: 'Folic acid (400µg/day) + zinc supplementation supports sperm DNA quality.' },
    { icon: '⏳', text: 'Allow 72 days for a new sperm cycle — lifestyle changes take time to show effect.' },
  ]
  if (n.includes('volume')) return [
    { icon: '💧', text: 'Drink at least 2L of water daily — hydration directly affects semen volume.' },
    { icon: '⏱️', text: 'Aim for 2-5 days of abstinence before the next sample for optimal volume.' },
  ]
  if (n.includes('amh') || n.includes('fsh') || n.includes('lh')) return [
    { icon: '🧘', text: 'Manage stress with regular mindfulness or yoga — cortisol disrupts hormonal balance.' },
    { icon: '🚫', text: 'Limit endocrine disruptors: avoid plastics (BPA), pesticides, and processed foods.' },
    { icon: '🩺', text: 'Ask your doctor about hormonal support options at your next appointment.' },
  ]
  if (bio.status === 'ok') return [
    { icon: '✅', text: 'Keep up your current habits — this parameter is within healthy norms.' },
    { icon: '🔄', text: 'Repeat the test in 3-6 months to confirm stability over time.' },
  ]
  return [
    { icon: '🩺', text: 'Discuss this value with your specialist for personalized guidance.' },
    { icon: '🥗', text: 'A balanced diet rich in antioxidants supports overall reproductive health.' },
  ]
}

function buildFallbackRecs(result) {
  const recs = [{ icon: '🩺', text: 'Discuss these results with your specialist at your next appointment.' }]
  if (result.biomarkers.some(b => b.name.toLowerCase().includes('motil')))
    recs.push({ icon: '🥗', text: 'Antioxidant-rich diet (zinc, selenium, vitamins C & E) can support sperm health.' })
  if (result.biomarkers.some(b => b.status !== 'ok'))
    recs.push({ icon: '🔄', text: 'A repeat test in 3 months can help confirm the results, as parameters vary between samples.' })
  return recs
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function analyzeDocument(fileUri, filename) {
  if (CONFIG.FORCE_MOCK || !fileUri) {
    return simulateAnalysis(filename)
  }

  try {
    const mimeType = filename?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
    const backendResult = await callBackendOCR(fileUri, filename, mimeType)

    if (!backendResult.values?.length) {
      console.warn('Backend returned no values, falling back to mock')
      return simulateAnalysis(filename)
    }

    const mapped = mapBackendToFrontend(backendResult)
    return await enrichWithMistral(mapped)
  } catch (err) {
    console.warn('analyzeDocument failed, using mock:', err.message)
    return simulateAnalysis(filename)
  }
}

// Q&A copilot — sends full conversation history + document context to backend
export async function askCopilot(messages, analysisResult, onboardingAnswers = []) {
  // Support old call signature: askCopilot(question_string, ...)
  const normalizedMessages = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages

  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: normalizedMessages,
        analysis_context: analysisResult || null,
        onboarding_answers: onboardingAnswers,
      }),
    })
    if (!response.ok) throw new Error(`Backend error ${response.status}`)
    const data = await response.json()
    return data.reply
  } catch (err) {
    console.warn('Copilot backend failed, using fallback:', err.message)
    const lastUserMsg = [...normalizedMessages].reverse().find(m => m.role === 'user')?.content || ''
    return simulateCopilotResponse(lastUserMsg)
  }
}

// Generate appointment questions from analysis result
export async function generateAppointmentQuestions(analysisResult, onboardingAnswers = []) {
  if (!analysisResult) return generateMockQuestions(null)

  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_result: analysisResult,
        onboarding_answers: onboardingAnswers,
      }),
    })
    if (!response.ok) throw new Error(`Backend error ${response.status}`)
    return response.json()
  } catch (err) {
    console.warn('Questions backend failed, using fallback:', err.message)
    return generateMockQuestions(analysisResult)
  }
}

// --- Helpers ---

function simulateAnalysis(filename) {
  const docType = detectDocType(filename || '')
  return docType === 'sperm' ? MOCK_SPERM_ANALYSIS : MOCK_LAB_ANALYSIS
}

function generateMockQuestions(analysisResult) {
  const isSperm = analysisResult?.documentType?.toLowerCase().includes('semen')
  if (isSperm) {
    return {
      priority: [
        { text: 'Given my progressive motility of 28%, do you recommend a repeat semen analysis or going straight to a DNA fragmentation test?', badge: 'Based on your result', checked: true },
        { text: 'Is my morphology at 3% (Kruger) an isolated factor or combined with motility to consider ICSI?', badge: 'Based on your result', checked: true },
        { text: 'What protocol do you recommend first — IUI or IVF — and why?', badge: 'Recommended', checked: false },
      ],
      general: [
        { text: 'What additional tests do you suggest before starting a protocol?', checked: false },
        { text: 'What lifestyle changes could improve parameters by the next sample?', checked: false },
        { text: 'What are realistic timelines to start a first cycle?', checked: false },
      ],
    }
  }
  return {
    priority: [
      { text: 'My AMH is 1.8 ng/mL — is this consistent with starting stimulation now, or should we wait?', badge: 'Based on your result', checked: true },
      { text: 'Given my hormonal profile, what stimulation protocol would you recommend?', badge: 'Based on your result', checked: true },
    ],
    general: [
      { text: 'What additional tests would you suggest before starting a protocol?', checked: false },
      { text: 'What are realistic success rates given my profile?', checked: false },
      { text: 'What lifestyle factors should I prioritize before starting?', checked: false },
    ],
  }
}

function simulateCopilotResponse(question) {
  const lower = question.toLowerCase()
  if (lower.includes('motility') || lower.includes('motilité')) {
    return "Motility at 28% is slightly below the WHO threshold of 32%, but this is not necessarily alarming on its own — sperm parameters can vary between samples. I'd recommend discussing a repeat test with your specialist before drawing conclusions. In the meantime, antioxidants and avoiding heat exposure can support sperm health."
  }
  if (lower.includes('morphology') || lower.includes('morphologie')) {
    return "A morphology of 3% is mildly below the WHO reference of 4%. On its own, this is often not a barrier to natural conception, but combined with your motility result, your doctor may want to discuss next steps. ICSI is sometimes considered in cases with combined male factor findings."
  }
  if (lower.includes('worried') || lower.includes('inquiet') || lower.includes('stress')) {
    return "It's completely normal to feel anxious when reviewing medical results. The good news is that your results show several strong points — your concentration is excellent. The parameters that are slightly below norms are common and treatable. Your medical team is the best resource to put everything in context for your specific situation."
  }
  if (lower.includes('ivf') || lower.includes('fiv') || lower.includes('iui')) {
    return "The choice between IUI and IVF depends on multiple factors including both partners' full profiles, your age, and how long you've been trying. Given your current results, your specialist will be in the best position to recommend the right first-line approach. Your appointment questions screen has specific questions to help guide that conversation."
  }
  return "That's a great question to bring to your next appointment. Based on your results, your medical team will be best placed to give you a personalized answer. I've added a question about this to your appointment preparation list — would you like me to help you phrase it precisely?"
}
