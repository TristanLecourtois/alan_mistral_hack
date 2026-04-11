import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const milestones = [
  { label: 'Egg retrieval',  date: 'Jun 12–18',      confidence: 74, color: colors.teal },
  { label: 'Embryo transfer',date: 'Jun 25 – Jul 3', confidence: 68, color: colors.purple },
  { label: 'Beta-HCG result',date: 'Jul 9 – 13',     confidence: 71, color: colors.coral },
  { label: 'Free window ✈️', date: 'Jul 20 – Aug 31',confidence: 89, color: colors.green, highlight: true },
]

const variables = [
  { label: 'Age',           val: '32',      pct: 78, color: colors.teal },
  { label: 'AMH level',     val: '1.8 ng/mL',pct: 62, color: colors.coral },
  { label: 'Cycle day',     val: 'D8',      pct: 55, color: colors.purple },
  { label: 'Prev. response',val: 'Good',    pct: 80, color: colors.green },
]

export default function PredictionScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.tag}>PREDICTIVE ENGINE</Text>
        <Text style={styles.title}>When will my next{'\n'}milestone happen?</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Scenario tabs */}
        <View style={styles.tabs}>
          {['Optimistic', 'Realistic ✓', 'Conservative'].map((label, i) => (
            <View key={i} style={[styles.tab, i === 1 && styles.tabActive]}>
              <Text style={[styles.tabText, i === 1 && styles.tabTextActive, i === 2 && { color: colors.coral }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Hero card */}
        <LinearGradient colors={['#4056F4', '#7C5CFC']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.heroLabel}>Next egg retrieval</Text>
          <Text style={styles.heroDate}>June 12 – 18</Text>
          <Text style={styles.heroSub}>Based on your current cycle · Day 8 today</Text>
          <Text style={styles.confLabel}>Confidence level</Text>
          <View style={styles.confBar}><View style={[styles.confFill, { width: '74%' }]} /></View>
          <View style={styles.confRow}>
            <Text style={styles.confEdge}>Low</Text>
            <Text style={styles.confVal}>74% confidence</Text>
            <Text style={styles.confEdge}>High</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>ALL MILESTONES</Text>

        {milestones.map((m, i) => (
          <View key={i} style={[styles.milestone, m.highlight && styles.milestoneHighlight, shadow.sm]}>
            <View style={styles.milestoneTop}>
              <Text style={[styles.milestoneLabel, m.highlight && { color: m.color }]}>{m.label}</Text>
              <Text style={[styles.milestoneDate, { color: m.color }]}>{m.date}</Text>
            </View>
            <View style={styles.milestoneBar}>
              <View style={[styles.milestoneFill, { width: `${m.confidence}%`, backgroundColor: m.color }]} />
            </View>
            <Text style={styles.milestoneConf}>{m.confidence}% confidence{m.highlight ? ' · ✈️ Book your vacation' : ' · ±3 days'}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>VARIABLES DRIVING THE PREDICTION</Text>

        <View style={styles.varGrid}>
          {variables.map((v, i) => (
            <View key={i} style={[styles.varCard, shadow.sm]}>
              <Text style={styles.varLabel}>{v.label}</Text>
              <Text style={styles.varVal}>{v.val}</Text>
              <View style={styles.varBar}><View style={[styles.varFill, { width: `${v.pct}%`, backgroundColor: v.color }]} /></View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={{ fontSize: 16 }}>🔄</Text>
          <Text style={styles.footerText}>Predictions update automatically with each new blood result, ultrasound, and wearable data sync.</Text>
        </View>

        <TouchableOpacity style={styles.btnNext} onPress={() => navigate(SCREENS.CONNECTED)}>
          <Text style={styles.btnNextText}>View connected health →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: colors.blue, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.dark, lineHeight: 24 },
  body: { flex: 1, paddingHorizontal: 14 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tab: { flex: 1, backgroundColor: 'rgba(64,86,244,0.1)', borderRadius: 10, paddingVertical: 7, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.25)' },
  tabActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  tabText: { fontSize: 9, fontWeight: font.black, textTransform: 'uppercase', letterSpacing: 1, color: colors.blue },
  tabTextActive: { color: colors.white },
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 14 },
  heroLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  heroDate: { fontSize: 24, fontWeight: font.black, color: colors.white, marginBottom: 4 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 12 },
  confLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 5 },
  confBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  confFill: { height: '100%', backgroundColor: colors.white, borderRadius: 4 },
  confRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confEdge: { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  confVal: { fontSize: 11, fontWeight: font.black, color: colors.white },
  sectionTitle: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.blue, marginBottom: 10 },
  milestone: { backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  milestoneHighlight: { backgroundColor: 'rgba(0,201,153,0.1)', borderWidth: 1.5, borderColor: 'rgba(0,201,153,0.35)' },
  milestoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  milestoneLabel: { fontSize: 12, fontWeight: font.bold, color: colors.dark },
  milestoneDate: { fontSize: 11, fontWeight: font.semibold },
  milestoneBar: { height: 6, backgroundColor: 'rgba(64,86,244,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  milestoneFill: { height: '100%', borderRadius: 4 },
  milestoneConf: { fontSize: 9, color: colors.mid },
  varGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  varCard: { width: '47.5%', backgroundColor: colors.white, borderRadius: 12, padding: 10 },
  varLabel: { fontSize: 9, color: colors.mid, marginBottom: 3 },
  varVal: { fontSize: 13, fontWeight: font.black, color: colors.dark },
  varBar: { height: 3, backgroundColor: 'rgba(64,86,244,0.1)', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  varFill: { height: '100%', borderRadius: 2 },
  footer: { backgroundColor: 'rgba(64,86,244,0.08)', borderRadius: 12, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  footerText: { fontSize: 11, color: colors.mid, flex: 1, lineHeight: 16 },
  btnNext: { backgroundColor: colors.blue, borderRadius: 14, padding: 14, alignItems: 'center' },
  btnNextText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})
