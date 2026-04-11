import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

// Fallback mock data when no real OCR result
const MOCK_RESULTS = [
  { key: 'concentration',        label: 'Concentration',         value: 42,   unit: 'M/mL', status: 'ok',   reference: '≥ 16 M/mL' },
  { key: 'volume',               label: 'Volume',                value: 3.2,  unit: 'mL',   status: 'ok',   reference: '≥ 1.4 mL' },
  { key: 'motility_progressive', label: 'Progressive motility',  value: 28,   unit: '%',    status: 'warn', reference: '≥ 32 %' },
  { key: 'morphology_normal',    label: 'Normal morphology',     value: 3,    unit: '%',    status: 'warn', reference: '≥ 4 %' },
]

function statusColor(status) {
  if (status === 'ok')    return colors.green
  if (status === 'warn')  return colors.orangeWarn
  if (status === 'alert') return colors.redAlert
  return colors.mid
}

function statusLabel(status) {
  if (status === 'ok')    return 'Within norms'
  if (status === 'warn')  return 'Slightly low'
  if (status === 'alert') return 'Below WHO'
  return ''
}

function buildInsight(values) {
  if (!values || values.length === 0) return null
  const alerts = values.filter(v => v.status === 'alert')
  const warns  = values.filter(v => v.status === 'warn')
  const ok     = values.filter(v => v.status === 'ok')

  if (alerts.length === 0 && warns.length === 0) {
    return 'All values are within WHO 2021 norms. Keep it up!'
  }
  const issues = [...alerts, ...warns].map(v => `${v.label} (${v.value} ${v.unit})`).join(', ')
  const plural = alerts.length + warns.length > 1 ? 'values are' : 'value is'
  return `${issues} ${plural} outside WHO norms. Discuss with your doctor — a single sample is never definitive.`
}

export default function FichePatientScreen() {
  const { navigate, params } = useNav()
  const insets = useSafeAreaInsets()

  const ocrResult = params?.ocrResult
  const fileName  = params?.fileName || 'Document'

  const values  = ocrResult?.values  ?? MOCK_RESULTS
  const docType = ocrResult?.doc_type ?? 'Semen Analysis'
  const insight = buildInsight(values)

  // Group by category for display
  const spermKeys   = ['volume','concentration','motility_progressive','motility_total','motility_non','morphology_normal','morphology_abnormal','vitality','ph','pus_cells','liquefaction']
  const hormoneKeys = ['amh','fsh','lh','e2','tsh','prolactin','testosterone','antral_follicle_count']

  const spermValues   = values.filter(v => spermKeys.includes(v.key))
  const hormoneValues = values.filter(v => hormoneKeys.includes(v.key))
  const otherValues   = values.filter(v => !spermKeys.includes(v.key) && !hormoneKeys.includes(v.key))

  function renderValue(v, i) {
    const col = statusColor(v.status)
    return (
      <View key={i} style={[styles.resultRow, shadow.sm]}>
        <View style={[styles.resDot, { backgroundColor: col }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.resName}>{v.label}</Text>
          <Text style={styles.resNorm}>WHO norm {v.reference}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.resVal, { color: col }]}>{v.value}</Text>
          <Text style={styles.resUnit}>{v.unit}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.tag}>{docType.toUpperCase()} · AI Analysis</Text>
        <Text style={styles.title}>Your report</Text>
        <Text style={styles.date}>{fileName} · Analyzed by Mistral OCR</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: colors.green,      label: 'Within norms' },
            { color: colors.orangeWarn, label: 'Slightly low' },
            { color: colors.redAlert,   label: 'Below WHO' },
          ].map((l, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>

        {spermValues.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SPERMOGRAM</Text>
            {spermValues.map(renderValue)}
          </>
        )}

        {hormoneValues.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>HORMONAL PANEL</Text>
            {hormoneValues.map(renderValue)}
          </>
        )}

        {otherValues.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>OTHER VALUES</Text>
            {otherValues.map(renderValue)}
          </>
        )}

        {values.length === 0 && (
          <View style={[styles.resultRow, shadow.sm]}>
            <Text style={{ color: colors.mid, fontSize: 13 }}>No medical values could be extracted from this document.</Text>
          </View>
        )}

        {insight && (
          <LinearGradient colors={['#4056F4', '#7C5CFC']} style={styles.insightBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.ibannTag}>💡 Fertility Copilot says</Text>
            <Text style={styles.ibannText}>{insight}</Text>
          </LinearGradient>
        )}

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
