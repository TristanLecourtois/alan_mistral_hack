import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const PRIORITY = [
  { text: 'Given my progressive motility of 28%, do you recommend a repeat semen analysis or going straight to a DNA fragmentation test?', badge: 'Based on your result', checked: true },
  { text: 'Is my morphology at 3% (Kruger) an isolated factor or combined with motility to consider ICSI?', badge: 'Based on your result', checked: true },
  { text: 'What protocol do you recommend first — IUI or IVF — and why?', badge: 'Recommended', checked: false },
]
const GENERAL = [
  { text: 'What additional tests do you suggest before starting a protocol?', checked: false },
  { text: 'What lifestyle changes could improve parameters by the next sample?', checked: false },
  { text: 'What are realistic timelines to start a first cycle?', checked: false },
]

function QItem({ item, onToggle }) {
  return (
    <TouchableOpacity style={[styles.qItem, item.checked && styles.qItemChecked]} onPress={onToggle}>
      <View style={[styles.qCheck, item.checked && styles.qCheckChecked]}>
        {item.checked && <Text style={{ color: colors.white, fontSize: 12 }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.qText}>{item.text}</Text>
        {item.badge && <View style={styles.qBadge}><Text style={styles.qBadgeText}>{item.badge}</Text></View>}
      </View>
    </TouchableOpacity>
  )
}

export default function QuestionsScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()
  const [priority, setPriority] = useState(PRIORITY)
  const [general, setGeneral] = useState(GENERAL)

  const toggleP = i => setPriority(prev => prev.map((q, idx) => idx === i ? { ...q, checked: !q.checked } : q))
  const toggleG = i => setGeneral(prev => prev.map((q, idx) => idx === i ? { ...q, checked: !q.checked } : q))

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Text style={styles.back}>← My report</Text></TouchableOpacity>
        <Text style={styles.title}>Questions for my doctor</Text>
        <Text style={styles.sub}>AI-generated · Based on your results</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>🎯 Priority questions</Text>
        {priority.map((q, i) => <QItem key={i} item={q} onToggle={() => toggleP(i)} />)}

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>📋 General questions</Text>
        {general.map((q, i) => <QItem key={i} item={q} onToggle={() => toggleG(i)} />)}

        <TouchableOpacity style={[styles.btnCoral, shadow.md]} onPress={() => navigate(SCREENS.DASHBOARD)}>
          <Text style={styles.btnCoralText}>Export to my appointment →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.navy, marginBottom: 4 },
  sub: { fontSize: 12, color: colors.mid },
  body: { flex: 1, paddingHorizontal: 14 },
  sectionTitle: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.coral, marginBottom: 10, marginTop: 6 },
  qItem: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 13, marginBottom: 8, ...shadow.sm, borderWidth: 1.5, borderColor: 'transparent' },
  qItemChecked: { borderColor: colors.teal, backgroundColor: '#F0FDF8' },
  qCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  qCheckChecked: { backgroundColor: colors.teal, borderColor: colors.teal },
  qText: { fontSize: 12.5, color: colors.dark, lineHeight: 19 },
  qBadge: { marginTop: 4, backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  qBadgeText: { fontSize: 9, fontWeight: font.bold, color: colors.teal },
  btnCoral: { backgroundColor: colors.coral, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 14 },
  btnCoralText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})
