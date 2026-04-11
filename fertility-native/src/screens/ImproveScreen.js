import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Animated, Modal, StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useApp } from '../context/AppContext'
import { DEMO_BIOMETRICS } from '../services/thryveService'
import { generateImprovementPlan } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

function sc(sev) { return sev === 'ok' ? colors.teal : sev === 'warn' ? colors.amber : colors.coral }
function sbg(sev) { return sev === 'ok' ? 'rgba(0,201,153,0.12)' : sev === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(244,96,124,0.12)' }

// ─── Typing dots ─────────────────────────────────────────────
function TypingDots() {
  const d0 = useRef(new Animated.Value(0)).current
  const d1 = useRef(new Animated.Value(0)).current
  const d2 = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const dots = [d0, d1, d2]
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(420),
        ])
      )
    )
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [])
  return (
    <View style={ty.row}>
      {[d0, d1, d2].map((d, i) => (
        <Animated.View key={i} style={[ty.dot, { opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }] }]} />
      ))}
    </View>
  )
}

// ─── Sheet ───────────────────────────────────────────────────
function Sheet({ visible, onClose, children }) {
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const bgOp = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(bgOp, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
        Animated.timing(bgOp, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.backdrop, { opacity: bgOp }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[sh.container, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        <View style={sh.handle} />
        {children}
      </Animated.View>
    </Modal>
  )
}

function HabitDetailSheet({ habit, visible, onClose, onAdd, added }) {
  if (!habit) return null
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={sh.content}>
        <View style={sh.row}>
          <Text style={{ fontSize: 28 }}>{habit.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sh.title}>{habit.text}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={sh.closeBtn}><Text style={sh.closeX}>✕</Text></TouchableOpacity>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>📈 Potential impact</Text>
          <Text style={sh.cardText}>{habit.impact}</Text>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>⏱ Timeline</Text>
          <Text style={sh.cardText}>{habit.timeline}</Text>
        </View>
        <TouchableOpacity style={[sh.addBtn, added && sh.addBtnDone]} onPress={() => { onAdd(habit); onClose() }} disabled={added}>
          <Text style={[sh.addBtnText, added && { color: colors.teal }]}>
            {added ? '✓ Added to my habits' : '＋ Add to my habits'}
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  )
}

// ─── Metric tile ─────────────────────────────────────────────
function MetricTile({ icon, label, value, unit, trend, trendStatus }) {
  const trendColor = trendStatus === 'ok' ? colors.teal : trendStatus === 'warn' ? colors.amber : colors.mid
  return (
    <View style={[m.tile, shadow.sm]}>
      <Text style={m.tileIcon}>{icon}</Text>
      <Text style={m.tileValue}>{value}</Text>
      <Text style={m.tileUnit}>{unit}</Text>
      <Text style={[m.tileTrend, { color: trendColor }]}>{trend}</Text>
      <Text style={m.tileLabel}>{label}</Text>
    </View>
  )
}

// ─── Projection (bottom) ─────────────────────────────────────
function ProjectionCard({ score, habitPoints, wearableBonus, selectedCount, totalHabits, connected }) {
  const barW = useRef(new Animated.Value(0)).current
  useEffect(() => {
    barW.setValue(0)
    Animated.timing(barW, { toValue: score / 100, duration: 700, useNativeDriver: false }).start()
  }, [score])

  return (
    <View style={[proj.card, shadow.md]}>
      <Text style={proj.title}>Expected impact</Text>
      <Text style={proj.sub}>Based on your selected habits{connected ? ' and wearable tracking' : ''}.</Text>

      <View style={proj.scoreRow}>
        <Text style={proj.scoreNum}>{score}</Text>
        <Text style={proj.scoreOut}>/ 100</Text>
      </View>

      <View style={proj.track}>
        <Animated.View style={[proj.fill, { width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>

      <View style={proj.breakdown}>
        <View style={proj.breakRow}>
          <Text style={proj.breakLabel}>Habits selected</Text>
          <Text style={proj.breakVal}>{selectedCount}/{totalHabits} · +{habitPoints} pts</Text>
        </View>
        <View style={proj.breakRow}>
          <Text style={proj.breakLabel}>Wearable boost</Text>
          <Text style={[proj.breakVal, !connected && { color: colors.mid }]}>
            {connected ? `+${wearableBonus} pts` : 'Connect device for +pts'}
          </Text>
        </View>
      </View>
    </View>
  )
}

const METRICS_ICONS = { sleep: '😴', hrv: '💓', steps: '🚶', basalTemp: '🌡️' }
const METRICS_LABELS = { sleep: 'Sleep', hrv: 'HRV', steps: 'Steps', basalTemp: 'Basal temp.' }

const GEN_STEPS = [
  'Reading your biomarkers',
  'Matching evidence-based habits',
  'Estimating impact windows',
  'Drafting your plan…',
]

function computeProjection(habits, selectedLabels, connected) {
  const selected = habits.filter(h => selectedLabels.has(h.habitLabel))
  const habitPoints = Math.round(selected.reduce((s, h) => s + (h.impactContribution || 10), 0))
  const wearableBonus = connected ? Math.min(28, Math.round(habitPoints * 0.5)) : 0
  const base = 22
  const raw = base + Math.round(habitPoints * 0.65) + wearableBonus
  const score = Math.min(94, Math.max(18, raw))
  return { score, habitPoints, wearableBonus }
}

export default function ImproveScreen() {
  const { analysisResult, onboardingAnswers, habits, addHabit, improvementPlan, setImprovementPlan } = useApp()
  const insets = useSafeAreaInsets()

  const [devices, setDevices] = useState(DEMO_BIOMETRICS.devices)
  const connected = devices.some(d => d.connected)

  const [phase, setPhase] = useState(() => (improvementPlan?.habits?.length ? 'ready' : 'idle'))
  const [planHabits, setPlanHabits] = useState(() => improvementPlan?.habits || [])
  const [selectedLabels, setSelectedLabels] = useState(() => {
    const set = new Set()
    ;(improvementPlan?.habits || []).forEach(h => set.add(h.habitLabel))
    return set
  })
  const [habitAnims, setHabitAnims] = useState(() =>
    (improvementPlan?.habits || []).map(() => new Animated.Value(1))
  )
  const [detailHabit, setDetailHabit] = useState(null)

  const connectDevice = useCallback((device) => {
    setDevices(prev => prev.map(d => (d.id === device.id ? { ...d, connected: !d.connected } : d)))
  }, [])

  function toggleSelected(label) {
    setSelectedLabels(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function animateHabitsIn(list) {
    const anims = list.map(() => new Animated.Value(0))
    setHabitAnims(anims)
    list.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(anims[i], { toValue: 1, tension: 68, friction: 9, useNativeDriver: true }).start()
      }, i * 100)
    })
  }

  async function handleGenerate() {
    setPhase('generating')
    try {
      const result = await generateImprovementPlan(analysisResult, onboardingAnswers, connected)
      const list = result.habits || []
      setImprovementPlan(result)
      setPlanHabits(list)
      setSelectedLabels(new Set(list.map(h => h.habitLabel)))
      setPhase('ready')
      animateHabitsIn(list)
    } catch {
      Alert.alert('Generation failed', 'Please try again.')
      setPhase('idle')
    }
  }

  function handleRegenerate() {
    setImprovementPlan(null)
    setPlanHabits([])
    setSelectedLabels(new Set())
    setHabitAnims([])
    setPhase('idle')
  }

  const projection = useMemo(
    () => computeProjection(planHabits, selectedLabels, connected),
    [planHabits, selectedLabels, connected]
  )

  const metrics = DEMO_BIOMETRICS.metrics
  const insights = DEMO_BIOMETRICS.insights

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.tag}>ACT & IMPROVE</Text>
        <Text style={s.title}>Improve my results</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Wearables + impact message ── */}
        <Text style={s.sectionLabel}>STEP 1 · CONNECT WEARABLES</Text>
        {!connected ? (
          <LinearGradient colors={['#1B2B6B', '#4056F4']} style={s.connectBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.connectEmoji}>⌚</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectTitle}>Connect your wearable</Text>
              <Text style={s.connectSub}>Track sleep, activity, and recovery so your plan stays grounded in real behaviour.</Text>
              <View style={s.impactPill}>
                <Text style={s.impactPillText}>⚡ Up to +60% stronger personalization when connected</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient colors={['#00A87F', '#00C999']} style={s.connectBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.connectEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectTitle}>Wearable connected</Text>
              <Text style={s.connectSub}>Your projection below includes a wearable boost.</Text>
            </View>
          </LinearGradient>
        )}

        <View style={[s.card, shadow.sm]}>
          <Text style={s.cardHead}>📱 Your devices</Text>
          {devices.map((device, i) => (
            <View key={device.id} style={[s.deviceRow, i < devices.length - 1 && s.deviceRowBorder]}>
              <Text style={s.deviceIcon}>{device.icon}</Text>
              <Text style={s.deviceName}>{device.name}</Text>
              <TouchableOpacity
                style={[s.deviceBtn, device.connected && s.deviceBtnConnected]}
                onPress={() => connectDevice(device)}
              >
                <Text style={[s.deviceBtnText, device.connected && s.deviceBtnTextConnected]}>
                  {device.connected ? '✓ Connected' : 'Connect'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {connected && (
          <>
            <Text style={s.sectionLabel}>LIVE DATA</Text>
            <View style={m.grid}>
              {Object.entries(metrics).map(([key, met]) => (
                <MetricTile
                  key={key}
                  icon={METRICS_ICONS[key]}
                  label={METRICS_LABELS[key]}
                  value={met.value}
                  unit={met.unit}
                  trend={met.trend}
                  trendStatus={met.trendStatus}
                />
              ))}
            </View>
            <Text style={s.sectionLabel}>INSIGHTS</Text>
            {insights.map((insight, i) => (
              <View key={i} style={[s.insightCard, shadow.sm, { borderLeftColor: sc(insight.severity) }]}>
                <Text style={s.insightEmoji}>{insight.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle}>{insight.title}</Text>
                  <Text style={s.insightDesc}>{insight.desc}</Text>
                  {insight.source && <Text style={s.insightSource}>📖 {insight.source}</Text>}
                  {insight.severity === 'warn' && (
                    <View style={[s.examImpact, { backgroundColor: sbg(insight.severity) }]}>
                      <Text style={[s.examImpactText, { color: sc(insight.severity) }]}>May relate to your exam trends</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── 2. Generate plan CTA ── */}
        <Text style={s.sectionLabel}>STEP 2 · YOUR PLAN</Text>
        {phase === 'idle' && (
          <TouchableOpacity style={[s.genBtn, shadow.sm]} onPress={handleGenerate} activeOpacity={0.88}>
            <LinearGradient colors={['#4056F4', '#7C5CFC']} style={s.genBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.genBtnIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.genBtnTitle}>Generate my plan & habits</Text>
                <Text style={s.genBtnSub}>Personalized suggestions from your results — nothing pre-filled until you tap.</Text>
              </View>
              <Text style={s.genBtnArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {phase === 'generating' && (
          <View style={[s.genCard, shadow.sm]}>
            <View style={s.genHead}>
              <View style={s.genAvatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.genTitle}>Building your habit suggestions…</Text>
                <Text style={s.genSub}>This uses your report context{connected ? ' and wearable status' : ''}.</Text>
              </View>
              <ActivityIndicator color={colors.blue} />
            </View>
            <View style={s.genSteps}>
              {GEN_STEPS.map((label, i) => (
                <View key={i} style={s.genStepRow}>
                  <TypingDots />
                  <Text style={s.genStepText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {phase === 'ready' && planHabits.length > 0 && (
          <View style={[s.card, shadow.sm]}>
            <Text style={s.cardHead}>🎯 Suggested habits</Text>
            {improvementPlan?.summary ? (
              <Text style={s.planSummary}>{improvementPlan.summary}</Text>
            ) : null}
            <Text style={s.cardSub}>Tap a row to select for your projection. Tap › for details.</Text>

            {planHabits.map((h, i) => {
              const checked = selectedLabels.has(h.habitLabel)
              const anim = habitAnims[i]
              const added = habits.some(x => x.text === h.habitLabel)
              if (!anim) return null
              return (
                <Animated.View
                  key={h.habitLabel || i}
                  style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                  }}
                >
                  <View style={[s.habitRow, shadow.sm]}>
                    <TouchableOpacity style={s.habitCheckWrap} onPress={() => toggleSelected(h.habitLabel)} activeOpacity={0.8}>
                      <View style={[s.habitCheck, checked && s.habitCheckOn]}>
                        {checked && <Text style={s.habitCheckMark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.habitMain} onPress={() => toggleSelected(h.habitLabel)} activeOpacity={0.85}>
                      <Text style={s.habitIcon}>{h.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.habitText}>{h.text}</Text>
                        <Text style={s.habitMeta}>+{h.impactContribution || 10} impact pts · {h.timeline}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDetailHabit(h)} style={s.habitChevBtn}>
                      <Text style={s.habitChev}>›</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )
            })}

            <TouchableOpacity style={s.regenBtn} onPress={handleRegenerate}>
              <Text style={s.regenBtnText}>↺ Regenerate plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {habits.length > 0 && (
          <View style={[s.card, shadow.sm]}>
            <Text style={s.cardHead}>⭐ My habits ({habits.length})</Text>
            {habits.map((h, i) => (
              <View key={i} style={s.savedHabitRow}>
                <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                <Text style={s.savedHabitText}>{h.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Bottom: projection from choices ── */}
        {phase === 'ready' && planHabits.length > 0 && (
          <>
            <Text style={s.sectionLabel}>EXPECTED IMPACT · YOUR CHOICES</Text>
            <ProjectionCard
              score={projection.score}
              habitPoints={projection.habitPoints}
              wearableBonus={projection.wearableBonus}
              selectedCount={selectedLabels.size}
              totalHabits={planHabits.length}
              connected={connected}
            />
          </>
        )}
      </ScrollView>

      <HabitDetailSheet
        habit={detailHabit}
        visible={!!detailHabit}
        onClose={() => setDetailHabit(null)}
        onAdd={h => addHabit({ text: h.habitLabel, icon: h.icon })}
        added={!!detailHabit && habits.some(x => x.text === detailHabit.habitLabel)}
      />
    </View>
  )
}

const ty = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue },
})

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.75 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lightgray, alignSelf: 'center', marginTop: 10 },
  content: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 15, fontWeight: font.black, color: colors.dark },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 11, color: colors.mid },
  card: { backgroundColor: colors.lightgray, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 8 },
  cardText: { fontSize: 13, color: colors.dark, lineHeight: 20 },
  addBtn: { backgroundColor: colors.navy, borderRadius: 14, padding: 14, alignItems: 'center' },
  addBtnDone: { backgroundColor: 'rgba(0,201,153,0.1)', borderWidth: 1.5, borderColor: colors.teal },
  addBtnText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})

const m = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47.5%', backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 3 },
  tileIcon: { fontSize: 20, marginBottom: 4 },
  tileValue: { fontSize: 20, fontWeight: font.black, color: colors.dark },
  tileUnit: { fontSize: 10, color: colors.mid },
  tileTrend: { fontSize: 11, fontWeight: font.semibold, marginTop: 4 },
  tileLabel: { fontSize: 10, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
})

const proj = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 18, borderWidth: 2, borderColor: 'rgba(64,86,244,0.12)' },
  title: { fontSize: 12, fontWeight: font.black, color: colors.navy, textTransform: 'uppercase', letterSpacing: 1.2 },
  sub: { fontSize: 12, color: colors.mid, marginTop: 4, marginBottom: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  scoreNum: { fontSize: 44, fontWeight: font.black, color: colors.blue, lineHeight: 48 },
  scoreOut: { fontSize: 14, color: colors.mid, fontWeight: font.semibold },
  track: { height: 12, backgroundColor: colors.lightgray, borderRadius: 6, overflow: 'hidden', marginBottom: 16 },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.teal },
  breakdown: { gap: 8 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakLabel: { fontSize: 12, color: colors.mid },
  breakVal: { fontSize: 12, fontWeight: font.bold, color: colors.dark },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.coral, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.mid },
  connectBanner: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  connectEmoji: { fontSize: 28, marginTop: 2 },
  connectTitle: { fontSize: 16, fontWeight: font.black, color: colors.white, marginBottom: 5 },
  connectSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 18, marginBottom: 10 },
  impactPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  impactPillText: { fontSize: 11, color: colors.white, fontWeight: font.bold },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 14, fontWeight: font.black, color: colors.dark, marginBottom: 8 },
  cardSub: { fontSize: 12, color: colors.mid, lineHeight: 18, marginBottom: 8 },
  planSummary: { fontSize: 12, color: colors.dark, lineHeight: 18, fontStyle: 'italic', marginBottom: 10, padding: 10, backgroundColor: colors.lightgray, borderRadius: 10 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  deviceRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  deviceIcon: { fontSize: 20 },
  deviceName: { flex: 1, fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  deviceBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  deviceBtnConnected: { backgroundColor: 'rgba(0,201,153,0.12)', borderWidth: 1.5, borderColor: colors.teal },
  deviceBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  deviceBtnTextConnected: { color: colors.teal },
  insightCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderLeftWidth: 3 },
  insightEmoji: { fontSize: 22, marginTop: 2 },
  insightTitle: { fontSize: 13, fontWeight: font.black, color: colors.dark, marginBottom: 5 },
  insightDesc: { fontSize: 12, color: colors.dark, lineHeight: 19, marginBottom: 5 },
  insightSource: { fontSize: 10, color: colors.mid, fontStyle: 'italic', marginBottom: 4 },
  examImpact: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  examImpactText: { fontSize: 10, fontWeight: font.bold },
  genBtn: { borderRadius: 16, overflow: 'hidden' },
  genBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  genBtnIcon: { fontSize: 26 },
  genBtnTitle: { fontSize: 16, fontWeight: font.black, color: colors.white, marginBottom: 4 },
  genBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 },
  genBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.55)' },
  genCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.12)' },
  genHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  genAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  genTitle: { fontSize: 14, fontWeight: font.bold, color: colors.dark },
  genSub: { fontSize: 11, color: colors.mid, marginTop: 2 },
  genSteps: { gap: 10 },
  genStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genStepText: { fontSize: 13, color: colors.dark },
  habitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  habitCheckWrap: { paddingRight: 4 },
  habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  habitCheckOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  habitCheckMark: { color: colors.white, fontSize: 11, fontWeight: font.black },
  habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  habitIcon: { fontSize: 20 },
  habitText: { fontSize: 13, fontWeight: font.semibold, color: colors.dark, lineHeight: 18 },
  habitMeta: { fontSize: 10, color: colors.mid, marginTop: 2 },
  habitChevBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  habitChev: { fontSize: 22, color: colors.mid },
  regenBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  regenBtnText: { fontSize: 12, color: colors.blue, fontWeight: font.semibold },
  savedHabitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  savedHabitText: { fontSize: 13, color: colors.dark },
})
