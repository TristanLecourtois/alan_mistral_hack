import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const months = [
  { name: 'June', bars: [{ flex: 2, bg: colors.teal, label: 'Stimulation', tc: 'white' }, { flex: 1, bg: colors.coral, label: 'Retrieval', tc: 'white' }, { flex: 1, bg: colors.mid, label: 'Wait', tc: 'white' }] },
  { name: 'July', bars: [{ flex: 3, bg: '#E8F5E8', border: colors.green, label: '✈️ Holiday window', tc: colors.green }, { flex: 2, bg: colors.purple, label: 'Results', tc: 'white' }] },
  { name: 'August', bars: [{ flex: 1, bg: '#E8F5E8', border: colors.green, label: '🏖️ Full freedom', tc: colors.green }] },
  { name: 'September', bars: [{ flex: 1, bg: colors.teal, label: 'Transfer', tc: 'white' }, { flex: 2, bg: colors.amber, label: '⏳ Beta-HCG wait', tc: 'white' }] },
]

const actions = [
  { icon: '✈️', title: 'Book your vacation', desc: 'Ideal window: July 25 – Aug 25. No procedures planned.', badge: 'Free', badgeColor: colors.green, borderColor: 'rgba(0,201,153,0.2)' },
  { icon: '💼', title: 'Block your work calendar', desc: 'Block: June 3–18 (stimulation) and Sep 1–15', borderColor: 'rgba(245,158,11,0.25)' },
  { icon: '👫', title: 'Say yes to July', desc: 'That wedding, that family trip — July is free.', badge: 'OK', badgeColor: colors.green },
]

export default function PlanningScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.tag}>PLANNING</Text>
        <Text style={styles.title}>My life this quarter</Text>
        <Text style={styles.sub}>Based on your protocol · Dr. Mercier</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#4056F4', '#7C5CFC']} style={styles.insightBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ibTitle}>August: your free window</Text>
            <Text style={styles.ibText}>The clinic is closed. Best time to plan a vacation with no impact on your treatment.</Text>
          </View>
        </LinearGradient>

        <View style={[styles.timelineCard, shadow.sm]}>
          <Text style={styles.timelineLabel}>📅 Predicted timeline</Text>
          {months.map((month, i) => (
            <View key={i} style={styles.monthRow}>
              <Text style={styles.monthName}>{month.name}</Text>
              <View style={styles.bars}>
                {month.bars.map((bar, j) => (
                  <View key={j} style={[styles.bar, { flex: bar.flex, backgroundColor: bar.bg, borderWidth: bar.border ? 1.5 : 0, borderColor: bar.border }]}>
                    <Text style={[styles.barText, { color: bar.tc }]} numberOfLines={1}>{bar.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.actionsTitle}>RECOMMENDED ACTIONS</Text>

        {actions.map((a, i) => (
          <View key={i} style={[styles.actionCard, shadow.sm, { borderColor: a.borderColor || 'transparent', borderWidth: 1.5 }]}>
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{a.title}</Text>
              <Text style={styles.actionDesc}>{a.desc}</Text>
            </View>
            {a.badge && <View style={[styles.badge, { backgroundColor: a.badgeColor }]}><Text style={styles.badgeText}>{a.badge}</Text></View>}
          </View>
        ))}

        <TouchableOpacity style={styles.shareBanner} onPress={() => navigate(SCREENS.PREDICTION)}>
          <LinearGradient colors={['#4056F4', '#7C5CFC']} style={styles.shareBannerInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={{ fontSize: 18 }}>🔒</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.shareTitle}>Share with my HR</Text>
              <Text style={styles.shareSub}>Anonymous mode · No diagnosis · Just the dates</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  header: { paddingHorizontal: 18, paddingVertical: 8 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: colors.teal, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.navy },
  sub: { fontSize: 11, color: colors.mid, marginTop: 3 },
  body: { flex: 1, paddingHorizontal: 14 },
  insightBanner: { borderRadius: 16, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  ibTitle: { fontSize: 12, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  ibText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 17 },
  timelineCard: { backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 14 },
  timelineLabel: { fontSize: 11, fontWeight: font.bold, color: colors.dark, marginBottom: 12 },
  monthRow: { marginBottom: 10 },
  monthName: { fontSize: 10, fontWeight: font.bold, color: colors.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  bars: { flexDirection: 'row', gap: 4, height: 30 },
  bar: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  barText: { fontSize: 8, fontWeight: font.bold },
  actionsTitle: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.coral, marginBottom: 10 },
  actionCard: { backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { fontSize: 20 },
  actionTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 3 },
  actionDesc: { fontSize: 11, color: colors.mid, lineHeight: 16 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: font.bold, color: colors.white },
  shareBanner: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  shareBannerInner: { padding: 12, flexDirection: 'row', alignItems: 'center' },
  shareTitle: { fontSize: 12, fontWeight: font.bold, color: colors.white, marginBottom: 2 },
  shareSub: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
})
