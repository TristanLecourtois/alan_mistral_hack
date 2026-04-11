import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  Animated, Modal, StyleSheet, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useApp } from '../context/AppContext'
import { fetchBiometrics, mapThryveToBiomarkers } from '../services/thryveService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }
function sbg(s) { return s === 'ok' ? 'rgba(0,201,153,0.12)' : s === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(244,96,124,0.12)' }

// ─── Typing dots ──────────────────────────────────────────────
function TypingDots({ color = colors.blue }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(480),
        ])
      )
    )
    Animated.parallel(anims).start()
    return () => anims.forEach(a => a.stop())
  }, [])
  return (
    <View style={ty.row}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[ty.dot, { backgroundColor: color, opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }] }]} />
      ))}
    </View>
  )
}

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

// ─── Habit detail sheet ───────────────────────────────────────
function HabitSheet({ habit, visible, onClose, onAdd, added }) {
  if (!habit) return null
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={sh.content}>
        <View style={sh.row}>
          <Text style={{ fontSize: 30 }}>{habit.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sh.title}>{habit.title}</Text>
            <Text style={sh.sub}>{habit.category}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={sh.closeBtn}><Text style={sh.closeX}>✕</Text></TouchableOpacity>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>📈 Potential impact on fertility</Text>
          <Text style={sh.cardText}>{habit.impact}</Text>
        </View>
        <View style={sh.card}>
          <Text style={sh.cardTitle}>⏱ When to see results</Text>
          <Text style={sh.cardText}>{habit.timeline}</Text>
        </View>
        {habit.wearableLink && (
          <View style={[sh.card, { backgroundColor: 'rgba(64,86,244,0.06)', borderWidth: 1, borderColor: 'rgba(64,86,244,0.15)' }]}>
            <Text style={sh.cardTitle}>⌚ Wearable tracking</Text>
            <Text style={sh.cardText}>{habit.wearableLink}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[sh.addBtn, added && sh.addBtnDone]}
          onPress={() => { onAdd(habit); onClose() }}
          disabled={added}
        >
          <Text style={[sh.addBtnText, added && { color: colors.teal }]}>
            {added ? '✓ Added to my plan' : '＋ Add to my plan'}
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  )
}

// ─── Animated habit card ──────────────────────────────────────
function HabitCard({ habit, onPress, added, entryAnim }) {
  return (
    <Animated.View style={[{ opacity: entryAnim, transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      <TouchableOpacity style={[hc.card, shadow.sm, added && hc.cardAdded]} onPress={onPress} activeOpacity={0.8}>
        <View style={[hc.iconWrap, { backgroundColor: sbg(habit.priority === 'high' ? 'alert' : habit.priority === 'med' ? 'warn' : 'ok') }]}>
          <Text style={{ fontSize: 22 }}>{habit.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={hc.title}>{habit.title}</Text>
          <Text style={hc.sub}>{habit.shortImpact}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {added
            ? <View style={hc.addedPill}><Text style={hc.addedPillText}>✓ In plan</Text></View>
            : <Text style={hc.chevron}>›</Text>
          }
          <View style={[hc.priorityPill, { backgroundColor: habit.priority === 'high' ? 'rgba(244,96,124,0.1)' : habit.priority === 'med' ? 'rgba(245,158,11,0.1)' : 'rgba(0,201,153,0.1)' }]}>
            <Text style={[hc.priorityTxt, { color: habit.priority === 'high' ? colors.coral : habit.priority === 'med' ? colors.amber : colors.teal }]}>
              {habit.priority === 'high' ? 'High impact' : habit.priority === 'med' ? 'Medium' : 'Maintenance'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}


// ─── Wearable biomarker tile ──────────────────────────────────
function WearableTile({ biomarker }) {
  const { icon, label, value, unit, trend, trendStatus, insight, priority } = biomarker
  const trendColor = trendStatus === 'ok' ? colors.teal : trendStatus === 'warn' ? colors.amber : colors.mid
  return (
    <View style={[wt.tile, shadow.sm]}>
      <View style={wt.topRow}>
        <Text style={wt.icon}>{icon}</Text>
        <View style={[wt.priorityDot, { backgroundColor: priority === 5 ? colors.coral : priority >= 4 ? colors.amber : colors.teal }]} />
      </View>
      <Text style={wt.value}>{value}</Text>
      <Text style={wt.unit}>{unit}</Text>
      <Text style={[wt.trend, { color: trendColor }]}>{trend}</Text>
      <Text style={wt.label}>{label}</Text>
      {insight && <Text style={wt.insight}>{insight}</Text>}
    </View>
  )
}

// ─── Wearable biomarkers data ─────────────────────────────────
const WEARABLE_BIOMARKERS = [
  {
    icon: '😴', label: 'Sleep', value: '6h42', unit: 'last night',
    trend: '↓ –38 min', trendStatus: 'warn',
    insight: 'Below 7h → hormone disruption',
    priority: 5,
  },
  {
    icon: '❤️', label: 'HRV', value: '34', unit: 'ms',
    trend: '↓ Low recovery', trendStatus: 'warn',
    insight: 'Low HRV = stress signal',
    priority: 5,
  },
  {
    icon: '💓', label: 'Resting HR', value: '72', unit: 'bpm',
    trend: '↑ +4 vs avg', trendStatus: 'warn',
    insight: 'Elevated → fatigue or stress',
    priority: 4,
  },
  {
    icon: '🌡️', label: 'Skin temp.', value: '+0.4°', unit: 'vs baseline',
    trend: '↑ Elevated', trendStatus: 'warn',
    insight: 'Heat impacts sperm quality directly',
    priority: 5,
  },
  {
    icon: '🏃', label: 'Activity', value: '4 218', unit: 'steps',
    trend: '→ Moderate', trendStatus: 'ok',
    insight: 'Good — avoid overtraining',
    priority: 4,
  },
  {
    icon: '🌬️', label: 'SpO₂', value: '97', unit: '%',
    trend: '→ Normal', trendStatus: 'ok',
    insight: 'Recovery & respiratory health',
    priority: 3,
  },
]

// ─── Generated plan data ──────────────────────────────────────
const GENERATED_HABITS = [
  {
    icon: '🌡️', title: 'Reduce heat exposure', category: 'Temperature',
    shortImpact: 'Direct impact on sperm quality', priority: 'high',
    impact: 'Elevated scrotal temperature (even +1°C) reduces sperm production by 10–40%. Your wearable shows elevated skin temperature.',
    timeline: 'Measurable improvement in 2–3 months (one sperm cycle).',
    wearableLink: 'We will track your skin temperature daily and alert you when readings are elevated.',
  },
  {
    icon: '😴', title: 'Sleep 7–8h consistently', category: 'Sleep',
    shortImpact: 'Boosts testosterone & HRV', priority: 'high',
    impact: 'Poor sleep suppresses testosterone by up to 15% and disrupts LH/FSH balance. Your HRV is low — sleep is the #1 recovery lever.',
    timeline: 'HRV improvement within 2–4 weeks. Hormonal recovery over 6–8 weeks.',
    wearableLink: 'HRV and sleep duration tracked nightly. Trend shown in your dashboard.',
  },
  {
    icon: '🥦', title: 'Antioxidant-rich diet', category: 'Nutrition',
    shortImpact: 'Protects sperm DNA integrity', priority: 'high',
    impact: 'Zinc, selenium, vitamin C and E reduce oxidative stress that damages sperm DNA. Can improve motility by 5–15%.',
    timeline: 'Visible on biomarkers after 2–3 months.',
    wearableLink: null,
  },
  {
    icon: '🧘', title: 'Daily stress management', category: 'Stress',
    shortImpact: 'Lower cortisol → better hormones', priority: 'med',
    impact: 'Chronic stress elevates cortisol which suppresses GnRH, reducing testosterone and sperm production.',
    timeline: 'Cortisol reduction measurable within 3–4 weeks of practice.',
    wearableLink: 'HRV is your stress biomarker. We track it after each session.',
  },
  {
    icon: '🏃', title: 'Moderate exercise only', category: 'Activity',
    shortImpact: 'Avoid overtraining signals', priority: 'med',
    impact: 'High-intensity training raises core temperature and cortisol. Moderate activity (30–45min, 4x/week) is associated with +8–12% motility.',
    timeline: 'Measurable after 6–8 weeks.',
    wearableLink: 'Activity intensity tracked via heart rate and steps. Weekly summary provided.',
  },
  {
    icon: '🚭', title: 'Eliminate tobacco & alcohol', category: 'Lifestyle',
    shortImpact: 'Smoking reduces motility –20%', priority: 'high',
    impact: 'Tobacco reduces sperm motility by up to 20% and damages DNA. Alcohol (>2 drinks/week) impacts morphology.',
    timeline: 'Improvement starts within 3 months of stopping.',
    wearableLink: null,
  },
]

const IMPACT_PROJECTIONS = [
  { label: 'Sperm motility', baseline: 28, projected: 42, unit: '%' },
  { label: 'Overall fertility score', baseline: 72, projected: 88, unit: '/100' },
  { label: 'Lifestyle compliance', baseline: 35, projected: 78, unit: '%' },
]

const DEVICES = [
  { id: 'apple_watch', icon: '⌚', name: 'Apple Watch', desc: 'HRV, sleep, heart rate, temp.' },
  { id: 'oura', icon: '💍', name: 'Oura Ring', desc: 'Sleep, HRV, temperature' },
  { id: 'garmin', icon: '🏃', name: 'Garmin', desc: 'Activity, HRV, SpO₂' },
]

// ─── Impact projection (simple stacked bars) ─────────────────
const IMPACT_ROWS = [
  { label: 'Sperm motility', icon: '🏊', baseline: 28, goal: 42, unit: '%', color: colors.blue },
  { label: 'Fertility score', icon: '⭐', baseline: 72, goal: 88, unit: '/100', color: colors.teal },
  { label: 'Habit compliance', icon: '✅', baseline: 35, goal: 78, unit: '%', color: colors.amber },
]

function ImpactBar2({ row, index }) {
  const barW = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(barW, { toValue: 1, duration: 800, delay: index * 120, useNativeDriver: false }).start()
  }, [])
  const gain = row.goal - row.baseline
  return (
    <View style={ip.row}>
      <View style={ip.rowHeader}>
        <Text style={ip.rowIcon}>{row.icon}</Text>
        <Text style={ip.rowLabel}>{row.label}</Text>
        <View style={[ip.gainPill, { backgroundColor: row.color + '18' }]}>
          <Text style={[ip.gainPillText, { color: row.color }]}>+{gain}{row.unit}</Text>
        </View>
      </View>
      <View style={ip.track}>
        <View style={[ip.baseBar, { width: `${row.baseline}%`, backgroundColor: '#E5E7EB' }]} />
        <Animated.View style={[ip.goalBar, {
          left: `${row.baseline}%`,
          width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${gain}%`] }),
          backgroundColor: row.color,
        }]} />
      </View>
      <View style={ip.trackLabels}>
        <Text style={ip.trackLabelLeft}>Now: {row.baseline}{row.unit}</Text>
        <Text style={[ip.trackLabelRight, { color: row.color }]}>Goal: {row.goal}{row.unit}</Text>
      </View>
    </View>
  )
}

function ImpactProjectionCard({ anyConnected }) {
  return (
    <View style={[s.card, shadow.sm]}>
      <Text style={s.cardHead}>📈 Projected impact</Text>
      <Text style={s.cardSub}>
        {anyConnected ? 'Based on your wearable data + clinical guidelines' : 'Clinical guidelines · Connect a device for personalized projections'}
      </Text>
      <View style={{ gap: 18, marginTop: 12 }}>
        {IMPACT_ROWS.map((row, i) => <ImpactBar2 key={row.label} row={row} index={i} />)}
      </View>
      <View style={s.cycleNote}>
        <Text style={s.cycleNoteText}>🔄 Sperm regenerate every 74 days — your next cycle starts today.</Text>
      </View>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function ImproveScreen() {
  const { analysisResult, habits, addHabit } = useApp()
  const insets = useSafeAreaInsets()

  const [connectedDevices, setConnectedDevices] = useState({})
  const [wearableBiomarkers, setWearableBiomarkers] = useState(null)
  const [wearableLoading, setWearableLoading] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | generating | plan
  const [displayedHabits, setDisplayedHabits] = useState([])
  const [habitAnims, setHabitAnims] = useState([])
  const [selectedHabit, setSelectedHabit] = useState(null)
  const [generatingStep, setGeneratingStep] = useState(0)

  const anyConnected = Object.values(connectedDevices).some(Boolean)

  async function connectDevice(id) {
    const isConnected = !connectedDevices[id]
    setConnectedDevices(prev => ({ ...prev, [id]: isConnected }))
    if (isConnected) {
      setWearableLoading(true)
      try {
        const biomarkers = await fetchBiometrics(id)
        setWearableBiomarkers(biomarkers)
      } finally {
        setWearableLoading(false)
      }
    } else {
      // disconnected last device
      const remaining = Object.entries(connectedDevices).filter(([k, v]) => k !== id && v)
      if (remaining.length === 0) setWearableBiomarkers(null)
    }
  }

  async function handleGenerate() {
    setPhase('generating')
    setGeneratingStep(0)
    const steps = [0, 1, 2, 3]
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 700))
      setGeneratingStep(step + 1)
    }
    // Animate habits in one by one
    const anims = GENERATED_HABITS.map(() => new Animated.Value(0))
    setHabitAnims(anims)
    setDisplayedHabits(GENERATED_HABITS)
    setPhase('plan')
    GENERATED_HABITS.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(anims[i], { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start()
      }, i * 110)
    })
  }

  const GENERATING_STEPS = [
    'Reading your biomarkers…',
    'Analyzing lifestyle signals…',
    'Prioritizing by impact…',
    'Building your personalized plan…',
  ]

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.tag}>ACT & IMPROVE</Text>
        <Text style={s.title}>Improve my results</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 14 }} showsVerticalScrollIndicator={false}>

        {/* ── 1. Connect your device (with +60% badge inline) ── */}
        <View style={[s.card, shadow.sm]}>
          <View style={s.deviceCardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardHead}>📱 Connect your device</Text>
              <Text style={s.cardSub}>Via Thryve · Your data stays private</Text>
            </View>
            {!anyConnected && (
              <View style={s.impactBadge}>
                <Text style={s.impactBadgeText}>⚡ +30%</Text>
              </View>
            )}
            {anyConnected && (
              <View style={s.connectedBadge}>
                <Text style={s.connectedBadgeText}>✓ Live</Text>
              </View>
            )}
          </View>
          {!anyConnected && (
            <Text style={s.deviceImpactHint}>Connect a wearable to unlock real-time personalization and track your progress.</Text>
          )}
          {DEVICES.map((device, i) => (
            <View key={device.id} style={[s.deviceRow, i < DEVICES.length - 1 && s.deviceBorder]}>
              <Text style={s.deviceIcon}>{device.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.deviceName}>{device.name}</Text>
                <Text style={s.deviceDesc}>{device.desc}</Text>
              </View>
              <TouchableOpacity
                style={[s.deviceBtn, connectedDevices[device.id] && s.deviceBtnOn]}
                onPress={() => connectDevice(device.id)}
                disabled={wearableLoading && !connectedDevices[device.id]}
              >
                {wearableLoading && !connectedDevices[device.id]
                  ? <TypingDots color={colors.blue} />
                  : <Text style={[s.deviceBtnText, connectedDevices[device.id] && s.deviceBtnTextOn]}>
                      {connectedDevices[device.id] ? '✓ Connected' : 'Connect'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── 2. Generate plan CTA ── */}
        {phase === 'idle' && (
          <TouchableOpacity style={[s.generateBtn, shadow.sm]} onPress={handleGenerate} activeOpacity={0.85}>
            <Text style={s.generateBtnIcon}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.generateBtnTitle}>Generate my improvement plan</Text>
              <Text style={s.generateBtnSub}>
                {anyConnected
                  ? 'Personalized with your wearable data + exam results'
                  : 'Based on your exam results — connect a device to personalize further'}
              </Text>
            </View>
            <Text style={s.generateBtnArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── 3. Generating animation ── */}
        {phase === 'generating' && (
          <View style={[s.card, s.generatingCard, shadow.sm]}>
            <View style={s.generatingHeader}>
              <View style={s.generatingAvatar}>
                <Text style={{ fontSize: 18 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.generatingTitle}>Building your plan…</Text>
                <Text style={s.generatingSub}>Analyzing {analysisResult?.biomarkers?.length || 4} biomarkers{anyConnected ? ' + wearable data' : ''}</Text>
              </View>
            </View>
            <View style={s.generatingSteps}>
              {GENERATING_STEPS.map((step, i) => (
                <View key={i} style={s.generatingStepRow}>
                  {i < generatingStep
                    ? <Text style={[s.generatingStepIcon, { color: colors.teal }]}>✓</Text>
                    : i === generatingStep
                      ? <TypingDots />
                      : <View style={s.generatingStepDot} />
                  }
                  <Text style={[s.generatingStepText, i < generatingStep && { color: colors.teal }, i > generatingStep && { opacity: 0.35 }]}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 4. Habit plan ── */}
        {phase === 'plan' && displayedHabits.length > 0 && (
          <>
            <View style={s.planHeader}>
              <Text style={s.planHeaderTitle}>🎯 Your personalized plan</Text>
              <Text style={s.planHeaderSub}>{displayedHabits.length} actions · Sorted by impact</Text>
            </View>

            {displayedHabits.map((habit, i) => (
              <HabitCard
                key={i}
                habit={habit}
                onPress={() => setSelectedHabit(habit)}
                added={habits.some(h => h.text === habit.title)}
                entryAnim={habitAnims[i] || new Animated.Value(1)}
              />
            ))}

            {/* ── 5. Impact projection ── */}
            <ImpactProjectionCard anyConnected={anyConnected} />

            {habits.length > 0 && (
              <View style={[s.card, shadow.sm]}>
                <Text style={s.cardHead}>⭐ My plan ({habits.length} actions)</Text>
                {habits.map((h, i) => (
                  <View key={i} style={[s.habitRow, i > 0 && s.habitRowBorder]}>
                    <Text style={{ fontSize: 18 }}>{h.icon}</Text>
                    <Text style={s.habitText}>{h.text}</Text>
                    <View style={s.habitActivePill}><Text style={s.habitActivePillText}>Active</Text></View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── 6. Wearable biomarkers (when connected) ── */}
        {anyConnected && (
          <>
            <Text style={s.sectionLabel}>
              {wearableBiomarkers ? 'LIVE BIOMARKERS · Via Thryve' : 'DEMO BIOMARKERS · Connect to see your data'}
            </Text>
            <Text style={s.sectionSub}>The metrics below are directly linked to your fertility results</Text>
            {wearableLoading && (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <TypingDots color={colors.blue} />
                <Text style={[s.cardSub, { marginTop: 10 }]}>Fetching your wearable data…</Text>
              </View>
            )}
            {!wearableLoading && (
              <View style={s.biometricsGrid}>
                {(wearableBiomarkers || WEARABLE_BIOMARKERS).map((bio, i) => (
                  <WearableTile key={i} biomarker={bio} />
                ))}
              </View>
            )}

            {/* Smart combinations */}
            {!wearableLoading && (
              <View style={[s.card, shadow.sm]}>
                <Text style={s.cardHead}>🔗 Today's key signals</Text>
                <Text style={s.cardSub}>Combined insights from your wearable</Text>
                <View style={{ gap: 10, marginTop: 8 }}>
                  {(wearableBiomarkers || WEARABLE_BIOMARKERS).filter(b => b.trendStatus === 'warn').slice(0, 3).map((bio, i) => (
                    <View key={i} style={[s.insightRow, { borderLeftColor: colors.amber }]}>
                      <Text style={s.insightEmoji}>{bio.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.insightTitle}>{bio.label}: {bio.value} {bio.unit}</Text>
                        <Text style={s.insightDesc}>{bio.insight}</Text>
                      </View>
                    </View>
                  ))}
                  {(wearableBiomarkers || WEARABLE_BIOMARKERS).filter(b => b.trendStatus === 'warn').length === 0 && (
                    <View style={[s.insightRow, { borderLeftColor: colors.teal }]}>
                      <Text style={s.insightEmoji}>✅</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.insightTitle}>All metrics look good</Text>
                        <Text style={s.insightDesc}>Keep up your current habits — recovery and activity are well balanced.</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView>

      <HabitSheet
        habit={selectedHabit}
        visible={!!selectedHabit}
        onClose={() => setSelectedHabit(null)}
        onAdd={h => addHabit({ text: h.title, icon: h.icon })}
        added={selectedHabit && habits.some(h => h.text === selectedHabit.title)}
      />
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────
const ty = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center', width: 30, height: 20 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
})

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.78 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lightgray, alignSelf: 'center', marginTop: 10 },
  content: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, fontWeight: font.black, color: colors.dark, marginBottom: 2 },
  sub: { fontSize: 11, color: colors.mid },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 11, color: colors.mid },
  card: { backgroundColor: colors.lightgray, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 8 },
  cardText: { fontSize: 13, color: colors.dark, lineHeight: 21 },
  addBtn: { backgroundColor: colors.navy, borderRadius: 14, padding: 14, alignItems: 'center' },
  addBtnDone: { backgroundColor: 'rgba(0,201,153,0.1)', borderWidth: 1.5, borderColor: colors.teal },
  addBtnText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})

const hc = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardAdded: { borderWidth: 1.5, borderColor: colors.teal },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: font.black, color: colors.dark, marginBottom: 3 },
  sub: { fontSize: 11, color: colors.mid },
  addedPill: { backgroundColor: 'rgba(0,201,153,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  addedPillText: { fontSize: 10, fontWeight: font.bold, color: colors.teal },
  chevron: { fontSize: 20, color: colors.mid },
  priorityPill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priorityTxt: { fontSize: 9, fontWeight: font.bold },
})


const ip = StyleSheet.create({
  row: { gap: 6 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rowIcon: { fontSize: 15 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  gainPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gainPillText: { fontSize: 11, fontWeight: font.black },
  track: { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  baseBar: { height: '100%', borderRadius: 5 },
  goalBar: { position: 'absolute', top: 0, height: '100%', borderRadius: 5 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trackLabelLeft: { fontSize: 10, color: colors.mid },
  trackLabelRight: { fontSize: 10, fontWeight: font.semibold },
})

const wt = StyleSheet.create({
  tile: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  icon: { fontSize: 20 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  value: { fontSize: 20, fontWeight: font.black, color: colors.dark },
  unit: { fontSize: 10, color: colors.mid },
  trend: { fontSize: 11, fontWeight: font.semibold, marginTop: 4 },
  label: { fontSize: 10, color: colors.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  insight: { fontSize: 10, color: colors.mid, fontStyle: 'italic', marginTop: 5, lineHeight: 14 },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.coral, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.mid },
  sectionSub: { fontSize: 11, color: colors.mid, marginTop: -8 },
  // Device card header
  deviceCardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  impactBadge: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  impactBadgeText: { fontSize: 12, color: colors.white, fontWeight: font.black },
  connectedBadge: { backgroundColor: 'rgba(0,201,153,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.teal },
  connectedBadgeText: { fontSize: 12, color: colors.teal, fontWeight: font.bold },
  deviceImpactHint: { fontSize: 12, color: colors.mid, lineHeight: 18, marginBottom: 10 },
  // Cards
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 14, fontWeight: font.black, color: colors.dark, marginBottom: 4 },
  cardSub: { fontSize: 12, color: colors.mid, marginBottom: 4, lineHeight: 18 },
  // Devices
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  deviceBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  deviceIcon: { fontSize: 22 },
  deviceName: { fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  deviceDesc: { fontSize: 11, color: colors.mid, marginTop: 1 },
  deviceBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  deviceBtnOn: { backgroundColor: 'rgba(0,201,153,0.12)', borderWidth: 1.5, borderColor: colors.teal },
  deviceBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  deviceBtnTextOn: { color: colors.teal },
  // Generate CTA
  generateBtn: { backgroundColor: colors.navy, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  generateBtnIcon: { fontSize: 28 },
  generateBtnTitle: { fontSize: 15, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  generateBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 16 },
  generateBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.4)' },
  // Generating
  generatingCard: { borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.12)' },
  generatingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  generatingAvatar: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  generatingTitle: { fontSize: 14, fontWeight: font.bold, color: colors.dark },
  generatingSub: { fontSize: 11, color: colors.mid, marginTop: 2 },
  generatingSteps: { gap: 12, paddingLeft: 2 },
  generatingStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 22 },
  generatingStepIcon: { fontSize: 14, width: 30, textAlign: 'center' },
  generatingStepDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.lightgray, marginLeft: 11 },
  generatingStepText: { fontSize: 13, color: colors.dark },
  // Plan header
  planHeader: { paddingHorizontal: 4, gap: 2 },
  planHeaderTitle: { fontSize: 16, fontWeight: font.black, color: colors.dark },
  planHeaderSub: { fontSize: 12, color: colors.mid },
  // Impact projection
  cycleNote: { marginTop: 14, backgroundColor: 'rgba(64,86,244,0.06)', borderRadius: 10, padding: 10 },
  cycleNoteText: { fontSize: 11, color: colors.blue, lineHeight: 17 },
  // Habits in plan
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  habitRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  habitText: { flex: 1, fontSize: 13, color: colors.dark, fontWeight: font.medium },
  habitActivePill: { backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  habitActivePillText: { fontSize: 10, fontWeight: font.bold, color: colors.teal },
  // Biometrics grid
  biometricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Insights
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.lightgray, borderRadius: 12, padding: 12, borderLeftWidth: 3 },
  insightEmoji: { fontSize: 18, marginTop: 1 },
  insightTitle: { fontSize: 12, fontWeight: font.black, color: colors.dark, marginBottom: 4 },
  insightDesc: { fontSize: 11, color: colors.dark, lineHeight: 17 },
})
