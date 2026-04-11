import { useRef, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Modal, Animated, StyleSheet, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }
function sbg(s) { return s === 'ok' ? 'rgba(0,201,153,0.1)' : s === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(244,96,124,0.1)' }
function slabel(s) { return s === 'ok' ? 'Normal' : s === 'warn' ? 'Slightly low' : 'Below norm' }
function semoji(s) { return s === 'ok' ? '🟢' : s === 'warn' ? '🟠' : '🔴' }

// ─── Gauge ───────────────────────────────────────────────────
function GaugeBar({ bio }) {
  const value    = parseFloat(bio.value) || 0
  const normVal  = parseFloat(bio.normValue)
  const hasNorm  = !isNaN(normVal) && normVal > 0
  const norm     = hasNorm ? normVal : 0
  const max      = parseFloat(bio.maxDisplayValue) || (hasNorm ? norm * 2 : value * 2 || 1)
  const valuePct = Math.min((value / max) * 100, 100)
  const normPct  = hasNorm ? Math.min((norm / max) * 100, 100) : 50
  const fillW    = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fillW, { toValue: valuePct, duration: 650, delay: 150, useNativeDriver: false }).start()
  }, [])
  return (
    <View style={g.wrap}>
      <View style={g.track}>
        {hasNorm && <View style={[g.normZone, { left: `${normPct}%`, right: 0 }]} />}
        <Animated.View style={[g.fill, { width: fillW.interpolate({ inputRange: [0,100], outputRange: ['0%','100%'] }), backgroundColor: sc(bio.status) }]} />
        {hasNorm && <View style={[g.normLine, { left: `${normPct}%` }]} />}
      </View>
      <View style={g.labelsRow}>
        <Text style={g.edge}>0 {bio.unit}</Text>
        {hasNorm && (
          <Text style={[g.normLabel, { left: `${normPct}%` }]}>min {norm} {bio.unit}</Text>
        )}
        <Text style={g.edge}>{max} {bio.unit}</Text>
      </View>
      <View style={g.pills}>
        <View style={[g.pill, { backgroundColor: sbg(bio.status) }]}>
          <Text style={[g.pillTxt, { color: sc(bio.status) }]}>Your value: {bio.value} {bio.unit}</Text>
        </View>
        <View style={[g.pill, { backgroundColor: sbg(bio.status) }]}>
          <Text style={[g.pillTxt, { color: sc(bio.status) }]}>{slabel(bio.status)}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Biomarker detail sheet ──────────────────────────────────
function BioSheet({ bio, visible, onClose }) {
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
  if (!bio) return null
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.backdrop, { opacity: bgOp }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[sh.container, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        <View style={sh.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sh.scrollContent}>
          <View style={sh.headerRow}>
            <Text style={sh.emoji}>{semoji(bio.status)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={sh.name}>{bio.name}</Text>
              <Text style={sh.ref}>{bio.norm}</Text>
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
      </Animated.View>
    </Modal>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function ResultsScreen() {
  const { navigate } = useNav()
  const { analysisResult } = useApp()
  const insets = useSafeAreaInsets()
  const [selectedBio, setSelectedBio] = useState(null)

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])

  const biomarkers = analysisResult?.biomarkers || []
  const summary = analysisResult?.copilotSummary || ''
  const hasIssues = biomarkers.some(b => b.status !== 'ok')
  const warnCount = biomarkers.filter(b => b.status !== 'ok').length

  const NAV_CARDS = [
    {
      icon: '📋',
      title: 'Prepare my appointment',
      desc: 'AI-generated questions + PDF report',
      screen: SCREENS.PREPARE,
      gradient: ['#4056F4', '#7C5CFC'],
    },
    {
      icon: '💪',
      title: 'Improve my results',
      desc: 'Personalized actions + connect wearables',
      screen: SCREENS.IMPROVE,
      gradient: ['#00A87F', '#00C999'],
    },
    {
      icon: '💬',
      title: 'I have questions',
      desc: 'Chat with Copilot · Powered by Mistral',
      screen: SCREENS.COPILOT,
      gradient: ['#F4607C', '#F59E0B'],
    },
  ]

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.tag}>{analysisResult?.documentType?.toUpperCase() || 'RESULTS'} · {analysisResult?.date || ''}</Text>
        <Text style={s.title}>Here's what matters</Text>
      </View>

      <Animated.ScrollView
        style={[s.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Score strip ── */}
        {analysisResult?.globalScore != null && (
          <LinearGradient
            colors={hasIssues ? ['#1B2B6B', '#4056F4'] : ['#00A87F', '#00C999']}
            style={s.scoreStrip}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.scoreLabel}>{hasIssues ? '💆 Nothing urgent' : '✅ Everything looks good'}</Text>
              <Text style={s.scoreGuideline}>Sperm fully regenerate every 74 days — your next cycle starts today.</Text>
            </View>
            <View style={s.scoreBadge}>
              <Text style={s.scoreNum}>{analysisResult.globalScore}</Text>
              <Text style={s.scoreDen}>/100</Text>
            </View>
          </LinearGradient>
        )}

        {/* ── Biomarkers ── */}
        <Text style={s.sectionLabel}>YOUR BIOMARKERS · tap to explore</Text>
        {biomarkers.map((b, i) => (
          <TouchableOpacity key={i} style={[s.bioRow, shadow.sm]} onPress={() => setSelectedBio(b)} activeOpacity={0.78}>
            <View style={[s.bioBar, { backgroundColor: sc(b.status) }]} />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={s.bioName}>{b.name}</Text>
              <Text style={s.bioRef}>{b.norm}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={[s.bioVal, { color: sc(b.status) }]}>{b.value} <Text style={s.bioUnit}>{b.unit}</Text></Text>
              <View style={[s.bioPill, { backgroundColor: sbg(b.status) }]}>
                <Text style={[s.bioPillTxt, { color: sc(b.status) }]}>{slabel(b.status)}</Text>
              </View>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* ── Copilot summary ── */}
        {summary ? (
          <View style={[s.summaryCard, shadow.sm]}>
            <View style={s.summaryIconWrap}>
              <Text style={{ fontSize: 18 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryLabel}>Copilot summary</Text>
              <Text style={s.summaryText}>{summary}</Text>
            </View>
          </View>
        ) : null}

        {/* ── What do you want to do? ── */}
        <Text style={s.sectionLabel}>WHAT WOULD YOU LIKE TO DO?</Text>
        {NAV_CARDS.map((card, i) => (
          <TouchableOpacity key={i} onPress={() => navigate(card.screen)} activeOpacity={0.85} style={shadow.sm}>
            <LinearGradient colors={card.gradient} style={s.navCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.navCardIcon}>{card.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.navCardTitle}>{card.title}</Text>
                <Text style={s.navCardDesc}>{card.desc}</Text>
              </View>
              <Text style={s.navCardArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}

      </Animated.ScrollView>

      <BioSheet bio={selectedBio} visible={!!selectedBio} onClose={() => setSelectedBio(null)} />
    </View>
  )
}

const g = StyleSheet.create({
  wrap: { marginVertical: 14 },
  track: { height: 14, backgroundColor: colors.lightgray, borderRadius: 7, overflow: 'hidden', position: 'relative', marginBottom: 6 },
  normZone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,201,153,0.15)' },
  fill: { height: '100%', borderRadius: 7 },
  normLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.teal },
  labelsRow: { position: 'relative', height: 16 },
  edge: { position: 'absolute', fontSize: 9, color: colors.mid },
  normLabel: { position: 'absolute', fontSize: 9, color: colors.teal, fontWeight: font.semibold, transform: [{ translateX: -18 }] },
  pills: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 12, fontWeight: font.bold },
})

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.85 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lightgray, alignSelf: 'center', marginTop: 10 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  emoji: { fontSize: 24 },
  name: { fontSize: 18, fontWeight: font.black, color: colors.dark },
  ref: { fontSize: 12, color: colors.mid, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 11, color: colors.mid },
  card: { backgroundColor: colors.lightgray, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 8 },
  cardText: { fontSize: 13, color: colors.dark, lineHeight: 21 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  tipIcon: { fontSize: 15, marginTop: 1 },
  tipText: { flex: 1, fontSize: 12, color: colors.dark, lineHeight: 19 },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.blue, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.mid },
  // Score strip
  scoreStrip: { borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreLabel: { fontSize: 15, fontWeight: font.black, color: colors.white, marginBottom: 4 },
  scoreGuideline: { fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 17 },
  scoreBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 24, width: 54, height: 54, justifyContent: 'center' },
  scoreNum: { fontSize: 20, fontWeight: font.black, color: colors.white, lineHeight: 22 },
  scoreDen: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  // Biomarkers
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 14, padding: 14, overflow: 'hidden' },
  bioBar: { width: 4, position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 2 },
  bioName: { fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  bioRef: { fontSize: 11, color: colors.mid, marginTop: 2 },
  bioVal: { fontSize: 15, fontWeight: font.black },
  bioUnit: { fontSize: 11, fontWeight: font.regular, color: colors.mid },
  bioPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  bioPillTxt: { fontSize: 9, fontWeight: font.bold },
  chevron: { fontSize: 20, color: colors.mid },
  // Summary
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: colors.blue },
  summaryIconWrap: { width: 34, height: 34, backgroundColor: colors.lightgray, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: font.bold, color: colors.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  summaryText: { fontSize: 13, color: colors.dark, lineHeight: 21 },
  // Nav cards
  navCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  navCardIcon: { fontSize: 26 },
  navCardTitle: { fontSize: 15, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  navCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  navCardArrow: { fontSize: 20, color: 'rgba(255,255,255,0.6)' },
})
