import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, TextInput, Alert, ActivityIndicator,
  StyleSheet, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { generateAppointmentQuestions } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

// ─── helpers ────────────────────────────────────────────────
function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }
function sbg(s) { return s === 'ok' ? 'rgba(0,201,153,0.1)' : s === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(244,96,124,0.1)' }
function slabel(s) { return s === 'ok' ? 'Within norms' : s === 'warn' ? 'Slightly low' : 'Below norm' }
function semoji(s) { return s === 'ok' ? '🟢' : s === 'warn' ? '🟠' : '🔴' }

// ─── Biomarker gauge bar ─────────────────────────────────────
function GaugeBar({ bio }) {
  const value    = parseFloat(bio.value) || 0
  const normVal  = parseFloat(bio.normValue)
  const hasNorm  = !isNaN(normVal) && normVal > 0
  const max      = parseFloat(bio.maxDisplayValue) || (hasNorm ? normVal * 2 : value * 2 || 1)
  const valuePct = Math.min((value / max) * 100, 100)
  const normPct  = hasNorm ? Math.min((normVal / max) * 100, 100) : 50
  const fillW    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fillW, { toValue: valuePct, duration: 700, delay: 120, useNativeDriver: false }).start()
  }, [])

  return (
    <View style={g.wrap}>
      <View style={g.track}>
        {hasNorm && <View style={[g.normZone, { left: `${normPct}%`, right: 0 }]} />}
        <Animated.View style={[g.fill, {
          width: fillW.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: sc(bio.status),
        }]} />
        {hasNorm && <View style={[g.normLine, { left: `${normPct}%` }]} />}
      </View>
      <View style={g.labelsRow}>
        <Text style={g.labelEdge}>0 {bio.unit}</Text>
        {hasNorm && (
          <View style={[g.normLabelWrap, { left: `${normPct}%` }]}>
            <Text style={g.labelNorm}>min {normVal} {bio.unit}</Text>
          </View>
        )}
        <Text style={g.labelEdge}>{max} {bio.unit}</Text>
      </View>
      <View style={g.pills}>
        <View style={[g.pill, { backgroundColor: sbg(bio.status) }]}>
          <Text style={[g.pillText, { color: sc(bio.status) }]}>Your value: {bio.value} {bio.unit}</Text>
        </View>
        <View style={[g.pill, { backgroundColor: sbg(bio.status) }]}>
          <Text style={[g.pillText, { color: sc(bio.status) }]}>{slabel(bio.status)}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Generic slide-up sheet ──────────────────────────────────
function Sheet({ visible, onClose, children }) {
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const bgOpacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[sh.container, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        <View style={sh.handle} />
        {children}
      </Animated.View>
    </Modal>
  )
}

// ─── Biomarker detail sheet ──────────────────────────────────
function BioSheet({ bio, visible, onClose }) {
  if (!bio) return null
  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sh.scrollContent}>
        <View style={sh.sheetHeader}>
          <Text style={sh.sheetEmoji}>{semoji(bio.status)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sh.sheetName}>{bio.name}</Text>
            <Text style={sh.sheetRef}>{bio.norm}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={sh.closeBtn}><Text style={sh.closeX}>✕</Text></TouchableOpacity>
        </View>
        <GaugeBar bio={bio} />
        <View style={sh.card}>
          <Text style={sh.cardTitle}>📖 What this means</Text>
          <Text style={sh.cardText}>{bio.interpretation}</Text>
        </View>
        {bio.tips?.length > 0 && (
          <View style={sh.card}>
            <Text style={sh.cardTitle}>{bio.status === 'ok' ? '✅ Keep it up' : '💡 How to improve'}</Text>
            {bio.tips.map((t, i) => (
              <View key={i} style={sh.tipRow}>
                <Text style={sh.tipIcon}>{t.icon}</Text>
                <Text style={sh.tipText}>{t.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Sheet>
  )
}

// ─── Recommendation impact sheet ────────────────────────────
function RecoSheet({ reco, visible, onClose, onAddHabit, alreadyAdded }) {
  if (!reco) return null
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={sh.scrollContent}>
        <View style={sh.sheetHeader}>
          <Text style={{ fontSize: 28 }}>{reco.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[sh.sheetName, { fontSize: 15 }]}>{reco.text}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={sh.closeBtn}><Text style={sh.closeX}>✕</Text></TouchableOpacity>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>📈 Potential impact</Text>
          <Text style={sh.cardText}>{reco.impact}</Text>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>⏱ Timeline</Text>
          <Text style={sh.cardText}>{reco.timeline}</Text>
        </View>
        <TouchableOpacity
          style={[sh.habitBtn, alreadyAdded && sh.habitBtnDone]}
          onPress={() => { onAddHabit(reco); onClose() }}
          disabled={alreadyAdded}
        >
          <Text style={[sh.habitBtnText, alreadyAdded && { color: colors.teal }]}>
            {alreadyAdded ? '✓ Added to my habits' : '＋ Add to my habits'}
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  )
}

// ─── Appointment card ────────────────────────────────────────
const APPT_OPTIONS = ['This week', 'In 2 weeks', 'In 1 month', 'Not scheduled yet']

function AppointmentCard({ date, onSelect }) {
  return (
    <View style={[s.card, shadow.sm]}>
      <Text style={s.cardHead}>📅 Next appointment</Text>
      {date ? (
        <View style={s.apptSet}>
          <Text style={s.apptDateText}>✓ {date}</Text>
          <TouchableOpacity onPress={() => onSelect(null)}>
            <Text style={s.apptChange}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={s.cardSub}>When is your next specialist appointment?</Text>
          <View style={s.apptBtns}>
            {APPT_OPTIONS.map(o => (
              <TouchableOpacity key={o} style={s.apptBtn} onPress={() => onSelect(o)}>
                <Text style={s.apptBtnText}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.bookBtn}>
            <Text style={s.bookBtnText}>🔍 Find a specialist near me</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

// ─── Questions section ───────────────────────────────────────
function QuestionsSection({ questions, setQuestions, onDiscuss, onExport, exporting, loading }) {
  const [newQ, setNewQ] = useState('')
  const [expanded, setExpanded] = useState(true)

  function toggle(i) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, checked: !q.checked } : q))
  }

  function addQuestion() {
    if (!newQ.trim()) return
    setQuestions(prev => [...prev, { text: newQ.trim(), checked: true }])
    setNewQ('')
  }

  const checkedCount = questions.filter(q => q.checked).length

  return (
    <View style={[s.card, shadow.sm]}>
      <TouchableOpacity style={s.cardHeadRow} onPress={() => setExpanded(e => !e)}>
        <Text style={s.cardHead}>📋 Prepare my appointment</Text>
        <Text style={s.chevronToggle}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      <Text style={s.cardSub}>AI-generated questions based on your results. Select the ones you want.</Text>

      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={{ fontSize: 12, color: colors.mid }}>Generating questions with Mistral…</Text>
        </View>
      )}

      {expanded && !loading && (
        <>
          {questions.map((q, i) => (
            <TouchableOpacity key={i} style={[s.qItem, q.checked && s.qItemOn]} onPress={() => toggle(i)}>
              <View style={[s.qCheck, q.checked && s.qCheckOn]}>
                {q.checked && <Text style={{ color: colors.white, fontSize: 11, fontWeight: font.bold }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.qText}>{q.text}</Text>
                {q.badge && (
                  <View style={s.qBadge}><Text style={s.qBadgeText}>{q.badge}</Text></View>
                )}
              </View>
            </TouchableOpacity>
          ))}

          {/* Add custom question */}
          <View style={s.addQRow}>
            <TextInput
              style={s.addQInput}
              placeholder="Add your own question…"
              placeholderTextColor={colors.mid}
              value={newQ}
              onChangeText={setNewQ}
              onSubmitEditing={addQuestion}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addQBtn} onPress={addQuestion} disabled={!newQ.trim()}>
              <Text style={s.addQBtnText}>＋</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={s.qActions}>
            <TouchableOpacity style={s.qActionBtn} onPress={onDiscuss}>
              <Text style={s.qActionText}>💬 Discuss with Copilot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.qActionBtnPrimary, exporting && { opacity: 0.6 }]}
              onPress={onExport}
              disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={s.qActionTextPrimary}>📄 Export PDF ({checkedCount})</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function ResultsScreen() {
  const { navigate } = useNav()
  const { analysisResult, onboardingAnswers, addHabit, habits, appointmentDate, setAppointmentDate } = useApp()
  const insets = useSafeAreaInsets()

  const [selectedBio, setSelectedBio] = useState(null)
  const [selectedReco, setSelectedReco] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)

  const biomarkers = analysisResult?.biomarkers || []
  const recommendations = analysisResult?.recommendations || []
  const summary = analysisResult?.copilotSummary || ''
  const hasIssues = biomarkers.some(b => b.status !== 'ok')

  // Generate appointment questions from backend when screen loads
  useEffect(() => {
    if (!analysisResult) return
    setQuestionsLoading(true)
    generateAppointmentQuestions(analysisResult, onboardingAnswers || [])
      .then(result => {
        const all = [
          ...(result.priority || []),
          ...(result.general  || []),
        ]
        setQuestions(all)
      })
      .catch(() => setQuestions([]))
      .finally(() => setQuestionsLoading(false))
  }, [analysisResult])

  async function handleExportPDF() {
    const checked = questions.filter(q => q.checked)
    setExporting(true)
    try {
      const html = buildPDFHtml({ analysisResult, questions: checked.length ? questions : questions.map(q => ({ ...q, checked: true })), appointmentDate })
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share your appointment prep' })
    } catch {
      Alert.alert('Export failed', 'Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.tag}>{analysisResult?.documentType?.toUpperCase() || 'RESULTS'}</Text>
        <Text style={s.title}>Here's what matters</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Biomarkers ── */}
        <Text style={s.sectionLabel}>YOUR BIOMARKERS · tap each one</Text>
        {biomarkers.map((b, i) => (
          <TouchableOpacity key={i} style={[s.bioRow, shadow.sm]} onPress={() => setSelectedBio(b)} activeOpacity={0.75}>
            <View style={[s.bioBar, { backgroundColor: sc(b.status) }]} />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={s.bioName}>{b.name}</Text>
              <Text style={s.bioRef}>{b.norm}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={[s.bioVal, { color: sc(b.status) }]}>{b.value} <Text style={s.bioUnit}>{b.unit}</Text></Text>
              <View style={[s.bioPill, { backgroundColor: sbg(b.status) }]}>
                <Text style={[s.bioPillText, { color: sc(b.status) }]}>{slabel(b.status)}</Text>
              </View>
            </View>
            <Text style={s.chevronRight}>›</Text>
          </TouchableOpacity>
        ))}

        {/* ── Copilot summary ── */}
        {summary ? (
          <View style={[s.card, shadow.sm, { borderLeftWidth: 3, borderLeftColor: colors.blue }]}>
            <Text style={s.copilotLabel}>💬 Copilot says</Text>
            <Text style={s.copilotText}>{summary}</Text>
          </View>
        ) : null}

        {/* ── Reassurance + guidelines ── */}
        <LinearGradient
          colors={hasIssues ? ['#1B2B6B', '#4056F4'] : ['#00A87F', '#00C999']}
          style={s.reassureCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={s.reassureEmoji}>{hasIssues ? '💆' : '✅'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reassureTitle}>{hasIssues ? 'Nothing urgent.' : 'Everything looks good.'}</Text>
            <Text style={s.reassureSub}>
              {hasIssues
                ? 'Sperm cells fully regenerate every ~74 days. The changes you make today will be measurable in 3 months — your next cycle is already in preparation.'
                : 'Your results are within normal ranges. Keep your current habits and prepare well for the next steps.'}
            </Text>
            <View style={s.guidelineRow}>
              <View style={s.guidelinePill}><Text style={s.guidelineText}>📅 3-month re-test recommended</Text></View>
              <View style={s.guidelinePill}><Text style={s.guidelineText}>🔄 1 cycle = 74 days</Text></View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Recommendations ── */}
        <Text style={s.sectionLabel}>WHAT YOU CAN DO NOW · tap for impact</Text>
        {recommendations.map((r, i) => {
          const added = habits.some(h => h.text === r.habitLabel)
          return (
            <TouchableOpacity key={i} style={[s.recoRow, shadow.sm]} onPress={() => setSelectedReco(r)} activeOpacity={0.75}>
              <Text style={s.recoIcon}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.recoText}>{r.text}</Text>
                <Text style={s.recoTimeline}>{r.timeline}</Text>
              </View>
              {added
                ? <View style={s.habitDone}><Text style={s.habitDoneText}>✓ habit</Text></View>
                : <Text style={s.chevronRight}>›</Text>
              }
            </TouchableOpacity>
          )
        })}

        {/* ── Appointment ── */}
        <AppointmentCard date={appointmentDate} onSelect={setAppointmentDate} />

        {/* ── Appointment prep ── */}
        <QuestionsSection
          questions={questions}
          setQuestions={setQuestions}
          onDiscuss={() => navigate(SCREENS.COPILOT)}
          onExport={handleExportPDF}
          exporting={exporting}
          loading={questionsLoading}
        />

        {/* ── Urgent CTA ── */}
        {hasIssues && (
          <View style={[s.card, s.urgentCard, shadow.sm]}>
            <Text style={s.urgentEmoji}>🩺</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.urgentTitle}>Talk to a specialist</Text>
              <Text style={s.urgentSub}>A fertility specialist or urologist can give you a full picture and a personalized treatment plan.</Text>
            </View>
          </View>
        )}

        {/* ── Ask Copilot ── */}
        <TouchableOpacity style={[s.btnPrimary, shadow.md]} onPress={() => navigate(SCREENS.COPILOT)}>
          <Text style={s.btnPrimaryText}>💬 Ask Copilot a question</Text>
        </TouchableOpacity>

      </ScrollView>

      <BioSheet bio={selectedBio} visible={!!selectedBio} onClose={() => setSelectedBio(null)} />
      <RecoSheet
        reco={selectedReco}
        visible={!!selectedReco}
        onClose={() => setSelectedReco(null)}
        onAddHabit={r => addHabit({ text: r.habitLabel, icon: r.icon })}
        alreadyAdded={selectedReco && habits.some(h => h.text === selectedReco.habitLabel)}
      />
    </View>
  )
}

// ─── PDF builder ─────────────────────────────────────────────
function buildPDFHtml({ analysisResult, questions, appointmentDate }) {
  const checked = questions.filter(q => q.checked)
  const biomarkers = analysisResult?.biomarkers || []
  const recs = analysisResult?.recommendations || []

  const bioRows = biomarkers.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:${b.status === 'ok' ? '#00C999' : b.status === 'warn' ? '#F59E0B' : '#F4607C'}">${b.value} ${b.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6B7280">${b.norm}</td>
    </tr>`).join('')

  const qItems = checked.map((q, i) => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0">
      <span style="width:22px;height:22px;background:#4056F4;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;flex-shrink:0">${i + 1}</span>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#1A1A2E">${q.text}</p>
    </div>`).join('')

  const recItems = recs.map(r => `
    <div style="display:flex;gap:10px;padding:8px 0">
      <span style="font-size:16px">${r.icon}</span>
      <p style="margin:0;font-size:12px;color:#374151;line-height:1.6">${r.text} <em style="color:#9CA3AF">(${r.timeline})</em></p>
    </div>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:40px;color:#1A1A2E}
  .header{background:linear-gradient(135deg,#4056F4,#7C5CFC);border-radius:14px;padding:24px 28px;margin-bottom:28px}
  .h-logo{font-size:12px;color:rgba(255,255,255,.65);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
  .h-title{font-size:22px;font-weight:900;color:white;margin-bottom:4px}
  .h-meta{font-size:12px;color:rgba(255,255,255,.6)}
  .section{margin-bottom:24px}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9CA3AF;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #EEF1FF}
  table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px 12px;font-size:10px;color:#9CA3AF;font-weight:600;background:#F8F9FF}
  .qcard{background:#F8F9FF;border-radius:12px;padding:4px 16px}.recocard{background:#F0FDF8;border-radius:12px;padding:8px 16px}
  .footer{margin-top:40px;text-align:center;font-size:10px;color:#9CA3AF;border-top:1px solid #f0f0f0;padding-top:16px}</style></head><body>
  <div class="header">
    <div class="h-logo">🧬 Fertility Copilot · Alan × Mistral</div>
    <div class="h-title">Appointment Preparation</div>
    <div class="h-meta">${analysisResult?.documentType || 'Medical Report'} · ${analysisResult?.date || ''} · ${appointmentDate ? `Appointment: ${appointmentDate}` : 'No appointment scheduled'}</div>
  </div>
  ${bioRows ? `<div class="section"><div class="section-title">Biomarkers</div><table><thead><tr><th>Parameter</th><th>Your value</th><th>Reference</th></tr></thead><tbody>${bioRows}</tbody></table></div>` : ''}
  ${qItems ? `<div class="section"><div class="section-title">Questions for my doctor (${checked.length})</div><div class="qcard">${qItems}</div></div>` : ''}
  ${recItems ? `<div class="section"><div class="section-title">Recommended actions</div><div class="recocard">${recItems}</div></div>` : ''}
  <div class="footer">Generated by Fertility Copilot · Not a medical diagnosis · Discuss with your specialist</div>
  </body></html>`
}

// ─── Styles ──────────────────────────────────────────────────
const g = StyleSheet.create({
  wrap: { marginVertical: 14 },
  track: { height: 14, backgroundColor: colors.lightgray, borderRadius: 7, overflow: 'hidden', position: 'relative', marginBottom: 6 },
  normZone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,201,153,0.15)' },
  fill: { height: '100%', borderRadius: 7 },
  normLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.teal },
  labelsRow: { position: 'relative', height: 16 },
  labelEdge: { position: 'absolute', fontSize: 9, color: colors.mid },
  normLabelWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -24 }] },
  labelNorm: { fontSize: 9, color: colors.teal, fontWeight: font.semibold },
  pills: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 12, fontWeight: font.bold },
})

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.85 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lightgray, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  sheetEmoji: { fontSize: 24 },
  sheetName: { fontSize: 18, fontWeight: font.black, color: colors.dark },
  sheetRef: { fontSize: 12, color: colors.mid, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 11, color: colors.mid },
  card: { backgroundColor: colors.lightgray, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 8 },
  cardText: { fontSize: 13, color: colors.dark, lineHeight: 21 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  tipIcon: { fontSize: 15, marginTop: 1 },
  tipText: { flex: 1, fontSize: 12, color: colors.dark, lineHeight: 19 },
  habitBtn: { backgroundColor: colors.navy, borderRadius: 14, padding: 14, alignItems: 'center' },
  habitBtnDone: { backgroundColor: 'rgba(0,201,153,0.1)', borderWidth: 1.5, borderColor: colors.teal },
  habitBtnText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 2, color: colors.blue, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.mid },
  // Biomarkers
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 14, padding: 14, overflow: 'hidden' },
  bioBar: { width: 4, position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 2 },
  bioName: { fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  bioRef: { fontSize: 11, color: colors.mid, marginTop: 2 },
  bioVal: { fontSize: 15, fontWeight: font.black },
  bioUnit: { fontSize: 11, fontWeight: font.regular, color: colors.mid },
  bioPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  bioPillText: { fontSize: 9, fontWeight: font.bold },
  chevronRight: { fontSize: 20, color: colors.mid },
  // Copilot summary
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 13, fontWeight: font.black, color: colors.dark, marginBottom: 6 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chevronToggle: { fontSize: 11, color: colors.mid },
  cardSub: { fontSize: 12, color: colors.mid, lineHeight: 18, marginBottom: 10 },
  copilotLabel: { fontSize: 10, fontWeight: font.bold, color: colors.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  copilotText: { fontSize: 13, color: colors.dark, lineHeight: 22 },
  // Reassurance
  reassureCard: { borderRadius: 18, padding: 18, flexDirection: 'row', gap: 12 },
  reassureEmoji: { fontSize: 28, marginTop: 2 },
  reassureTitle: { fontSize: 16, fontWeight: font.black, color: colors.white, marginBottom: 6 },
  reassureSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 19, marginBottom: 12 },
  guidelineRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  guidelinePill: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  guidelineText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: font.semibold },
  // Recommendations
  recoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14 },
  recoIcon: { fontSize: 22 },
  recoText: { fontSize: 13, color: colors.dark, lineHeight: 19, marginBottom: 3 },
  recoTimeline: { fontSize: 10, color: colors.mid, fontStyle: 'italic' },
  habitDone: { backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  habitDoneText: { fontSize: 10, fontWeight: font.bold, color: colors.teal },
  // Appointment
  apptSet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.lightgray, borderRadius: 10, padding: 10 },
  apptDateText: { fontSize: 13, fontWeight: font.bold, color: colors.teal },
  apptChange: { fontSize: 12, color: colors.mid },
  apptBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  apptBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  apptBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  bookBtn: { backgroundColor: 'rgba(64,86,244,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(64,86,244,0.2)' },
  bookBtnText: { fontSize: 13, fontWeight: font.semibold, color: colors.blue },
  // Questions
  qItem: { flexDirection: 'row', gap: 10, backgroundColor: colors.lightgray, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  qItemOn: { borderColor: colors.teal, backgroundColor: 'rgba(0,201,153,0.06)' },
  qCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  qCheckOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  qText: { fontSize: 12, color: colors.dark, lineHeight: 18 },
  qBadge: { marginTop: 4, backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  qBadgeText: { fontSize: 9, fontWeight: font.bold, color: colors.teal },
  addQRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  addQInput: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.dark },
  addQBtn: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addQBtnText: { fontSize: 18, color: colors.white, fontWeight: font.bold },
  qActions: { flexDirection: 'row', gap: 8 },
  qActionBtn: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 12, padding: 12, alignItems: 'center' },
  qActionText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  qActionBtnPrimary: { flex: 1, backgroundColor: colors.coral, borderRadius: 12, padding: 12, alignItems: 'center' },
  qActionTextPrimary: { fontSize: 12, fontWeight: font.bold, color: colors.white },
  // Urgent CTA
  urgentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1.5, borderColor: 'rgba(244,96,124,0.25)', backgroundColor: 'rgba(244,96,124,0.05)' },
  urgentEmoji: { fontSize: 24, marginTop: 2 },
  urgentTitle: { fontSize: 14, fontWeight: font.black, color: colors.coral, marginBottom: 4 },
  urgentSub: { fontSize: 12, color: colors.dark, lineHeight: 18 },
  // Bottom CTA
  btnPrimary: { backgroundColor: colors.blue, borderRadius: 16, padding: 16, alignItems: 'center' },
  btnPrimaryText: { color: colors.white, fontSize: 15, fontWeight: font.bold },
})
