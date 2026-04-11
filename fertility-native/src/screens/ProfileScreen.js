import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { colors, font, shadow } from '../theme'

const QUESTIONS = [
  {
    q: 'How old are you?',
    options: ['Under 30', '30 – 35', '35 – 38', 'Over 38'],
  },
  {
    q: 'How long have you been trying?',
    options: ['Less than 6 months', '6–12 months', 'Over a year'],
  },
  {
    q: 'How would you describe your stress level?',
    options: ['Low', 'Moderate', 'High', 'Very high'],
  },
  {
    q: 'How is your sleep lately?',
    options: ['Good', 'Irregular', 'Poor'],
  },
]

export default function ProfileScreen() {
  const { navigate } = useNav()
  const { setOnboardingAnswers } = useApp()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState([])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
  }, [step])

  function choose(opt) {
    const newAnswers = [...answers, opt]
    setAnswers(newAnswers)
    if (step < QUESTIONS.length - 1) {
      setTimeout(() => setStep(s => s + 1), 300)
    } else {
      setOnboardingAnswers(newAnswers)
      navigate(SCREENS.RESULTS)
    }
  }

  const progress = (step / QUESTIONS.length) * 100

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.tag}>A FEW QUICK QUESTIONS</Text>
        <Text style={styles.title}>Help us personalize{'\n'}your results</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {QUESTIONS.map((item, i) => {
          if (i > step) return null
          const answered = answers[i]
          return (
            <View key={i} style={styles.questionBlock}>
              <Text style={styles.question}>{item.q}</Text>

              {answered ? (
                <View style={styles.answeredChip}>
                  <Text style={styles.answeredText}>✓ {answered}</Text>
                </View>
              ) : (
                <View style={styles.options}>
                  {item.options.map(opt => (
                    <TouchableOpacity key={opt} style={[styles.option, shadow.sm]} onPress={() => choose(opt)}>
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  tag: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: colors.teal, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: font.black, color: colors.navy, lineHeight: 32, marginBottom: 16 },
  progressBar: { height: 4, backgroundColor: colors.lightgray, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 24 },
  questionBlock: { gap: 12 },
  question: { fontSize: 16, fontWeight: font.semibold, color: colors.dark },
  options: { gap: 8 },
  option: { backgroundColor: colors.white, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.2)' },
  optionText: { fontSize: 14, fontWeight: font.medium, color: colors.blue },
  answeredChip: { backgroundColor: 'rgba(0,201,153,0.12)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' },
  answeredText: { fontSize: 13, fontWeight: font.semibold, color: colors.teal },
})
