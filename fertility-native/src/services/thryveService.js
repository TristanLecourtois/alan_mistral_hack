// Thryve wearable integration — Phase 2 placeholder
// https://docs.thryve.health

import { CONFIG } from '../config'

const THRYVE_BASE_URL = 'https://api.thryve.health'
const THRYVE_API_KEY = CONFIG.THRYVE_API_KEY

// Mock biometric data for demo (replaced by Thryve API in Phase 2)
export const DEMO_BIOMETRICS = {
  lastUpdated: new Date().toISOString(),
  devices: [
    { id: 'apple_watch', icon: '⌚', name: 'Apple Watch', connected: false },
    { id: 'oura', icon: '💍', name: 'Oura Ring', connected: false },
    { id: 'flow', icon: '🌊', name: 'Flow', connected: false },
  ],
  metrics: {
    sleep: { value: '6h42', unit: 'last night', trend: '↓ –38min', trendStatus: 'warn' },
    hrv: { value: '34', unit: 'ms', trend: '↓ Low', trendStatus: 'warn' },
    steps: { value: '4 218', unit: 'today', trend: '→ stable', trendStatus: 'neutral' },
    basalTemp: { value: '+0.4°', unit: 'vs baseline', trend: '↑ LH phase', trendStatus: 'ok' },
  },
  insights: [
    {
      icon: '😴',
      title: 'Insufficient sleep this week',
      desc: 'Your HRV dropped 22% — sleep deprivation is correlated with weaker ovarian response under stimulation.',
      source: 'Correlation observed · ESHRE Study 2023',
      severity: 'warn',
    },
    {
      icon: '🍷',
      title: 'Alcohol detected 3 evenings this week',
      desc: 'Even moderate consumption can reduce egg quality. Complete pause recommended during stimulation.',
      source: 'WHO · HAS IVF guidelines 2022',
      severity: 'warn',
    },
    {
      icon: '🧘',
      title: 'Adapted exercise intensity',
      desc: 'Your data shows moderate activity — ideal for this phase. Avoid intense effort from Day 10.',
      severity: 'ok',
    },
  ],
}

// Returns the Thryve OAuth URL for device connection
export function getThryveConnectUrl(redirectUri) {
  if (!THRYVE_API_KEY) {
    return null
  }
  const params = new URLSearchParams({
    apiKey: THRYVE_API_KEY,
    redirectUri,
    scope: 'sleep,hrv,activity,body_temperature',
  })
  return `${THRYVE_BASE_URL}/connect?${params.toString()}`
}

// Fetch biometric data from Thryve for a connected user
export async function fetchBiometrics(thryveUserId) {
  if (!THRYVE_API_KEY || !thryveUserId) {
    return DEMO_BIOMETRICS
  }

  try {
    const response = await fetch(`${THRYVE_BASE_URL}/v1/users/${thryveUserId}/metrics`, {
      headers: {
        'Authorization': `Bearer ${THRYVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) throw new Error(`Thryve API error: ${response.status}`)
    const data = await response.json()
    return mapThryveResponse(data)
  } catch (err) {
    console.warn('Thryve API failed, using demo data:', err.message)
    return DEMO_BIOMETRICS
  }
}

// Generate wearable-based fertility insights
export async function generateWearableInsights(biometrics, analysisResult) {
  // In Phase 2: combine biometrics + analysis to generate personalized insights via Mistral
  // For now, return demo insights
  return biometrics?.insights || DEMO_BIOMETRICS.insights
}

function mapThryveResponse(raw) {
  // Maps Thryve API response format to our internal format
  return {
    lastUpdated: new Date().toISOString(),
    devices: raw.connectedDevices || DEMO_BIOMETRICS.devices,
    metrics: {
      sleep: { value: raw.sleep?.duration || '—', unit: 'last night', trend: '', trendStatus: 'neutral' },
      hrv: { value: raw.hrv?.rmssd || '—', unit: 'ms', trend: '', trendStatus: 'neutral' },
      steps: { value: raw.activity?.steps || '—', unit: 'today', trend: '', trendStatus: 'neutral' },
      basalTemp: { value: raw.bodyTemperature?.value || '—', unit: 'vs baseline', trend: '', trendStatus: 'neutral' },
    },
    insights: DEMO_BIOMETRICS.insights,
  }
}
