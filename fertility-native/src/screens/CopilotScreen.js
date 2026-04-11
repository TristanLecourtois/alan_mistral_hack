import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, TouchableWithoutFeedback,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { askCopilot } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }

// ─── Context banner ───────────────────────────────────────────
function ContextBanner({ analysisResult, onboardingAnswers }) {
  const [expanded, setExpanded] = useState(false)
  if (!analysisResult) return null
  const biomarkers = analysisResult.biomarkers || []
  const abnormal = biomarkers.filter(b => b.status !== 'ok')
  return (
    <TouchableOpacity style={c.banner} onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
      <View style={c.bannerTop}>
        <View style={c.bannerIcon}>
          <Text style={{ fontSize: 13 }}>🧬</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={c.bannerTitle}>Copilot knows your report</Text>
          <Text style={c.bannerSub}>{analysisResult.documentType} · {biomarkers.length} parameters · {abnormal.length} to watch</Text>
        </View>
        <Text style={c.bannerChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <View style={c.bannerDetail}>
          <View style={c.pillsRow}>
            {biomarkers.map((b, i) => (
              <View key={i} style={[c.pill, { backgroundColor: sc(b.status) + '18' }]}>
                <View style={[c.pillDot, { backgroundColor: sc(b.status) }]} />
                <Text style={[c.pillTxt, { color: sc(b.status) }]}>{b.name} {b.value}{b.unit}</Text>
              </View>
            ))}
          </View>
          {onboardingAnswers?.length > 0 && (
            <View style={c.pillsRow}>
              {onboardingAnswers.map((a, i) => (
                <View key={i} style={[c.pill, { backgroundColor: 'rgba(64,86,244,0.08)' }]}>
                  <Text style={[c.pillTxt, { color: colors.blue }]}>{a}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={c.bannerNote}>Every answer is personalized to your results.</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Message bubble ──────────────────────────────────────────
function Message({ msg }) {
  const isBot = msg.role === 'assistant'
  if (isBot) {
    return (
      <View style={m.botWrap}>
        <View style={m.botAvatar}><Text style={{ fontSize: 13 }}>🤖</Text></View>
        <View style={m.botBubble}>
          <Text style={m.botLabel}>Fertility Copilot</Text>
          <Text style={m.botText}>{msg.content}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={m.userWrap}>
      <View style={m.userBubble}>
        <Text style={m.userText}>{msg.content}</Text>
      </View>
    </View>
  )
}

// ─── Suggested chip ──────────────────────────────────────────
function SuggestedChip({ text, onPress }) {
  return (
    <TouchableOpacity style={m.chip} onPress={() => onPress(text)} activeOpacity={0.75}>
      <Text style={m.chipText}>{text}</Text>
    </TouchableOpacity>
  )
}

const SUGGESTIONS = [
  'Should I be worried about my results?',
  'What does motility mean?',
  'How do I improve my parameters?',
  'What to ask my doctor?',
]

// ─── Main screen ─────────────────────────────────────────────
export default function CopilotScreen() {
  const { navigate } = useNav()
  const { analysisResult, onboardingAnswers } = useApp()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: analysisResult
        ? `Hi 👋 I've read your ${analysisResult.documentType?.toLowerCase() || 'report'} and I know your profile. What would you like to understand?`
        : "Hi 👋 I'm your Fertility Copilot. What's on your mind?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)
  }, [messages])

  async function send(text) {
    const t = (text || input).trim()
    if (!t || loading) return
    Keyboard.dismiss()
    setMessages(prev => [...prev, { role: 'user', content: t }])
    setInput('')
    setLoading(true)
    try {
      const reply = await askCopilot(t, analysisResult, onboardingAnswers)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't process that. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const showSuggestions = messages.length <= 1

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}><Text style={{ fontSize: 18 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName}>Fertility Copilot</Text>
            <Text style={s.headerSub}>Powered by Mistral AI</Text>
          </View>
          {analysisResult && (
            <TouchableOpacity onPress={() => navigate(SCREENS.RESULTS)} style={s.reportBtn}>
              <Text style={s.reportBtnText}>📊 Results</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Context */}
        <ContextBanner analysisResult={analysisResult} onboardingAnswers={onboardingAnswers} />

        {/* Chat — tap outside input to dismiss keyboard */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            style={s.chat}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}

            {loading && (
              <View style={m.botWrap}>
                <View style={m.botAvatar}><Text style={{ fontSize: 13 }}>🤖</Text></View>
                <View style={[m.botBubble, { paddingHorizontal: 20, paddingVertical: 14 }]}>
                  <ActivityIndicator size="small" color={colors.blue} />
                </View>
              </View>
            )}

            {showSuggestions && !loading && (
              <View style={m.suggestionsWrap}>
                <Text style={m.suggestionsLabel}>Try asking</Text>
                <View style={m.suggestionsRow}>
                  {SUGGESTIONS.map((q, i) => (
                    <SuggestedChip key={i} text={q} onPress={send} />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Keyboard dismiss hint when visible */}
        {keyboardVisible && (
          <TouchableOpacity style={s.dismissHint} onPress={Keyboard.dismiss}>
            <Text style={s.dismissHintText}>↓ Tap to close keyboard</Text>
          </TouchableOpacity>
        )}

        {/* Input */}
        <View style={[s.inputWrap, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Ask a question…"
            placeholderTextColor={colors.mid}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnOff]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────
const c = StyleSheet.create({
  banner: { backgroundColor: 'rgba(64,86,244,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(64,86,244,0.1)', paddingHorizontal: 14, paddingVertical: 10 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerIcon: { width: 30, height: 30, backgroundColor: colors.blue, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark },
  bannerSub: { fontSize: 10, color: colors.mid, marginTop: 1 },
  bannerChevron: { fontSize: 9, color: colors.mid },
  bannerDetail: { marginTop: 10, gap: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: font.semibold },
  bannerNote: { fontSize: 10, color: colors.mid, fontStyle: 'italic' },
})

const m = StyleSheet.create({
  botWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 12 },
  botAvatar: { width: 26, height: 26, backgroundColor: colors.blue, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  botBubble: { backgroundColor: colors.white, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, ...shadow.sm },
  botLabel: { fontSize: 9, color: colors.mid, fontWeight: font.semibold, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  botText: { fontSize: 14, color: colors.dark, lineHeight: 21 },
  userWrap: { alignSelf: 'flex-end', maxWidth: '80%', marginBottom: 12 },
  userBubble: { backgroundColor: colors.blue, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { fontSize: 14, color: colors.white, lineHeight: 21 },
  suggestionsWrap: { marginTop: 4 },
  suggestionsLabel: { fontSize: 10, fontWeight: font.bold, color: colors.mid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.2)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontWeight: font.semibold, color: colors.blue },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4FF' },
  header: { backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  avatar: { width: 36, height: 36, backgroundColor: colors.blue, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 15, fontWeight: font.bold, color: colors.dark },
  headerSub: { fontSize: 11, color: colors.mid },
  reportBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  reportBtnText: { fontSize: 11, fontWeight: font.semibold, color: colors.blue },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  dismissHint: { alignItems: 'center', paddingVertical: 4, backgroundColor: 'transparent' },
  dismissHintText: { fontSize: 11, color: colors.mid },
  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F4FF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 14,
    color: colors.dark,
    maxHeight: 110,
    lineHeight: 20,
  },
  sendBtn: { width: 42, height: 42, backgroundColor: colors.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnOff: { backgroundColor: 'rgba(64,86,244,0.25)' },
  sendIcon: { fontSize: 20, color: colors.white, fontWeight: font.bold },
})
