import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const CAL_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const CAL_CELLS = [
  { d: '31', style: { color: colors.light } },
  { d: '1' }, { d: '2' }, { d: '3' }, { d: '4' }, { d: '5' }, { d: '6' },
  { d: '7' },
  { d: '8', style: { backgroundColor: 'rgba(0,201,153,0.15)', borderRadius: 8 }, textStyle: { color: colors.teal, fontWeight: font.semibold } },
  { d: '9' },
  { d: '10', style: { backgroundColor: colors.blue, borderRadius: 8 }, textStyle: { color: colors.white, fontWeight: font.bold } },
  { d: '11' }, { d: '12' }, { d: '13' }, { d: '14' }, { d: '15' }, { d: '16' }, { d: '17' },
  { d: '18', style: { backgroundColor: 'rgba(124,92,252,0.15)', borderRadius: 8 }, textStyle: { color: colors.purple, fontWeight: font.semibold } },
  { d: '19' }, { d: '20' },
  { d: '21', style: { backgroundColor: 'rgba(64,86,244,0.12)', borderRadius: 8 }, textStyle: { color: colors.coral, fontWeight: font.semibold } },
  { d: '22' }, { d: '23' },
  { d: '24', style: { backgroundColor: 'rgba(64,86,244,0.12)', borderRadius: 8 }, textStyle: { color: colors.coral, fontWeight: font.semibold } },
  { d: '25' }, { d: '26' }, { d: '27' },
]

export default function DashboardScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello Sophie 👋</Text>
        <Text style={styles.title}>My Fertility Journey</Text>
      </View>

      <LinearGradient colors={[colors.purple, '#9B7CFF']} style={styles.nextEvent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.necTag}>NEXT APPOINTMENT</Text>
          <Text style={styles.necEvent}>Follicular monitoring</Text>
          <Text style={styles.necSub}>Réunica Clinic · Dr. Mercier</Text>
        </View>
        <View style={styles.necDate}>
          <Text style={styles.necDay}>18</Text>
          <Text style={styles.necMonth}>Avr</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {/* Mini calendar */}
        <View style={[styles.calendar, shadow.sm]}>
          <View style={styles.calNav}>
            <Text style={styles.calArr}>‹</Text>
            <Text style={styles.calMonth}>Avril 2025</Text>
            <Text style={styles.calArr}>›</Text>
          </View>
          <View style={styles.calGrid}>
            {CAL_HEADERS.map((h, i) => (
              <View key={i} style={styles.calCell}><Text style={styles.calHeader}>{h}</Text></View>
            ))}
            {CAL_CELLS.map((c, i) => (
              <View key={i} style={[styles.calCell, c.style]}>
                <Text style={[styles.calDay, c.textStyle]}>{c.d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          {[{ icon: '🗓️', val: 'J8', lbl: 'Current cycle' }, { icon: '💉', val: '3', lbl: 'Injections left' }, { icon: '📁', val: '7', lbl: 'Docs uploaded' }].map((m, i) => (
            <View key={i} style={[styles.metricCard, shadow.sm]}>
              <Text style={styles.mIcon}>{m.icon}</Text>
              <Text style={styles.mVal}>{m.val}</Text>
              <Text style={styles.mLbl}>{m.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Alert */}
        <TouchableOpacity style={styles.alertCard} onPress={() => navigate(SCREENS.PLANNING)}>
          <Text style={styles.alertIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Injection reminder — Gonal-F</Text>
            <Text style={styles.alertDesc}>Tonight at 9pm · 150 IU · Check your stock</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.alertCard} onPress={() => navigate(SCREENS.CONNECTED)}>
          <Text style={styles.alertIcon}>⌚</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Connected Health</Text>
            <Text style={styles.alertDesc}>Apple Watch · Oura Ring · HRV low today</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: { paddingHorizontal: 18, paddingVertical: 8 },
  greeting: { fontSize: 12, color: colors.mid, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: font.black, color: colors.navy },
  nextEvent: { marginHorizontal: 14, marginBottom: 14, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center' },
  necTag: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  necEvent: { fontSize: 16, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  necSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  necDate: { alignItems: 'center' },
  necDay: { fontSize: 30, fontWeight: font.black, color: colors.white, lineHeight: 32 },
  necMonth: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  body: { flex: 1, paddingHorizontal: 14 },
  calendar: { backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 14 },
  calNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calMonth: { fontSize: 13, fontWeight: font.bold, color: colors.dark },
  calArr: { fontSize: 18, color: colors.mid },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100/7}%`, alignItems: 'center', paddingVertical: 4 },
  calHeader: { fontSize: 9, color: colors.mid, fontWeight: font.bold },
  calDay: { fontSize: 11, color: colors.dark, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 2, width: '100%', textAlign: 'center' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, alignItems: 'center' },
  mIcon: { fontSize: 20, marginBottom: 4 },
  mVal: { fontSize: 18, fontWeight: font.black, color: colors.navy },
  mLbl: { fontSize: 9, color: colors.mid, marginTop: 2, textAlign: 'center' },
  alertCard: { backgroundColor: 'rgba(64,86,244,0.08)', borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.25)', borderRadius: 16, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  alertIcon: { fontSize: 20 },
  alertTitle: { fontSize: 13, fontWeight: font.bold, color: colors.navy, marginBottom: 2 },
  alertDesc: { fontSize: 11, color: colors.mid, lineHeight: 16 },
})
