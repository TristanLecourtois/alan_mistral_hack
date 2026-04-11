import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const STEPS = [
  {
    question: 'How long have you been trying to conceive?',
    options: ['Less than 6 months', '6 to 12 months', 'More than a year'],
  },
  {
    question: 'How old is the person carrying the pregnancy?',
    options: ['Under 30', '30 – 35', '35 – 38', 'Over 38'],
  },
  {
    question: 'Any known medical history affecting fertility?',
    options: ['None known', 'Yes, female factor', 'Yes, male factor', 'Both'],
  },
  {
    question: 'Have you already had any fertility tests?',
    options: ['Not yet', 'Some tests done', 'Complete workup done'],
  },
  {
    question: 'Are you currently followed by a specialist?',
    options: ['No', 'GP only', 'Gynaecologist / Urologist', 'Fertility clinic'],
  },
]

export default function OnboardingScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState([])
  const [pendingOption, setPendingOption] = useState(null)

  function choose(opt) {
    if (pendingOption) return
    setPendingOption(opt)
    setTimeout(() => {
      const newAnswers = [...answers, opt]
      setAnswers(newAnswers)
      setPendingOption(null)
      if (step < STEPS.length - 1) {
        setStep(s => s + 1)
      } else {
        navigate(SCREENS.RESULT_OK)
      }
    }, 350)
  }

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [step, answers])

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={{ fontSize: 18 }}>🤝</Text></View>
        <View>
          <Text style={styles.headerName}>Fertility Copilot</Text>
          <Text style={styles.headerSub}>Online · Replies in seconds</Text>
        </View>
      </View>

      {/* Chat */}
      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
        <View style={styles.bubbleBot}>
          <Text style={styles.botName}>Fertility Copilot</Text>
          <Text style={styles.bubbleText}>Hello 👋 I'm here to help you understand your journey. Let me start with a few simple questions…</Text>
        </View>

        {STEPS.map((st, i) => {
          if (i > step) return null
          const answer = answers[i]
          return (
            <View key={i}>
              <View style={styles.bubbleBot}>
                <Text style={styles.botName}>Fertility Copilot</Text>
                <Text style={styles.bubbleText}>{st.question}</Text>
              </View>

              {answer ? (
                <View style={styles.bubbleUser}>
                  <Text style={styles.bubbleUserText}>{answer}</Text>
                </View>
              ) : (
                <View style={styles.options}>
                  {st.options.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.option, pendingOption === opt && styles.optionSelected]}
                      onPress={() => choose(opt)}
                    >
                      <Text style={[styles.optionText, pendingOption === opt && styles.optionTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* Progress */}
      <View style={[styles.progressWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelText}>Assessment in progress</Text>
          <Text style={styles.progressLabelText}>{step + 1}/{STEPS.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: { backgroundColor: colors.white, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  avatar: { width: 36, height: 36, backgroundColor: colors.blue, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 14, fontWeight: font.bold, color: colors.dark },
  headerSub: { fontSize: 11, color: colors.mid },
  chat: { flex: 1 },
  chatContent: { padding: 14, gap: 10, paddingBottom: 20 },
  bubbleBot: { maxWidth: '82%', backgroundColor: colors.white, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, ...shadow.sm, alignSelf: 'flex-start', marginBottom: 4 },
  botName: { fontSize: 10, color: colors.mid, fontWeight: font.semibold, marginBottom: 3 },
  bubbleText: { fontSize: 13, color: colors.dark, lineHeight: 20 },
  bubbleUser: { maxWidth: '82%', backgroundColor: colors.teal, borderRadius: 18, borderBottomRightRadius: 4, padding: 12, alignSelf: 'flex-end', marginBottom: 4 },
  bubbleUserText: { fontSize: 13, color: colors.white, lineHeight: 20 },
  options: { gap: 7, marginLeft: 8, marginBottom: 4 },
  option: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.25)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  optionSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  optionText: { fontSize: 12, fontWeight: font.semibold, color: colors.teal },
  optionTextSelected: { color: colors.white },
  progressWrap: { backgroundColor: colors.white, paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabelText: { fontSize: 10, color: colors.mid },
  progressTrack: { height: 4, backgroundColor: colors.lightgray, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 4 },
})
