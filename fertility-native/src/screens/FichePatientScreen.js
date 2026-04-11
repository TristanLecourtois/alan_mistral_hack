import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const results = [
  { dot: colors.green,      name: 'Concentration',       norm: 'WHO norm ≥ 16 M/mL', val: '42',  unit: 'M/mL', color: colors.green },
  { dot: colors.green,      name: 'Volume',               norm: 'WHO norm ≥ 1.4 mL',  val: '3.2', unit: 'mL',   color: colors.green },
  { dot: colors.orangeWarn, name: 'Progressive motility', norm: 'WHO norm ≥ 32%',      val: '28',  unit: '%',    color: colors.orangeWarn },
  { dot: colors.orangeWarn, name: 'Normal morphology',    norm: 'WHO norm ≥ 4%',       val: '3',   unit: '%',    color: colors.orangeWarn },
]

export default function FichePatientScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.tag}>Semen Analysis · AI Analysis</Text>
        <Text style={styles.title}>Your report</Text>
        <Text style={styles.date}>March 2025 · Analyzed by Mistral OCR 3 + Small 4</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: colors.green, label: 'Within norms' },
            { color: colors.orangeWarn, label: 'Slightly low' },
            { color: colors.redAlert, label: 'Below WHO' },
          ].map((l, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>CONCENTRATION · VOLUME · MOTILITY</Text>

        {results.map((r, i) => (
          <View key={i} style={[styles.resultRow, shadow.sm]}>
            <View style={[styles.resDot, { backgroundColor: r.dot }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resName}>{r.name}</Text>
              <Text style={styles.resNorm}>{r.norm}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.resVal, { color: r.color }]}>{r.val}</Text>
              <Text style={styles.resUnit}>{r.unit}</Text>
            </View>
          </View>
        ))}

        <LinearGradient colors={['#4056F4', '#7C5CFC']} style={styles.insightBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.ibannTag}>💡 Fertility Copilot says</Text>
          <Text style={styles.ibannText}>
            Your concentration is <Text style={styles.ibannBold}>excellent</Text>. Motility (28%) is slightly below WHO norms (32%) — this{' '}
            <Text style={styles.ibannBold}>is not necessarily problematic in isolation</Text> and can vary between samples.
          </Text>
        </LinearGradient>

        <TouchableOpacity style={[styles.btnCoral, shadow.md]} onPress={() => navigate(SCREENS.QUESTIONS)}>
          <Text style={styles.btnCoralText}>See questions for my appointment →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: { backgroundColor: colors.white, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  tag: { fontSize: 10, color: colors.blue, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.dark, marginBottom: 2 },
  date: { fontSize: 11, color: colors.mid },
  body: { flex: 1, padding: 14 },
  legend: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.mid },
  sectionTitle: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.mid, marginBottom: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  resDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  resName: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  resNorm: { fontSize: 10, color: colors.mid, marginTop: 1 },
  resVal: { fontSize: 14, fontWeight: font.black },
  resUnit: { fontSize: 10, color: colors.mid },
  insightBanner: { borderRadius: 16, padding: 14, marginTop: 12, marginBottom: 4 },
  ibannTag: { fontSize: 10, color: colors.coral, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  ibannText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  ibannBold: { color: colors.white, fontWeight: font.bold },
  btnCoral: { backgroundColor: colors.coral, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  btnCoralText: { color: colors.white, fontSize: 14, fontWeight: font.bold },
})
