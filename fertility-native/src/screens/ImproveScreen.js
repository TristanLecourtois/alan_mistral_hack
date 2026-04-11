import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Animated, Modal, StyleSheet, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useApp } from '../context/AppContext'
import { DEMO_BIOMETRICS } from '../services/thryveService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }
function sbg(s) { return s === 'ok' ? 'rgba(0,201,153,0.12)' : s === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(244,96,124,0.12)' }

// ─── Slide-up sheet ──────────────────────────────────────────
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

// ─── Recommendation sheet ─────────────────────────────────────
function RecoSheet({ reco, visible, onClose, onAdd, added }) {
  if (!reco) return null
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={sh.content}>
        <View style={sh.row}>
          <Text style={{ fontSize: 28 }}>{reco.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sh.title}>{reco.text}</Text>
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
        <TouchableOpacity style={[sh.addBtn, added && sh.addBtnDone]} onPress={() => { onAdd(reco); onClose() }} disabled={added}>
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

// ─── Wearable impact bar ──────────────────────────────────────
function ImpactBar({ label, withoutVal, withVal, unit, connected }) {
  const barW = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(barW, { toValue: 1, duration: 900, delay: 200, useNativeDriver: false }).start()
  }, [])
  return (
    <View style={im.row}>
      <View style={im.trackWrap}>
        <Text style={im.label}>{label}</Text>
        <View style={im.track}>
          <Animated.View style={[im.fill, {
            width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${withoutVal}%`] }),
            backgroundColor: connected ? colors.teal : colors.mid,
          }]} />
          {connected && (
            <Animated.View style={[im.fill2, {
              width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${withVal - withoutVal}%`] }),
              backgroundColor: 'rgba(0,201,153,0.3)',
            }]} />
          )}
        </View>
        <View style={im.labelsRow}>
          <Text style={im.baselineLabel}>Without</Text>
          {connected && <Text style={im.connectedLabel}>+{withVal - withoutVal}% with wearables</Text>}
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
const METRICS_ICONS = { sleep: '😴', hrv: '💓', steps: '🚶', basalTemp: '🌡️' }
const METRICS_LABELS = { sleep: 'Sleep', hrv: 'HRV', steps: 'Steps', basalTemp: 'Basal temp.' }
const IMPACT_DATA = [
  { label: 'Motility improvement', withoutVal: 42, withVal: 68 },
  { label: 'Lifestyle compliance', withoutVal: 35, withVal: 72 },
  { label: 'Appointment readiness', withoutVal: 50, withVal: 85 },
]

export default function ImproveScreen() {
  const { analysisResult, habits, addHabit } = useApp()
  const insets = useSafeAreaInsets()

  const [connected, setConnected] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedReco, setSelectedReco] = useState(null)
  const [devices, setDevices] = useState(DEMO_BIOMETRICS.devices)

  const recommendations = analysisResult?.recommendations || []
  const metrics = DEMO_BIOMETRICS.metrics
  const insights = DEMO_BIOMETRICS.insights

  function connectDevice(device) {
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, connected: !d.connected } : d))
    const anyConnected = devices.some(d => d.id !== device.id && d.connected) || !device.connected
    setConnected(anyConnected || !device.connected)
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.tag}>ACT & IMPROVE</Text>
        <Text style={s.title}>Improve my results</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Recommendations ── */}
        <Text style={s.sectionLabel}>WHAT YOU CAN DO NOW · tap for impact</Text>
        {recommendations.map((r, i) => {
          const added = habits.some(h => h.text === r.habitLabel)
          return (
            <TouchableOpacity key={i} style={[s.recoRow, shadow.sm]} onPress={() => setSelectedReco(r)} activeOpacity={0.78}>
              <Text style={s.recoIcon}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.recoText}>{r.text}</Text>
                <Text style={s.recoTimeline}>{r.timeline}</Text>
              </View>
              {added
                ? <View style={s.habitDone}><Text style={s.habitDoneText}>✓ habit</Text></View>
                : <Text style={s.chevron}>›</Text>
              }
            </TouchableOpacity>
          )
        })}

        {habits.length > 0 && (
          <View style={[s.card, shadow.sm]}>
            <Text style={s.cardHead}>⭐ My habits ({habits.length})</Text>
            {habits.map((h, i) => (
              <View key={i} style={s.habitRow}>
                <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                <Text style={s.habitText}>{h.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Connect wearables ── */}
        {!connected ? (
          <LinearGradient colors={['#1B2B6B', '#4056F4']} style={s.connectBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.connectEmoji}>⌚</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectTitle}>Connect your wearable</Text>
              <Text style={s.connectSub}>See your real-time data and get a personalized improvement plan.</Text>
              <View style={s.impactPill}>
                <Text style={s.impactPillText}>⚡ Up to +60% impact on your results</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient colors={['#00A87F', '#00C999']} style={s.connectBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.connectEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectTitle}>Wearable connected</Text>
              <Text style={s.connectSub}>Your lifestyle data is now factored into your plan.</Text>
            </View>
          </LinearGradient>
        )}

        {/* ── Device list ── */}
        <View style={[s.card, shadow.sm]}>
          <Text style={s.cardHead}>📱 Connect your devices</Text>
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

        {/* ── Impact visualization ── */}
        <View style={[s.card, shadow.sm]}>
          <Text style={s.cardHead}>📈 Projected impact with wearables</Text>
          <Text style={s.cardSub}>{connected ? 'Based on your connected data' : 'Connect a device to activate personalized tracking'}</Text>
          <View style={{ gap: 14, marginTop: 10 }}>
            {IMPACT_DATA.map((item, i) => (
              <ImpactBar key={i} {...item} connected={connected} />
            ))}
          </View>
        </View>

        {/* ── Wearable data & insights (when connected) ── */}
        {connected && (
          <>
            <Text style={s.sectionLabel}>LIVE DATA · Updated just now</Text>
            <View style={m.grid}>
              {Object.entries(metrics).map(([key, m]) => (
                <MetricTile
                  key={key}
                  icon={METRICS_ICONS[key]}
                  label={METRICS_LABELS[key]}
                  value={m.value}
                  unit={m.unit}
                  trend={m.trend}
                  trendStatus={m.trendStatus}
                />
              ))}
            </View>

            <Text style={s.sectionLabel}>INSIGHTS · What your data tells us</Text>
            {insights.map((insight, i) => (
              <View key={i} style={[s.insightCard, shadow.sm, { borderLeftColor: sc(insight.severity) }]}>
                <Text style={s.insightEmoji}>{insight.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle}>{insight.title}</Text>
                  <Text style={s.insightDesc}>{insight.desc}</Text>
                  {insight.source && (
                    <Text style={s.insightSource}>📖 {insight.source}</Text>
                  )}
                  {/* Link to exam result */}
                  {insight.severity === 'warn' && (
                    <View style={[s.examImpact, { backgroundColor: sbg(insight.severity) }]}>
                      <Text style={[s.examImpactText, { color: sc(insight.severity) }]}>
                        ⚠ May affect your exam results
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      <RecoSheet
        reco={selectedReco}
        visible={!!selectedReco}
        onClose={() => setSelectedReco(null)}
        onAdd={r => addHabit({ text: r.habitLabel, icon: r.icon })}
        added={selectedReco && habits.some(h => h.text === selectedReco.habitLabel)}
      />
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────
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

const im = StyleSheet.create({
  row: { gap: 4 },
  trackWrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  track: { height: 10, backgroundColor: colors.lightgray, borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  fill2: { height: '100%', borderRadius: 5 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  baselineLabel: { fontSize: 9, color: colors.mid },
  connectedLabel: { fontSize: 9, color: colors.teal, fontWeight: font.semibold },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.coral, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.mid },
  // Recommendations
  recoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14 },
  recoIcon: { fontSize: 22 },
  recoText: { fontSize: 13, color: colors.dark, lineHeight: 19, marginBottom: 2 },
  recoTimeline: { fontSize: 10, color: colors.mid, fontStyle: 'italic' },
  habitDone: { backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  habitDoneText: { fontSize: 10, fontWeight: font.bold, color: colors.teal },
  chevron: { fontSize: 20, color: colors.mid },
  // Habits card
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 14, fontWeight: font.black, color: colors.dark, marginBottom: 10 },
  cardSub: { fontSize: 12, color: colors.mid, marginBottom: 4 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  habitText: { fontSize: 13, color: colors.dark },
  // Connect banner
  connectBanner: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  connectEmoji: { fontSize: 28, marginTop: 2 },
  connectTitle: { fontSize: 16, fontWeight: font.black, color: colors.white, marginBottom: 5 },
  connectSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 18, marginBottom: 10 },
  impactPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  impactPillText: { fontSize: 11, color: colors.white, fontWeight: font.bold },
  // Devices
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  deviceRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  deviceIcon: { fontSize: 20 },
  deviceName: { flex: 1, fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  deviceBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  deviceBtnConnected: { backgroundColor: 'rgba(0,201,153,0.12)', borderWidth: 1.5, borderColor: colors.teal },
  deviceBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  deviceBtnTextConnected: { color: colors.teal },
  // Insights
  insightCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderLeftWidth: 3 },
  insightEmoji: { fontSize: 22, marginTop: 2 },
  insightTitle: { fontSize: 13, fontWeight: font.black, color: colors.dark, marginBottom: 5 },
  insightDesc: { fontSize: 12, color: colors.dark, lineHeight: 19, marginBottom: 5 },
  insightSource: { fontSize: 10, color: colors.mid, fontStyle: 'italic', marginBottom: 4 },
  examImpact: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  examImpactText: { fontSize: 10, fontWeight: font.bold },
})
