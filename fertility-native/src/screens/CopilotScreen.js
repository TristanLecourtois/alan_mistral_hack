import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { askCopilot } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

const SUGGESTED_QUESTIONS = [
  'Should I be worried about my results?',
  'What does my motility score mean?',
  'What can I do to improve my parameters?',
  'How do I prepare for my next appointment?',
]

function Message({ msg }) {
  const isBot = msg.role === 'assistant'
  return (
    <View style={isBot ? styles.bubbleBot : styles.bubbleUserWrap}>
      {isBot && (
        <View style={styles.botAvatar}>
          <Text style={{ fontSize: 14 }}>🤝</Text>
        </View>
      )}
      <View style={isBot ? styles.bubbleBotInner : styles.bubbleUser}>
        {isBot && <Text style={styles.botName}>Fertility Copilot</Text>}
        <Text style={isBot ? styles.bubbleText : styles.bubbleUserText}>{msg.content}</Text>
      </View>
    </View>
  )
}

export default function CopilotScreen() {
  const { navigate } = useNav()
  const { analysisResult, onboardingAnswers } = useApp()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: analysisResult
        ? `Hi 👋 I've reviewed your ${analysisResult.documentType?.toLowerCase() || 'report'}. I'm here to help you understand your results and prepare for your appointment. What would you like to know?`
        : "Hi 👋 I'm Fertility Copilot — your personal health companion. I'm here to help you understand your results and prepare for your next appointment. What's on your mind?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  async function sendMessage(text) {
    const userText = text?.trim() || input.trim()
    if (!userText || loading) return

    const userMsg = { role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const reply = await askCopilot(userText, analysisResult, onboardingAnswers)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I couldn't process your question. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const showSuggestions = messages.length <= 1

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={{ fontSize: 18 }}>🤝</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>Fertility Copilot</Text>
            <Text style={styles.headerSub}>Online · Powered by Mistral</Text>
          </View>
          {analysisResult && (
            <TouchableOpacity onPress={() => navigate(SCREENS.RESULTS)} style={styles.reportBtn}>
              <Text style={styles.reportBtnText}>My report</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}

          {loading && (
            <View style={styles.loadingRow}>
              <View style={styles.botAvatar}>
                <Text style={{ fontSize: 14 }}>🤝</Text>
              </View>
              <View style={[styles.bubbleBotInner, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={colors.blue} />
              </View>
            </View>
          )}

          {showSuggestions && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Suggested questions</Text>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(q)}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question…"
            placeholderTextColor={colors.mid}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  avatar: { width: 36, height: 36, backgroundColor: colors.blue, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 14, fontWeight: font.bold, color: colors.dark },
  headerSub: { fontSize: 11, color: colors.mid },
  reportBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  reportBtnText: { fontSize: 11, fontWeight: font.semibold, color: colors.blue },
  chat: { flex: 1 },
  chatContent: { padding: 14, gap: 8, paddingBottom: 16 },
  bubbleBot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', alignSelf: 'flex-start', marginBottom: 4 },
  botAvatar: { width: 28, height: 28, backgroundColor: colors.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubbleBotInner: { backgroundColor: colors.white, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, ...shadow.sm, flexShrink: 1 },
  botName: { fontSize: 10, color: colors.mid, fontWeight: font.semibold, marginBottom: 4 },
  bubbleText: { fontSize: 13, color: colors.dark, lineHeight: 20 },
  bubbleUserWrap: { alignSelf: 'flex-end', maxWidth: '82%', marginBottom: 4 },
  bubbleUser: { backgroundColor: colors.teal, borderRadius: 18, borderBottomRightRadius: 4, padding: 12 },
  bubbleUserText: { fontSize: 13, color: colors.white, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', marginBottom: 4 },
  loadingBubble: { paddingHorizontal: 20, paddingVertical: 14 },
  suggestions: { marginTop: 8 },
  suggestionsLabel: { fontSize: 10, fontWeight: font.bold, color: colors.mid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  suggestionChip: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.25)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 7 },
  suggestionText: { fontSize: 12, fontWeight: font.semibold, color: colors.blue },
  inputRow: {
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
    backgroundColor: colors.lightgray,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.dark,
    maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(64,86,244,0.3)' },
  sendBtnText: { fontSize: 18, color: colors.white, fontWeight: font.bold },
})
