import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const insights = [
  { icon: '🗓️', title: 'Keep trying', text: 'Consulting is recommended after 12 months of regular attempts at your age.' },
  { icon: '📊', title: 'Prepare now', text: 'Upload your tests to have them ready if you consult.' },
  { icon: '💊', title: 'Good habits', text: 'Folic acid, quit tobacco and alcohol, cycle tracking recommended.' },
]

export default function ResultOkScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>✅</Text>
        <Text style={styles.heroTitle}>Not urgent yet</Text>
        <Text style={styles.heroText}>Based on your answers, your situation{'\n'}falls within statistical norms.</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={[styles.card, shadow.lg]}>
          {/* Big stat */}
          <View style={styles.statBig}>
            <Text style={styles.statNum}>85<Text style={styles.statPct}>%</Text></Text>
            <Text style={styles.statUnit}>of couples in your profile</Text>
            <Text style={styles.statLabel}>conceive naturally within the year{' '}<Text style={{ color: colors.mid }}>— Source OMS</Text></Text>
          </View>

          {/* Insights */}
          <View style={styles.insightList}>
            {insights.map((item, i) => (
              <View key={i} style={styles.insightItem}>
                <Text style={styles.insightIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{item.title}</Text>
                  <Text style={styles.insightText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.btnTeal, shadow.md]} onPress={() => navigate(SCREENS.UPLOAD)}>
            <Text style={styles.btnTealText}>Upload my results →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  hero: { backgroundColor: colors.teal, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, alignItems: 'center' },
  heroIcon: { fontSize: 44, marginBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: font.black, color: colors.white, marginBottom: 6 },
  heroText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },
  scroll: { flex: 1, marginTop: -20 },
  card: { backgroundColor: colors.white, borderRadius: 20, marginHorizontal: 16, padding: 20 },
  statBig: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.lightgray, marginBottom: 16 },
  statNum: { fontSize: 48, fontWeight: font.black, color: colors.teal, lineHeight: 52 },
  statPct: { fontSize: 24 },
  statUnit: { fontSize: 12, color: colors.mid, marginTop: 4 },
  statLabel: { fontSize: 13, color: colors.dark, fontWeight: font.semibold, marginTop: 6, textAlign: 'center' },
  insightList: { gap: 10, marginBottom: 16 },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F8FDF9', borderRadius: 12, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.teal },
  insightIcon: { fontSize: 16, marginTop: 2 },
  insightTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  insightText: { fontSize: 12, color: colors.dark, lineHeight: 18 },
  btnTeal: { backgroundColor: colors.teal, borderRadius: 14, padding: 14, alignItems: 'center' },
  btnTealText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})
