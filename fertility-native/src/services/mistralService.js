import { MOCK_SPERM_ANALYSIS, MOCK_LAB_ANALYSIS } from './mockData'
import { CONFIG } from '../config'

const MISTRAL_API_KEY = CONFIG.MISTRAL_API_KEY
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1'

// Detects document type from filename for demo routing
function detectDocType(filename = '') {
  const lower = filename.toLowerCase()
  if (lower.includes('sperm') || lower.includes('semen') || lower.includes('spermo')) {
    return 'sperm'
  }
  return 'lab'
}

// Converts the raw Mistral response into our normalized biomarker format
function parseAnalysisResponse(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed
  } catch {
    return null
  }
}

const ANALYSIS_PROMPT = `You are a medical document parser specialized in fertility reports.
Analyze this document and return a JSON object with this exact structure:
{
  "documentType": "string (e.g. Semen Analysis, Hormonal Panel, Ultrasound)",
  "date": "string (month year)",
  "analyzedBy": "Mistral OCR 3 + Small 4",
  "biomarkers": [
    {
      "name": "parameter name",
      "value": "numeric value as string",
      "unit": "unit string",
      "norm": "reference range text (e.g. WHO norm ≥ 16 M/mL)",
      "status": "ok | warn | alert",
      "interpretation": "1-2 sentence plain language explanation for patient"
    }
  ],
  "globalScore": 0-100,
  "copilotSummary": "2-3 sentence reassuring but honest summary for the patient",
  "recommendations": [
    { "icon": "emoji", "text": "actionable recommendation" }
  ]
}
Use "ok" when value is within normal range, "warn" for mildly abnormal, "alert" for significantly abnormal.
Keep language warm, reassuring and accessible. Never be alarmist. Return only valid JSON.`

// Upload a document file (base64) and analyze it via Mistral OCR + chat
export async function analyzeDocument(fileUri, filename) {
    // If no API key or force mock enabled, use mock data
  if (!MISTRAL_API_KEY || CONFIG.FORCE_MOCK) {
    return simulateAnalysis(filename)
  }

  try {
    const docType = detectDocType(filename)

    // Step 1: Read file as base64
    const response = await fetch(fileUri)
    const blob = await response.blob()
    const base64 = await blobToBase64(blob)
    const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'

    // Step 2: Call Mistral chat with vision / document
    const chatResponse = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    })

    if (!chatResponse.ok) {
      throw new Error(`Mistral API error: ${chatResponse.status}`)
    }

    const data = await chatResponse.json()
    const content = data.choices?.[0]?.message?.content
    const parsed = parseAnalysisResponse(content)

    if (!parsed) throw new Error('Invalid response format')
    return parsed
  } catch (err) {
    console.warn('Mistral API failed, using mock data:', err.message)
    return simulateAnalysis(filename)
  }
}

// Q&A copilot — sends a question with analysis context
export async function askCopilot(question, analysisResult, onboardingAnswers = []) {
  const context = analysisResult
    ? `Patient context: ${analysisResult.documentType} analyzed. Biomarkers: ${analysisResult.biomarkers?.map(b => `${b.name}: ${b.value} ${b.unit} (${b.status})`).join(', ')}.`
    : 'No analysis results available yet.'

  const onboardingContext = onboardingAnswers.length
    ? `Patient profile: ${onboardingAnswers.join(' | ')}`
    : ''

  const systemPrompt = `You are Fertility Copilot, a warm, empathetic AI health assistant specialized in fertility.
You help patients understand their medical results and prepare for appointments.
${context}
${onboardingContext}
Guidelines:
- Be reassuring but honest
- Never make definitive diagnoses
- Always recommend consulting a specialist for important decisions
- Keep answers concise (2-4 sentences)
- Use plain language, avoid excessive jargon
- End with an actionable suggestion when relevant`

  if (!MISTRAL_API_KEY) {
    return simulateCopilotResponse(question)
  }

  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)
    const data = await response.json()
    return data.choices?.[0]?.message?.content || simulateCopilotResponse(question)
  } catch (err) {
    console.warn('Copilot API failed:', err.message)
    return simulateCopilotResponse(question)
  }
}

// Generate appointment questions from analysis result
export async function generateAppointmentQuestions(analysisResult, onboardingAnswers = []) {
  if (!MISTRAL_API_KEY || !analysisResult) {
    return generateMockQuestions(analysisResult)
  }

  const biomarkersSummary = analysisResult.biomarkers
    ?.filter(b => b.status !== 'ok')
    .map(b => `${b.name}: ${b.value} ${b.unit} (${b.status} — ${b.norm})`)
    .join('\n') || 'All parameters within normal range'

  const prompt = `Based on this fertility report, generate personalized questions for the patient's next medical appointment.

Document: ${analysisResult.documentType}
Abnormal/borderline results:
${biomarkersSummary}

Return a JSON object with this structure:
{
  "priority": [
    { "text": "specific question based on result", "badge": "Based on your result" }
  ],
  "general": [
    { "text": "general fertility question" }
  ]
}
Generate 2-3 priority questions (specific to abnormal values) and 3-4 general questions.
Questions should be concrete, actionable and help the patient have a productive consultation.`

  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)
    const data = await response.json()
    const parsed = parseAnalysisResponse(data.choices?.[0]?.message?.content)
    if (!parsed) throw new Error('Invalid format')

    return {
      priority: (parsed.priority || []).map(q => ({ ...q, checked: true })),
      general: (parsed.general || []).map(q => ({ ...q, checked: false })),
    }
  } catch (err) {
    console.warn('Question generation failed:', err.message)
    return generateMockQuestions(analysisResult)
  }
}

// --- Helpers ---

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

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
