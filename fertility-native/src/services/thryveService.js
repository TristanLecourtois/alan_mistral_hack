// Thryve wearable integration
// Backend: POST /thryve/metrics  {device_id, days}

import { CONFIG } from '../config'

// Demo biometrics used as fallback when backend is unavailable
export const DEMO_BIOMETRICS = {
  lastUpdated: new Date().toISOString(),
  devices: [
    { id: 'apple_watch', icon: '⌚', name: 'Apple Watch', connected: false },
    { id: 'oura', icon: '💍', name: 'Oura Ring', connected: false },
    { id: 'garmin', icon: '🏃', name: 'Garmin', connected: false },
  ],
  metrics: null, // null = demo mode
  insights: [
    {
      icon: '😴',
      title: 'Insufficient sleep this week',
      desc: 'Sleep deprivation is correlated with weaker ovarian response under stimulation.',
      source: 'ESHRE Study 2023',
      severity: 'warn',
    },
    {
      icon: '🧘',
      title: 'Adapted exercise intensity',
      desc: 'Moderate activity is ideal. Avoid intense effort during stimulation.',
      severity: 'ok',
    },
  ],
}

/**
 * Fetch biometric data for a connected device via the backend Thryve proxy.
 * Returns an array of WearableTile-compatible biomarker objects.
 * Falls back to demo data if the backend call fails.
 *
 * @param {string} deviceId  e.g. "apple_watch", "oura", "garmin"
 * @param {number} days      number of days to fetch (default 7)
 */
export async function fetchBiometrics(deviceId, days = 7) {
  try {
    const url = `${CONFIG.BACKEND_URL}/thryve/metrics`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, days }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Backend ${resp.status}: ${text}`)
    }

    const data = await resp.json()
    return mapThryveToBiomarkers(data)
  } catch (err) {
    console.warn('[thryveService] fetchBiometrics failed, using demo:', err.message)
    return null // caller shows demo tiles
  }
}

/**
 * Map the /thryve/metrics response to WearableTile biomarker objects.
 */
function trendStatus(trendStr) {
  if (!trendStr || trendStr === 'stable') return 'neutral'
  const n = parseFloat(trendStr)
  if (isNaN(n)) return 'neutral'
  return n >= 0 ? 'ok' : 'warn'
}

function fmt(val, decimals = 1) {
  if (val == null) return '—'
  return Number(val).toFixed(decimals)
}

function fmtSteps(val) {
  if (val == null) return '—'
  return Math.round(val).toLocaleString('fr-FR')
}

export function mapThryveToBiomarkers(data) {
  const { sleep, heart, activity, spo2 } = data

  const biomarkers = []

  // Sleep duration
  if (sleep) {
    const h = sleep.duration_h
    const hInt = h != null ? Math.floor(h) : null
    const mInt = h != null ? Math.round((h - Math.floor(h)) * 60) : null
    const sleepVal = h != null ? `${hInt}h${mInt > 0 ? mInt : ''}` : '—'
    const effPct = sleep.efficiency != null ? `${Math.round(sleep.efficiency)}%` : ''
    biomarkers.push({
      icon: '😴',
      label: 'Sleep',
      value: sleepVal,
      unit: effPct ? `efficiency ${effPct}` : 'last night',
      trend: sleep.trend === 'stable' ? '→ Stable' : `${sleep.trend} trend`,
      trendStatus: sleep.trend && sleep.trend !== 'stable'
        ? (parseFloat(sleep.trend) >= 0 ? 'ok' : 'warn')
        : 'neutral',
      insight: h != null && h < 7 ? 'Below 7h → hormone disruption risk' : 'Good sleep duration',
      priority: h != null && h < 7 ? 5 : 3,
    })
  }

  // Resting heart rate
  if (heart) {
    const rhr = heart.resting
    biomarkers.push({
      icon: '💓',
      label: 'Resting HR',
      value: rhr != null ? `${Math.round(rhr)}` : '—',
      unit: 'bpm',
      trend: heart.trend === 'stable' ? '→ Stable' : `${heart.trend} bpm trend`,
      trendStatus: heart.trend && heart.trend !== 'stable'
        ? (parseFloat(heart.trend) <= 0 ? 'ok' : 'warn')
        : 'neutral',
      insight: rhr != null && rhr > 75 ? 'Elevated → fatigue or stress' : 'Normal range',
      priority: rhr != null && rhr > 75 ? 4 : 2,
    })
  }

  // Steps / activity
  if (activity) {
    const steps = activity.steps
    const activeH = activity.active_h
    const activeLabel = activeH != null ? `${fmt(activeH, 1)}h active` : 'today'
    biomarkers.push({
      icon: '🏃',
      label: 'Activity',
      value: fmtSteps(steps),
      unit: activeLabel,
      trend: activity.trend === 'stable' ? '→ Stable' : `${activity.trend} steps trend`,
      trendStatus: 'neutral',
      insight: steps != null && steps < 5000 ? 'Low activity — try a short walk' : 'Good — avoid overtraining',
      priority: 3,
    })
  }

  // SpO₂
  if (spo2 != null) {
    biomarkers.push({
      icon: '🌬️',
      label: 'SpO₂',
      value: `${Math.round(spo2)}`,
      unit: '%',
      trend: spo2 >= 95 ? '→ Normal' : '↓ Low',
      trendStatus: spo2 >= 95 ? 'ok' : 'warn',
      insight: 'Respiratory & recovery health',
      priority: spo2 < 95 ? 4 : 2,
    })
  }

  return biomarkers.length > 0 ? biomarkers : null
}
