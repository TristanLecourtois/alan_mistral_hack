import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { analyzeDocument } from '../services/mistralService'
import { MOCK_SPERM_ANALYSIS } from '../services/mockData'
import { colors, font, shadow } from '../theme'

const STEPS = [
  { icon: '📄', label: 'Reading document', desc: 'Mistral OCR — extracting text & values' },
  { icon: '📊', label: 'Comparing to WHO norms', desc: 'Matching against reference ranges' },
  { icon: '🧠', label: 'AI interpretation', desc: 'Mistral Small — contextualizing results' },
  { icon: '💬', label: 'Generating your summary', desc: 'Preparing personalized report' },
]

function StepRow({ step, state, delay }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current

  useEffect(() => {
    if (state !== 'hidden') {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
      ]).start()
    }
  }, [state])

  const isDone = state === 'done'
  const isActive = state === 'active'

  return (
    <Animated.View style={[
      styles.stepRow,
      isDone && styles.stepDone,
      isActive && styles.stepActive,
      { opacity, transform: [{ translateY }] },
    ]}>
      <View style={[styles.stepIconWrap, isDone && styles.stepIconDone, isActive && styles.stepIconActive]}>
        <Text style={styles.stepIcon}>{isDone ? '✓' : step.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>{step.label}</Text>
        <Text style={styles.stepDesc}>{step.desc}</Text>
      </View>
      {isActive && <ActivityDots />}
    </Animated.View>
  )
}

function ActivityDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.timing(dot, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    ).start()
    anim(dot1, 0)
    anim(dot2, 140)
    anim(dot3, 280)
  }, [])

  return (
    <View style={styles.dots}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
      ))}
    </View>
  )
}

function SuccessScreen({ result, onContinue }) {
  const scale = useRef(new Animated.Value(0.7)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [])

  const detectedAs = result?.detectedAs || result?.documentType || 'Medical document'
  const date = result?.date || ''

  return (
    <Animated.View style={[styles.successWrap, { opacity }]}>
      <LinearGradient colors={['#00A87F', '#00C999']} style={styles.successCard}>
        <Animated.View style={[styles.successIcon, { transform: [{ scale }] }]}>
          <Text style={{ fontSize: 44 }}>✅</Text>
        </Animated.View>
        <Text style={styles.successLabel}>Document recognized</Text>
        <Text style={styles.successTitle}>{detectedAs}</Text>
        {date ? <Text style={styles.successDate}>{date}</Text> : null}

        <View style={styles.successDivider} />

        <View style={styles.successMeta}>
          <View style={styles.successMetaItem}>
            <Text style={styles.successMetaNum}>{result?.biomarkers?.length || 4}</Text>
            <Text style={styles.successMetaLabel}>biomarkers{'\n'}extracted</Text>
          </View>
          <View style={styles.successMetaItem}>
            <Text style={styles.successMetaNum}>{result?.biomarkers?.filter(b => b.status !== 'ok').length || 0}</Text>
            <Text style={styles.successMetaLabel}>points to{'\n'}discuss</Text>
          </View>
          <View style={styles.successMetaItem}>
            <Text style={styles.successMetaNum}>{result?.globalScore || '—'}</Text>
            <Text style={styles.successMetaLabel}>overall{'\n'}score</Text>
          </View>
        </View>
      </LinearGradient>

      <Text style={styles.successBy}>Analyzed by Mistral OCR 3 + Small 4</Text>

      <TouchableOpacity style={[styles.continueBtn, shadow.md]} onPress={onContinue}>
        <Text style={styles.continueBtnText}>See my results →</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function AnalyseScreen() {
  const { navigate } = useNav()
  const { uploadedDocument, setAnalysisResult } = useApp()
  const insets = useSafeAreaInsets()
  const spin = useRef(new Animated.Value(0)).current
  const [stepStates, setStepStates] = useState(['active', 'hidden', 'hidden', 'hidden'])
  const [done, setDone] = useState(false)
  const [result, setResult] = useState(null)

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    )
    loop.start()

    const STEP_MS = 900

    const timers = STEPS.map((_, i) => {
      if (i === 0) return null
      return setTimeout(() => {
        setStepStates(prev => prev.map((s, idx) => {
          if (idx === i - 1) return 'done'
          if (idx === i) return 'active'
          return s
        }))
      }, i * STEP_MS)
    })

    async function run() {
      // Demo file → skip all API calls, use mock data directly
      const res = uploadedDocument?.isDemoFile
        ? MOCK_SPERM_ANALYSIS
        : await analyzeDocument(
            uploadedDocument?.uri,
            uploadedDocument?.name || 'document.pdf'
          )
      // Make sure all steps finish visually before showing success
      const minDelay = STEPS.length * STEP_MS + 400
      setTimeout(() => {
        loop.stop()
        setStepStates(['done', 'done', 'done', 'done'])
        setResult(res)
        setAnalysisResult(res)
        setDone(true)
      }, minDelay)
    }

    run()

    return () => {
      timers.forEach(t => t && clearTimeout(t))
      loop.stop()
    }
  }, [])

  if (done && result) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SuccessScreen result={result} onContinue={() => navigate(SCREENS.PROFILE)} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.spinnerWrap}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Text style={styles.emoji}>🔬</Text>
      </View>

      <Text style={styles.title}>Analyzing your results…</Text>
      <Text style={styles.docName} numberOfLines={1}>{uploadedDocument?.name || 'Your document'}</Text>

      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          stepStates[i] !== 'hidden' && (
            <StepRow key={i} step={step} state={stepStates[i]} delay={0} />
          )
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  spinnerWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ring: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(64,86,244,0.12)', borderTopColor: colors.blue,
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: font.black, color: colors.navy, textAlign: 'center', marginBottom: 6 },
  docName: { fontSize: 12, color: colors.mid, marginBottom: 28, maxWidth: '80%', textAlign: 'center' },
  steps: { width: '100%', gap: 10 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  stepDone: { backgroundColor: 'rgba(0,201,153,0.1)' },
  stepActive: { backgroundColor: 'rgba(64,86,244,0.08)', borderWidth: 1, borderColor: 'rgba(64,86,244,0.25)' },
  stepIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: colors.teal },
  stepIconActive: { backgroundColor: colors.blue },
  stepIcon: { fontSize: 15 },
  stepLabel: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  stepLabelDone: { color: colors.teal },
  stepDesc: { fontSize: 10, color: colors.mid, marginTop: 1 },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.blue },
  // Success
  successWrap: { width: '100%', alignItems: 'center', gap: 14 },
  successCard: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center', gap: 6 },
  successIcon: { marginBottom: 8 },
  successLabel: { fontSize: 11, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  successTitle: { fontSize: 26, fontWeight: font.black, color: colors.white, textAlign: 'center' },
  successDate: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  successDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', width: '100%', marginVertical: 16 },
  successMeta: { flexDirection: 'row', gap: 24 },
  successMetaItem: { alignItems: 'center' },
  successMetaNum: { fontSize: 28, fontWeight: font.black, color: colors.white },
  successMetaLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 15, marginTop: 2 },
  successBy: { fontSize: 11, color: colors.mid },
  continueBtn: { backgroundColor: colors.navy, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  continueBtnText: { color: colors.white, fontSize: 16, fontWeight: font.bold },
})
