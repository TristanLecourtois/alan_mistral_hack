import { useEffect, useRef, useState } from 'react'
import { View, Text, Animated, Easing, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const STEPS = [
  { label: 'Medical OCR', desc: 'Mistral OCR 3 · Values extracted', status: 'done' },
  { label: 'WHO 2021 norms', desc: 'HAS reference comparison', status: 'done' },
  { label: 'Clinical interpretation', desc: 'Mistral Small 4 · In progress…', status: 'active' },
  { label: 'Patient sheet + questions', desc: 'Generating report', status: 'pending' },
]

export default function AnalyseScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start()
    // Auto-navigate after 3s (demo)
    const t = setTimeout(() => navigate(SCREENS.FICHE), 3000)
    return () => clearTimeout(t)
  }, [])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Text style={styles.ringEmoji}>🔬</Text>
        <Text style={styles.title}>Analysis in progress…</Text>
        <Text style={styles.sub}>SpermAnalysis_March2025.pdf</Text>

        <View style={styles.stepsList}>
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.stepRow, step.status === 'done' && styles.stepDone, step.status === 'active' && styles.stepActive]}>
              <View style={[styles.stepIcon, step.status === 'done' && styles.stepIconDone, step.status === 'active' && styles.stepIconActive]}>
                <Text style={styles.stepIconText}>
                  {step.status === 'done' ? '✓' : step.status === 'active' ? '🧠' : '💬'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepName}>{step.label}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              {step.status === 'done' && <Text style={{ color: colors.teal, fontSize: 16 }}>✓</Text>}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ring: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(64,86,244,0.15)',
    borderTopColor: colors.blue,
    position: 'absolute',
    top: '20%',
  },
  ringEmoji: { fontSize: 44, position: 'absolute', top: '20%', marginTop: 38 },
  title: { fontSize: 20, fontWeight: font.black, color: colors.dark, textAlign: 'center', marginBottom: 8, marginTop: 100 },
  sub: { fontSize: 13, color: colors.mid, textAlign: 'center', marginBottom: 32 },
  stepsList: { width: '100%', gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 12, ...shadow.sm },
  stepDone: { backgroundColor: 'rgba(0,201,153,0.15)' },
  stepActive: { backgroundColor: 'rgba(64,86,244,0.12)', borderWidth: 1, borderColor: 'rgba(64,86,244,0.3)' },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: colors.teal },
  stepIconActive: { backgroundColor: colors.blue },
  stepIconText: { fontSize: 14 },
  stepName: { fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  stepDesc: { fontSize: 10, color: colors.mid, marginTop: 2 },
})
