import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Animated, ActivityIndicator, Alert, StyleSheet,
  KeyboardAvoidingView, Platform, Dimensions, PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { generateAppointmentQuestions } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const APPT_OPTIONS = ['This week', 'In 2 weeks', 'In 1 month', 'Not scheduled yet']

// ─── Typing dots animation ───────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(3 * 160),
        ])
      )
    )
    Animated.parallel(anims).start()
    return () => anims.forEach(a => a.stop())
  }, [])
  return (
    <View style={ty.row}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[ty.dot, { opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }]} />
      ))}
    </View>
  )
}

const SWIPE_THRESHOLD = 80
const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Question item (swipe-to-delete) ────────────────────────
function QuestionItem({ q, onToggle, onDelete, entryAnim }) {
  const translateX = useRef(new Animated.Value(0)).current
  const deleteScale = useRef(new Animated.Value(0)).current
  const itemHeight  = useRef(new Animated.Value(1)).current   // scale trick for collapse
  const rowHeight   = useRef(null)

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      if (g.dx > 0) return  // only left
      translateX.setValue(g.dx)
      const progress = Math.min(Math.abs(g.dx) / SWIPE_THRESHOLD, 1)
      deleteScale.setValue(progress)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE_THRESHOLD) {
        // commit delete: slide out then collapse
        Animated.parallel([
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 220, useNativeDriver: true }),
          Animated.timing(deleteScale, { toValue: 1.2, duration: 220, useNativeDriver: true }),
        ]).start(() => {
          Animated.timing(itemHeight, { toValue: 0, duration: 180, useNativeDriver: false }).start(onDelete)
        })
      } else {
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
          Animated.spring(deleteScale, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        ]).start()
      }
    },
  })).current

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        maxHeight: itemHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }),
        overflow: 'hidden',
        marginBottom: itemHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }),
      }}
    >
      <View style={{ position: 'relative' }}>
        {/* Delete background */}
        <View style={s.deleteBack} pointerEvents="none">
          <Animated.View style={[s.deleteBtn, { transform: [{ scale: deleteScale }] }]}>
            <Text style={s.deleteIcon}>🗑</Text>
          </Animated.View>
        </View>

        {/* Swipeable row */}
        <Animated.View
          style={{ transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity style={[s.qItem, q.checked && s.qItemOn]} onPress={onToggle} activeOpacity={0.75}>
            <View style={[s.qCheck, q.checked && s.qCheckOn]}>
              {q.checked && <Text style={{ color: colors.white, fontSize: 11, fontWeight: font.bold }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.qText}>{q.text}</Text>
              {q.badge && (
                <View style={s.qBadge}><Text style={s.qBadgeText}>{q.badge}</Text></View>
              )}
            </View>
            <Text style={s.swipeHint}>‹</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function PrepareScreen() {
  const { navigate } = useNav()
  const { analysisResult, onboardingAnswers, appointmentDate, setAppointmentDate, generatedQuestions, setGeneratedQuestions } = useApp()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)

  const [phase, setPhase] = useState('appointment') // appointment | generating | questions
  const [questions, setQuestions] = useState([])
  const [questionAnims, setQuestionAnims] = useState([])
  const [newQ, setNewQ] = useState('')
  const [exporting, setExporting] = useState(false)

  // If questions already generated (came back to this tab), show them
  useEffect(() => {
    if (generatedQuestions) {
      const flat = [...(generatedQuestions.priority || []), ...(generatedQuestions.general || [])]
      setQuestions(flat)
      setPhase('questions')
    }
  }, [])

  // Animation for each question appearing
  function animateQuestionsIn(flat) {
    const anims = flat.map(() => new Animated.Value(0))
    setQuestionAnims(anims)
    setQuestions(flat)
    setPhase('questions')
    flat.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(anims[i], { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start()
      }, i * 120)
    })
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 200)
  }

  async function handleGenerate() {
    setPhase('generating')
    try {
      const result = await generateAppointmentQuestions(analysisResult, onboardingAnswers)
      setGeneratedQuestions(result)
      const flat = [...(result.priority || []), ...(result.general || [])]
      animateQuestionsIn(flat)
    } catch {
      Alert.alert('Generation failed', 'Please try again.')
      setPhase('appointment')
    }
  }

  function toggle(i) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, checked: !q.checked } : q))
  }

  function deleteQuestion(i) {
    setQuestions(prev => prev.filter((_, idx) => idx !== i))
    setQuestionAnims(prev => prev.filter((_, idx) => idx !== i))
  }

  function addQuestion() {
    if (!newQ.trim()) return
    const newAnim = new Animated.Value(0)
    setQuestionAnims(prev => [...prev, newAnim])
    setQuestions(prev => [...prev, { text: newQ.trim(), checked: true }])
    Animated.spring(newAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start()
    setNewQ('')
  }

  async function handleExport() {
    const checked = questions.filter(q => q.checked)
    if (!checked.length) {
      Alert.alert('No questions selected', 'Select at least one question to export.')
      return
    }
    setExporting(true)
    try {
      const html = buildPDFHtml({ analysisResult, questions, appointmentDate })
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share appointment prep' })
    } catch {
      Alert.alert('Export failed', 'Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const checkedCount = questions.filter(q => q.checked).length

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.tag}>APPOINTMENT PREP</Text>
          <Text style={s.title}>Prepare my{'\n'}next appointment</Text>
        </View>

        <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Phase: appointment ── */}
          <View style={[s.card, shadow.sm]}>
            <Text style={s.cardHead}>📅 Next appointment</Text>
            {appointmentDate ? (
              <View style={s.apptSet}>
                <Text style={s.apptSetText}>✓ {appointmentDate}</Text>
                <TouchableOpacity onPress={() => setAppointmentDate(null)}>
                  <Text style={s.apptChange}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.cardSub}>When is your next specialist appointment?</Text>
                <View style={s.apptBtns}>
                  {APPT_OPTIONS.map(o => (
                    <TouchableOpacity key={o} style={s.apptBtn} onPress={() => setAppointmentDate(o)}>
                      <Text style={s.apptBtnText}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.findBtn}>
                  <Text style={s.findBtnText}>🔍 Find a specialist near me</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Phase: generate questions ── */}
          {phase === 'appointment' && (
            <TouchableOpacity style={[s.generateBtn, shadow.sm]} onPress={handleGenerate} activeOpacity={0.85}>
              <Text style={s.generateIcon}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.generateTitle}>Help me prepare my appointment</Text>
                <Text style={s.generateSub}>AI will generate questions based on your results</Text>
              </View>
              <Text style={s.generateArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* ── Phase: generating ── */}
          {phase === 'generating' && (
            <View style={[s.card, s.generatingCard, shadow.sm]}>
              <View style={s.generatingRow}>
                <View style={s.botDot}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.generatingTitle}>Copilot is reading your results…</Text>
                  <Text style={s.generatingSub}>Analyzing {analysisResult?.biomarkers?.filter(b => b.status !== 'ok').length || 0} key findings</Text>
                </View>
              </View>

              <View style={s.generatingSteps}>
                {[
                  'Reading biomarkers',
                  'Identifying priority questions',
                  'Adapting to your profile',
                  'Generating questions…',
                ].map((step, i) => (
                  <View key={i} style={s.generatingStepRow}>
                    <TypingDots />
                    <Text style={s.generatingStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Phase: questions ── */}
          {phase === 'questions' && questions.length > 0 && (
            <View style={[s.card, shadow.sm]}>
              <View style={s.cardHeadRow}>
                <Text style={s.cardHead}>🎯 Suggested questions</Text>
                <Text style={s.cardSub2}>{checkedCount}/{questions.length} selected</Text>
              </View>
              <Text style={s.cardSub}>Generated based on your results. Select the ones you want to bring.</Text>

              <View style={{ gap: 0, marginTop: 6 }}>
                {questions.map((q, i) => (
                  <QuestionItem
                    key={i}
                    q={q}
                    onToggle={() => toggle(i)}
                    onDelete={() => deleteQuestion(i)}
                    entryAnim={questionAnims[i] || new Animated.Value(1)}
                  />
                ))}
              </View>

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
                <TouchableOpacity style={[s.addQBtn, !newQ.trim() && { opacity: 0.4 }]} onPress={addQuestion} disabled={!newQ.trim()}>
                  <Text style={s.addQBtnText}>＋</Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={s.actionsRow}>
                <TouchableOpacity style={s.actionBtnSecondary} onPress={() => navigate(SCREENS.COPILOT)}>
                  <Text style={s.actionBtnSecondaryText}>💬 Discuss with{'\n'}Copilot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtnPrimary, exporting && { opacity: 0.6 }]}
                  onPress={handleExport}
                  disabled={exporting}
                >
                  {exporting
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <>
                        <Text style={s.actionBtnPrimaryTitle}>📄 Export PDF</Text>
                        <Text style={s.actionBtnPrimarySubtitle}>{checkedCount} question{checkedCount !== 1 ? 's' : ''} + report</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {/* Regenerate */}
              <TouchableOpacity style={s.regenBtn} onPress={() => { setPhase('appointment'); setGeneratedQuestions(null); setQuestions([]) }}>
                <Text style={s.regenBtnText}>↺ Regenerate questions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Copilot chat CTA ── */}
          <TouchableOpacity style={[s.copilotCard, shadow.sm]} onPress={() => navigate(SCREENS.COPILOT)} activeOpacity={0.85}>
            <View style={s.botDot}>
              <Text style={{ fontSize: 16 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.copilotCardTitle}>Have questions you can't formulate?</Text>
              <Text style={s.copilotCardSub}>Chat with Copilot — it knows your results</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.mid }}>→</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── PDF ─────────────────────────────────────────────────────
function buildPDFHtml({ analysisResult, questions, appointmentDate }) {
  const checked = questions.filter(q => q.checked)
  const biomarkers = analysisResult?.biomarkers || []
  const recs = analysisResult?.recommendations || []

  const sc = (s) => s === 'ok' ? '#00C999' : s === 'warn' ? '#F59E0B' : '#F4607C'

  const bioRows = biomarkers.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:${sc(b.status)}">${b.value} ${b.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6B7280">${b.norm}</td>
    </tr>`).join('')

  const qItems = checked.map((q, i) => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0">
      <span style="width:22px;height:22px;min-width:22px;background:#4056F4;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700">${i + 1}</span>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#1A1A2E">${q.text}</p>
    </div>`).join('')

  const recItems = recs.map(r => `
    <div style="display:flex;gap:10px;padding:8px 0">
      <span style="font-size:16px">${r.icon}</span>
      <p style="margin:0;font-size:12px;color:#374151;line-height:1.6">${r.text} <em style="color:#9CA3AF">(${r.timeline || ''})</em></p>
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
    <div class="h-meta">${analysisResult?.documentType || 'Medical Report'} · ${analysisResult?.date || ''} · ${appointmentDate ? `Appointment: ${appointmentDate}` : 'No appointment scheduled'} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
  ${bioRows ? `<div class="section"><div class="section-title">Biomarkers</div><table><thead><tr><th>Parameter</th><th>Your value</th><th>Reference</th></tr></thead><tbody>${bioRows}</tbody></table></div>` : ''}
  ${qItems ? `<div class="section"><div class="section-title">Questions for my doctor (${checked.length} selected)</div><div class="qcard">${qItems}</div></div>` : ''}
  ${recItems ? `<div class="section"><div class="section-title">Recommended actions</div><div class="recocard">${recItems}</div></div>` : ''}
  <div class="footer">Generated by Fertility Copilot · Not a medical diagnosis · Discuss with your specialist</div>
  </body></html>`
}

// ─── Styles ──────────────────────────────────────────────────
const ty = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.teal, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy, lineHeight: 32 },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  // Card
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 14, fontWeight: font.black, color: colors.dark, marginBottom: 8 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardSub: { fontSize: 12, color: colors.mid, lineHeight: 18, marginBottom: 10 },
  cardSub2: { fontSize: 12, fontWeight: font.semibold, color: colors.teal },
  // Appointment
  apptSet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.lightgray, borderRadius: 10, padding: 10 },
  apptSetText: { fontSize: 13, fontWeight: font.bold, color: colors.teal },
  apptChange: { fontSize: 12, color: colors.mid },
  apptBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  apptBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  apptBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  findBtn: { backgroundColor: 'rgba(64,86,244,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(64,86,244,0.2)' },
  findBtnText: { fontSize: 13, fontWeight: font.semibold, color: colors.blue },
  // Generate CTA
  generateBtn: { backgroundColor: colors.blue, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  generateIcon: { fontSize: 28 },
  generateTitle: { fontSize: 15, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  generateSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  generateArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)' },
  // Generating state
  generatingCard: { borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.15)' },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  botDot: { width: 38, height: 38, backgroundColor: colors.blue, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  generatingTitle: { fontSize: 14, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  generatingSub: { fontSize: 12, color: colors.mid },
  generatingSteps: { gap: 10, paddingLeft: 4 },
  generatingStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generatingStepText: { fontSize: 13, color: colors.dark },
  // Questions
  qItem: { flexDirection: 'row', gap: 10, backgroundColor: colors.lightgray, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  qItemOn: { borderColor: colors.teal, backgroundColor: 'rgba(0,201,153,0.06)' },
  qCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  qCheckOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  qText: { fontSize: 12, color: colors.dark, lineHeight: 18, flex: 1 },
  qBadge: { marginTop: 4, backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  qBadgeText: { fontSize: 9, fontWeight: font.bold, color: colors.teal },
  swipeHint: { fontSize: 16, color: 'rgba(0,0,0,0.12)', marginLeft: 4 },
  deleteBack: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FF3B47', borderRadius: 12, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18 },
  deleteBtn: { alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 20 },
  // Add custom question
  addQRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 6 },
  addQInput: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.dark },
  addQBtn: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addQBtnText: { fontSize: 18, color: colors.white, fontWeight: font.bold },
  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtnSecondary: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnSecondaryText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark, textAlign: 'center', lineHeight: 18 },
  actionBtnPrimary: { flex: 1.4, backgroundColor: colors.coral, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimaryTitle: { fontSize: 13, fontWeight: font.black, color: colors.white },
  actionBtnPrimarySubtitle: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  regenBtn: { marginTop: 10, alignItems: 'center', padding: 6 },
  regenBtnText: { fontSize: 12, color: colors.mid },
  // Copilot card
  copilotCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.15)' },
  copilotCardTitle: { fontSize: 13, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  copilotCardSub: { fontSize: 11, color: colors.mid },
})
