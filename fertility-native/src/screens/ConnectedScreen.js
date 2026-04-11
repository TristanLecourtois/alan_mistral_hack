import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const devices = [
  { icon: '⌚', name: 'Apple Watch', connected: true },
  { icon: '💍', name: 'Oura Ring', connected: true },
  { icon: '🌊', name: 'Flow', connected: true },
]

const bioCards = [
  { icon: '💤', val: '6h42', unit: 'last night', label: 'Sleep', trend: '↓ –38min', trendColor: colors.orangeWarn, trendBg: 'rgba(245,158,11,0.2)' },
  { icon: '❤️', val: '34', unit: 'ms', label: 'HRV', trend: '↓ Bas', trendColor: colors.orangeWarn, trendBg: 'rgba(245,158,11,0.2)', highlight: true },
  { icon: '🏃', val: '4 218', unit: 'steps today', label: 'Activity', trend: '→ stable', trendColor: colors.mid, trendBg: 'rgba(0,0,0,0.06)' },
  { icon: '🌡️', val: '+0.4°', unit: 'vs baseline', label: 'Basal temp.', trend: '↑ LH phase', trendColor: colors.green, trendBg: 'rgba(0,201,153,0.15)' },
]

const recos = [
  { icon: '😴', title: 'Insufficient sleep this week', desc: 'Your HRV dropped 22% — sleep deprivation is correlated with weaker ovarian response under stimulation.', source: 'Correlation observed · ESHRE Study 2023', warn: true },
  { icon: '🍷', title: 'Alcohol detected 3 evenings this week', desc: 'Even moderate consumption can reduce egg quality. Complete pause recommended during stimulation.', source: 'WHO · HAS IVF guidelines 2022', warn: true },
  { icon: '🧘', title: 'Adapted exercise intensity', desc: 'Your data shows moderate activity — ideal for this phase. Avoid intense effort from Day 10.', warn: false },
]

export default function ConnectedScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.tag}>CONNECTED DATA</Text>
        <Text style={styles.title}>My health profile</Text>
        <Text style={styles.sub}>Real-time biometrics · Shared with your doctor</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Devices */}
        <View style={styles.devicesRow}>
          {devices.map((d, i) => (
            <View key={i} style={[styles.devicePill, d.connected && styles.deviceConnected]}>
              <Text style={styles.dIcon}>{d.icon}</Text>
              <View>
                <Text style={styles.dName}>{d.name}</Text>
                <Text style={[styles.dStatus, { color: d.connected ? colors.teal : colors.mid }]}>Connected</Text>
              </View>
              {d.connected && <View style={styles.connDot} />}
            </View>
          ))}
          <View style={[styles.devicePill, { borderStyle: 'dashed' }]}>
            <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.3)' }}>＋</Text>
            <Text style={{ fontSize: 10, color: colors.mid }}>Add</Text>
          </View>
        </View>

        {/* Biometrics */}
        <View style={styles.bioGrid}>
          {bioCards.map((card, i) => (
            <View key={i} style={[styles.bioCard, card.highlight && styles.bioCardHighlight, shadow.sm]}>
              <Text style={styles.bcIcon}>{card.icon}</Text>
              <Text style={styles.bcVal}>{card.val}</Text>
              <Text style={styles.bcUnit}>{card.unit}</Text>
              <Text style={styles.bcLabel}>{card.label}</Text>
              <View style={[styles.bcTrend, { backgroundColor: card.trendBg }]}>
                <Text style={[styles.bcTrendText, { color: card.trendColor }]}>{card.trend}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recommendations */}
        <Text style={styles.recoTitle}>🤖 PERSONALIZED RECOMMENDATIONS</Text>

        {recos.map((r, i) => (
          <View key={i} style={[styles.recoCard, { backgroundColor: r.warn ? 'rgba(244,96,124,0.06)' : 'rgba(0,201,153,0.08)', borderColor: r.warn ? 'rgba(244,96,124,0.2)' : 'rgba(0,201,153,0.15)' }]}>
            <Text style={styles.recoIcon}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoName}>{r.title}</Text>
              <Text style={styles.recoDesc}>{r.desc}</Text>
              {r.source && <Text style={styles.recoSource}>{r.source}</Text>}
            </View>
          </View>
        ))}

        {/* Share */}
        <TouchableOpacity style={{ borderRadius: 16, overflow: 'hidden', marginTop: 4 }}>
          <LinearGradient colors={[colors.teal, '#00A87F']} style={styles.shareBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={{ fontSize: 24 }}>👨‍⚕️</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.shareTitle}>Share with Dr. Mercier</Text>
              <Text style={styles.shareSub}>Full biometric report · Last 30 days · AI-generated</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: colors.teal, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.dark },
  sub: { fontSize: 11, color: colors.mid, marginTop: 3 },
  body: { flex: 1, paddingHorizontal: 14 },
  devicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  devicePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  deviceConnected: { borderColor: 'rgba(0,201,153,0.5)', backgroundColor: 'rgba(0,201,153,0.1)' },
  dIcon: { fontSize: 16 },
  dName: { fontSize: 11, fontWeight: font.bold, color: colors.dark },
  dStatus: { fontSize: 9 },
  connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal, marginLeft: 2 },
  bioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  bioCard: { width: '47.5%', backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)' },
  bioCardHighlight: { borderColor: 'rgba(64,86,244,0.4)', backgroundColor: 'rgba(232,115,74,0.07)' },
  bcIcon: { fontSize: 18, marginBottom: 6 },
  bcVal: { fontSize: 22, fontWeight: font.black, color: colors.dark, lineHeight: 24 },
  bcUnit: { fontSize: 10, color: colors.mid, marginTop: 1 },
  bcLabel: { fontSize: 10, color: colors.mid, marginTop: 5 },
  bcTrend: { position: 'absolute', top: 10, right: 10, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  bcTrendText: { fontSize: 9, fontWeight: font.bold },
  recoTitle: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.blue, marginBottom: 10 },
  recoCard: { borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', gap: 10, borderWidth: 1 },
  recoIcon: { fontSize: 20, marginTop: 1 },
  recoName: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 3 },
  recoDesc: { fontSize: 11, color: colors.mid, lineHeight: 16 },
  recoSource: { fontSize: 9, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  shareBanner: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  shareTitle: { fontSize: 13, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  shareSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 16 },
})
