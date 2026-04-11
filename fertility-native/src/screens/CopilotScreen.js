import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, TouchableWithoutFeedback, Alert, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { askCopilot } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

function sc(s) { return s === 'ok' ? colors.teal : s === 'warn' ? colors.amber : colors.coral }

// ─── Format time ─────────────────────────────────────────────
function timeAgo(date) {
  const d = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Context banner ───────────────────────────────────────────
function ContextBanner({ analysisResult, onboardingAnswers }) {
  const [expanded, setExpanded] = useState(false)
  if (!analysisResult) return null
  const biomarkers = analysisResult.biomarkers || []
  const abnormal = biomarkers.filter(b => b.status !== 'ok')
  return (
    <TouchableOpacity style={c.banner} onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
      <View style={c.bannerTop}>
        <View style={c.bannerCtx}>
          <Text style={c.bannerCtxText}>Context</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={c.bannerTitle}>{analysisResult.documentType} · {abnormal.length} parameter{abnormal.length !== 1 ? 's' : ''} to watch</Text>
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

// ─── Conversation list item ───────────────────────────────────
function ConvItem({ conv, onPress, onDelete }) {
  const lastMsg = conv.messages[conv.messages.length - 1]
  const preview = lastMsg?.content?.slice(0, 60) || 'Start typing…'
  return (
    <TouchableOpacity style={ci.row} onPress={onPress} activeOpacity={0.75}>
      <View style={ci.iconWrap}>
        <Text style={{ fontSize: 18 }}>💬</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={ci.title} numberOfLines={1}>{conv.title}</Text>
        <Text style={ci.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={ci.time}>{timeAgo(conv.createdAt)}</Text>
        <TouchableOpacity
          style={ci.deleteBtn}
          onPress={() => Alert.alert('Delete conversation?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(conv.id) },
          ])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={ci.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

// ─── Message bubble (Alan-inspired) ──────────────────────────
function Message({ msg }) {
  const isBot = msg.role === 'assistant'
  const entryAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(entryAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start()
  }, [])

  if (isBot) {
    return (
      <Animated.View style={[m.botRow, { opacity: entryAnim, transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <View style={m.botAvatar}>
          <Text style={m.botAvatarText}>🤖</Text>
        </View>
        <View style={m.botBubble}>
          <Text style={m.botName}>Fertility Copilot</Text>
          <Text style={m.botText}>{msg.content}</Text>
        </View>
      </Animated.View>
    )
  }
  return (
    <Animated.View style={[m.userRow, { opacity: entryAnim, transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={m.userBubble}>
        <Text style={m.userText}>{msg.content}</Text>
      </View>
    </Animated.View>
  )
}

// ─── Typing indicator ─────────────────────────────────────────
function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.2, duration: 280, useNativeDriver: true }),
        Animated.delay(480),
      ]))
    )
    Animated.parallel(anims).start()
    return () => anims.forEach(a => a.stop())
  }, [])
  return (
    <View style={m.botRow}>
      <View style={m.botAvatar}><Text style={m.botAvatarText}>🤖</Text></View>
      <View style={[m.botBubble, { paddingVertical: 16, paddingHorizontal: 18 }]}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue, opacity: d }} />
          ))}
        </View>
      </View>
    </View>
  )
}

// ─── Suggestion chip ─────────────────────────────────────────
const SUGGESTIONS = [
  'Should I be worried about my results?',
  'What does motility mean for my fertility?',
  'How can I improve my parameters?',
  'What should I ask my doctor?',
]

// ─── Chat view ────────────────────────────────────────────────
function ChatView({ conversation, onBack, analysisResult, onboardingAnswers, pendingMessage, onClearPending, updateConversationMessages }) {
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const [messages, setMessages] = useState(conversation.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Fire pending message once on mount
  useEffect(() => {
    if (pendingMessage) {
      onClearPending()
      setTimeout(() => sendMessage(pendingMessage), 300)
    }
  }, [])

  useEffect(() => {
    updateConversationMessages(conversation.id, messages)
  }, [messages])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages, loading])

  async function sendMessage(text) {
    const t = (text || input).trim()
    if (!t || loading) return
    Keyboard.dismiss()
    const userMsg = { role: 'user', content: t }
    setMessages(prev => [...prev, userMsg])
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

  const showSuggestions = messages.length === 0 && !loading

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Chat header */}
      <View style={[ch.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={ch.backBtn} onPress={onBack}>
          <Text style={ch.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={ch.headerCenter}>
          <Text style={ch.headerTitle} numberOfLines={1}>{conversation.title}</Text>
          <Text style={ch.headerSub}>Fertility Copilot · Mistral AI</Text>
        </View>
        <View style={ch.headerRight}>
          <View style={ch.onlineDot} />
          <Text style={ch.onlineText}>Online</Text>
        </View>
      </View>

      <ContextBanner analysisResult={analysisResult} onboardingAnswers={onboardingAnswers} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollRef}
          style={ch.chat}
          contentContainerStyle={ch.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro message if empty */}
          {messages.length === 0 && !pendingMessage && (
            <View style={m.introWrap}>
              <View style={m.introBotAvatar}><Text style={{ fontSize: 28 }}>🤖</Text></View>
              <Text style={m.introTitle}>Hi 👋</Text>
              <Text style={m.introSub}>
                {analysisResult
                  ? `I've read your ${analysisResult.documentType?.toLowerCase() || 'report'}. What would you like to understand?`
                  : "I'm your Fertility Copilot. What's on your mind?"}
              </Text>
            </View>
          )}

          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {loading && <TypingIndicator />}

          {showSuggestions && (
            <View style={m.suggestWrap}>
              <Text style={m.suggestLabel}>Try asking</Text>
              <View style={m.suggestRow}>
                {SUGGESTIONS.map((q, i) => (
                  <TouchableOpacity key={i} style={m.chip} onPress={() => sendMessage(q)}>
                    <Text style={m.chipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Input */}
      <View style={[ch.inputWrap, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          ref={inputRef}
          style={ch.input}
          placeholder="Ask a question…"
          placeholderTextColor={colors.mid}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[ch.sendBtn, (!input.trim() || loading) && ch.sendBtnOff]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={ch.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── Conversation list view ───────────────────────────────────
function ConversationList({ conversations, onSelect, onCreate, onDelete, analysisResult, insets }) {
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.listHeader}>
        <View style={s.listHeaderLeft}>
          <View style={s.listAvatar}><Text style={{ fontSize: 22 }}>🤖</Text></View>
          <View>
            <Text style={s.listTitle}>Copilot</Text>
            <Text style={s.listSub}>Powered by Mistral AI</Text>
          </View>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={onCreate}>
          <Text style={s.newBtnText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      {analysisResult && (
        <View style={s.contextStrip}>
          <Text style={s.contextStripIcon}>🧬</Text>
          <Text style={s.contextStripText}>
            Copilot has loaded your {analysisResult.documentType} · {analysisResult.biomarkers?.length || 0} parameters
          </Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {conversations.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No conversations yet</Text>
            <Text style={s.emptySub}>Start a new discussion to get personalized answers based on your results.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={onCreate}>
              <Text style={s.emptyBtnText}>Start a conversation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.convList}>
            {conversations.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                onPress={() => onSelect(conv.id)}
                onDelete={onDelete}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function CopilotScreen() {
  const {
    analysisResult, onboardingAnswers,
    conversations, activeConversationId, activeConversation,
    createConversation, deleteConversation, setActiveConversationId,
    updateConversationMessages,
    pendingCopilotMessage, setPendingCopilotMessage,
  } = useApp()
  const insets = useSafeAreaInsets()

  // If there's a pending message (from Prepare), auto-open a new conversation
  useEffect(() => {
    if (pendingCopilotMessage) {
      createConversation(pendingCopilotMessage)
    }
  }, [pendingCopilotMessage])

  function handleCreate() {
    createConversation()
  }

  if (activeConversation) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F4FF' }}>
        <ChatView
          conversation={activeConversation}
          onBack={() => setActiveConversationId(null)}
          analysisResult={analysisResult}
          onboardingAnswers={onboardingAnswers}
          pendingMessage={pendingCopilotMessage}
          onClearPending={() => setPendingCopilotMessage(null)}
          updateConversationMessages={updateConversationMessages}
        />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F4FF' }}>
      <ConversationList
        conversations={conversations}
        onSelect={id => setActiveConversationId(id)}
        onCreate={handleCreate}
        onDelete={deleteConversation}
        analysisResult={analysisResult}
        insets={insets}
      />
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────
const c = StyleSheet.create({
  banner: { backgroundColor: 'rgba(64,86,244,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(64,86,244,0.1)', paddingHorizontal: 16, paddingVertical: 10 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerCtx: { backgroundColor: colors.blue, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  bannerCtxText: { fontSize: 9, fontWeight: font.bold, color: colors.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerTitle: { fontSize: 11, fontWeight: font.semibold, color: colors.dark },
  bannerChevron: { fontSize: 9, color: colors.mid },
  bannerDetail: { marginTop: 10, gap: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: font.semibold },
  bannerNote: { fontSize: 10, color: colors.mid, fontStyle: 'italic' },
})

const ci = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 10 },
  iconWrap: { width: 44, height: 44, backgroundColor: '#EEF1FF', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: font.bold, color: colors.dark },
  preview: { fontSize: 12, color: colors.mid },
  time: { fontSize: 10, color: colors.mid },
  deleteBtn: { padding: 2 },
  deleteIcon: { fontSize: 14 },
})

const m = StyleSheet.create({
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16, maxWidth: '88%' },
  botAvatar: { width: 32, height: 32, backgroundColor: colors.blue, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  botAvatarText: { fontSize: 16 },
  botBubble: { backgroundColor: colors.white, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, ...shadow.sm, flexShrink: 1 },
  botName: { fontSize: 10, color: colors.mid, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  botText: { fontSize: 14, color: colors.dark, lineHeight: 22 },
  userRow: { alignSelf: 'flex-end', maxWidth: '80%', marginBottom: 16 },
  userBubble: { backgroundColor: colors.blue, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  userText: { fontSize: 14, color: colors.white, lineHeight: 22 },
  introWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  introBotAvatar: { width: 64, height: 64, backgroundColor: colors.blue, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  introTitle: { fontSize: 22, fontWeight: font.black, color: colors.dark },
  introSub: { fontSize: 14, color: colors.mid, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  suggestWrap: { marginTop: 8 },
  suggestLabel: { fontSize: 10, fontWeight: font.bold, color: colors.mid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.2)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, ...shadow.sm },
  chipText: { fontSize: 13, fontWeight: font.semibold, color: colors.blue },
})

const ch = StyleSheet.create({
  header: { backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF1FF', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: colors.blue, fontWeight: font.bold },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: font.bold, color: colors.dark },
  headerSub: { fontSize: 10, color: colors.mid },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.teal },
  onlineText: { fontSize: 11, color: colors.teal, fontWeight: font.semibold },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  input: { flex: 1, backgroundColor: '#F2F4FF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.dark, maxHeight: 110, lineHeight: 20 },
  sendBtn: { width: 42, height: 42, backgroundColor: colors.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnOff: { backgroundColor: 'rgba(64,86,244,0.25)' },
  sendIcon: { fontSize: 20, color: colors.white, fontWeight: font.bold },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4FF' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  listHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listAvatar: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 17, fontWeight: font.black, color: colors.dark },
  listSub: { fontSize: 11, color: colors.mid },
  newBtn: { backgroundColor: colors.blue, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontWeight: font.bold, color: colors.white },
  contextStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(64,86,244,0.06)', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(64,86,244,0.1)' },
  contextStripIcon: { fontSize: 14 },
  contextStripText: { fontSize: 11, color: colors.blue, fontWeight: font.semibold },
  convList: { padding: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: font.black, color: colors.dark },
  emptySub: { fontSize: 13, color: colors.mid, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: colors.blue, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: font.bold, color: colors.white },
})
