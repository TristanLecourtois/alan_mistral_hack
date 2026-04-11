import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

// Generates a styled HTML PDF for the appointment
export async function generateAppointmentPDF({ questions, analysisResult, onboardingAnswers = [] }) {
  const checkedPriority = questions.priority.filter(q => q.checked)
  const checkedGeneral = questions.general.filter(q => q.checked)
  const allChecked = [...checkedPriority, ...checkedGeneral]

  const recommendations = analysisResult?.recommendations || []
  const docType = analysisResult?.documentType || 'Medical Report'
  const docDate = analysisResult?.date || ''
  const biomarkers = analysisResult?.biomarkers || []

  const statusColor = (status) => {
    if (status === 'ok') return '#00C999'
    if (status === 'warn') return '#F59E0B'
    return '#F4607C'
  }

  const statusLabel = (status) => {
    if (status === 'ok') return 'Normal'
    if (status === 'warn') return 'To monitor'
    return 'Below norm'
  }

  const biomarkerRows = biomarkers.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:${statusColor(b.status)};">${b.value} ${b.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6B7280;font-size:12px;">${b.norm}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
        <span style="background:${statusColor(b.status)}22;color:${statusColor(b.status)};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${statusLabel(b.status)}</span>
      </td>
    </tr>
  `).join('')

  const questionItems = allChecked.map((q, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0;">
      <div style="width:24px;height:24px;background:#4056F4;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
        <span style="color:white;font-size:11px;font-weight:700;">${i + 1}</span>
      </div>
      <p style="margin:0;color:#1A1A2E;font-size:13px;line-height:1.6;">${q.text}</p>
    </div>
  `).join('')

  const recoItems = recommendations.map(r => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;">
      <span style="font-size:18px;">${r.icon}</span>
      <p style="margin:0;color:#374151;font-size:12px;line-height:1.6;">${r.text}</p>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fertility Copilot — Appointment Prep</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1A1A2E; padding: 40px; }
    .header { background: linear-gradient(135deg, #4056F4, #7C5CFC); border-radius: 16px; padding: 24px 28px; margin-bottom: 32px; }
    .header-logo { font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase; }
    .header-title { font-size: 24px; font-weight: 900; color: white; margin-bottom: 6px; }
    .header-meta { font-size: 12px; color: rgba(255,255,255,0.65); }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #6B7280; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid #EEF1FF; }
    table { width: 100%; border-collapse: collapse; }
    .questions-card { background: #F8F9FF; border-radius: 12px; padding: 4px 16px; }
    .recos-card { background: #F0FDF8; border-radius: 12px; padding: 8px 16px; }
    .summary-card { background: #F8F9FF; border-radius: 12px; padding: 16px; border-left: 4px solid #4056F4; margin-bottom: 14px; }
    .summary-text { font-size: 13px; color: #374151; line-height: 1.7; font-style: italic; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #f0f0f0; font-size: 10px; color: #9CA3AF; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo">🧬 Fertility Copilot · Alan x Mistral</div>
    <div class="header-title">Appointment Preparation</div>
    <div class="header-meta">${docType} · ${docDate} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

  ${analysisResult?.copilotSummary ? `
  <div class="section">
    <div class="section-title">Copilot Summary</div>
    <div class="summary-card">
      <p class="summary-text">"${analysisResult.copilotSummary}"</p>
    </div>
  </div>
  ` : ''}

  ${biomarkerRows ? `
  <div class="section">
    <div class="section-title">Your Biomarkers</div>
    <table>
      <thead>
        <tr style="background:#EEF1FF;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Parameter</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Value</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Reference</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>${biomarkerRows}</tbody>
    </table>
  </div>
  ` : ''}

  ${allChecked.length > 0 ? `
  <div class="section">
    <div class="section-title">Questions for my doctor (${allChecked.length} selected)</div>
    <div class="questions-card">${questionItems}</div>
  </div>
  ` : ''}

  ${recoItems ? `
  <div class="section">
    <div class="section-title">Recommended Actions</div>
    <div class="recos-card">${recoItems}</div>
  </div>
  ` : ''}

  <div class="footer">
    Generated by Fertility Copilot · Not a medical diagnosis · Please discuss with your specialist
  </div>
</body>
</html>`

  const { uri } = await Print.printToFileAsync({ html, base64: false })
  return uri
}

export async function shareAppointmentPDF(pdfUri) {
  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share appointment preparation',
    })
  }
}
