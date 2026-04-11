import { useEffect, useRef, useState } from 'react'
import { View, Text, Animated, Easing, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { uploadDocument } from '../api'
import { colors, font, shadow } from '../theme'

export default function AnalyseScreen() {
  const { navigate, params } = useNav()
  const insets = useSafeAreaInsets()
  const spin = useRef(new Animated.Value(0)).current
  const [stepIndex, setStepIndex] = useState(0)

  const steps = [
    { label: 'Reading document', desc: 'Uploading to Mistral OCR…' },
    { label: 'Extracting values', desc: 'WHO 2021 norms comparison' },
    { label: 'Interpreting results', desc: 'Mistral AI · Generating report…' },
  ]

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start()

    async function run() {
      try {
        const file = params?.file
        if (!file) {
          // No real file — demo mode, just wait 3s
          setTimeout(() => navigate(SCREENS.FICHE, { ocrResult: null }), 3000)
          return
        }

        setStepIndex(0)
        const result = await uploadDocument(file)
        setStepIndex(1)
        // Small pause so user sees step 2 light up
        await new Promise(r => setTimeout(r, 500))
        setStepIndex(2)
        await new Promise(r => setTimeout(r, 400))
        navigate(SCREENS.FICHE, { ocrResult: result, fileName: file.name })
      } catch (e) {
        Alert.alert('Analysis failed', e.message || 'Could not connect to the server. Make sure the backend is running.')
        navigate(SCREENS.UPLOAD)
      }
    }

    run()
  }, [])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const fileName = params?.file?.name || 'Document'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Text style={styles.ringEmoji}>🔬</Text>
        <Text style={styles.title}>Analysis in progress…</Text>
        <Text style={styles.sub}>{fileName}</Text>

        <View style={styles.stepsList}>
          {steps.map((step, i) => {
            const status = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'
            return (
              <View key={i} style={[styles.stepRow, status === 'done' && styles.stepDone, status === 'active' && styles.stepActive]}>
                <View style={[styles.stepIcon, status === 'done' && styles.stepIconDone, status === 'active' && styles.stepIconActive]}>
                  <Text style={styles.stepIconText}>
                    {status === 'done' ? '✓' : status === 'active' ? '🧠' : '💬'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepName}>{step.label}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
                {status === 'done' && <Text style={{ color: colors.teal, fontSize: 16 }}>✓</Text>}
              </View>
            )
          })}
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
