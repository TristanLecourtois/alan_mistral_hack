import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

export default function WelcomeScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <LinearGradient colors={['#F0F4FF', '#E8ECFF']} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>

        <View style={styles.logo}>
          <View style={styles.logoDot}><Text style={styles.logoDotEmoji}>🧬</Text></View>
          <Text style={styles.logoName}>Fertility Copilot</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.tag}>Alan x Mistral</Text>
          <Text style={styles.title}>
            Clarity & care{'\n'}at every step of{'\n'}your{' '}
            <Text style={styles.titleAccent}>fertility journey.</Text>
          </Text>
          <Text style={styles.subtitle}>
            The intelligent companion guiding you from your very first question through every step of your journey.
          </Text>

          <View style={styles.statsRow}>
            {[
              { num: '100k', lbl: 'couples / year' },
              { num: '40%', lbl: 'feel alone' },
              { num: '3→6m', lbl: 'wait for appt' },
            ].map((s, i) => (
              <View key={i} style={[styles.statPill, shadow.sm]}>
                <Text style={styles.statNum}>{s.num}</Text>
                <Text style={styles.statLbl}>{s.lbl}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.btnPrimary, shadow.md]} onPress={() => navigate(SCREENS.ONBOARDING)}>
            <Text style={styles.btnPrimaryText}>Start my journey →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigate(SCREENS.DASHBOARD)}>
            <Text style={styles.btnSecondaryText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  logoDot: { width: 32, height: 32, backgroundColor: colors.blue, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoDotEmoji: { fontSize: 16 },
  logoName: { fontSize: 15, fontWeight: font.bold, color: colors.dark },
  hero: { flex: 1, justifyContent: 'center' },
  tag: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.teal, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: font.black, color: colors.dark, lineHeight: 38, marginBottom: 14 },
  titleAccent: { color: colors.teal },
  subtitle: { fontSize: 13, color: colors.mid, lineHeight: 21, marginBottom: 28 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statPill: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(64,86,244,0.12)' },
  statNum: { fontSize: 16, fontWeight: font.black, color: colors.teal },
  statLbl: { fontSize: 9, color: colors.mid, marginTop: 2, textAlign: 'center' },
  btnPrimary: { backgroundColor: colors.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 15, fontWeight: font.bold, letterSpacing: 0.3 },
  btnSecondaryText: { color: colors.mid, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
})
