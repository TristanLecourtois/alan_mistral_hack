import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

export default function WelcomeScreen() {
  const { navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <LinearGradient colors={['#1B2B6B', '#4056F4']} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>

        <View style={styles.logo}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logoName}>Mia</Text>
          <Text style={styles.logoPowered}>Alan × Mistral</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>
            I just received{'\n'}my results…{'\n'}
            <Text style={styles.titleAccent}>and I don't{'\n'}understand them.</Text>
          </Text>

          <Text style={styles.subtitle}>
            Waiting weeks for answers can be stressful.{'\n'}
            We help you understand and act — today.
          </Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity style={[styles.btn, shadow.lg]} onPress={() => navigate(SCREENS.UPLOAD)}>
            <Text style={styles.btnText}>Upload my results →</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>PDF · Photo · Lab report · Any format</Text>
        </View>

      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  logo: { alignItems: 'flex-start' },
  logoImage: { height: 120, width: 360, marginBottom: 2, marginLeft: -130 },
  logoName: { fontSize: 34, fontWeight: font.black, color: colors.white, letterSpacing: 1, marginBottom: 2 },
  logoPowered: { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 },
  hero: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  title: { fontSize: 34, fontWeight: font.black, color: 'rgba(255,255,255,0.5)', lineHeight: 42, marginBottom: 20 },
  titleAccent: { color: colors.white },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 24, letterSpacing: 1 },
  bottom: { gap: 12 },
  btn: { backgroundColor: colors.teal, borderRadius: 18, padding: 18, alignItems: 'center' },
  btnText: { color: colors.white, fontSize: 16, fontWeight: font.bold, letterSpacing: 0.3 },
  hint: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
})
