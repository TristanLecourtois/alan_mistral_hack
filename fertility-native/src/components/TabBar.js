import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font } from '../theme'

const TABS = [
  { icon: '🏠', label: 'Home',     screen: SCREENS.DASHBOARD },
  { icon: '📁', label: 'Results',  screen: SCREENS.UPLOAD },
  { icon: '💬', label: 'Copilot', screen: SCREENS.ONBOARDING },
  { icon: '📅', label: 'Planning', screen: SCREENS.PLANNING },
  { icon: '⌚', label: 'Health',   screen: SCREENS.CONNECTED },
]

export default function TabBar() {
  const { screen, navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 4 }]}>
      {TABS.map((tab) => {
        const active = screen === tab.screen
        return (
          <TouchableOpacity key={tab.screen} style={styles.tab} onPress={() => navigate(tab.screen)}>
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {active && <View style={styles.activeDot} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  icon: { fontSize: 22 },
  label: { fontSize: 9, color: colors.mid },
  labelActive: { color: colors.teal, fontWeight: font.bold },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.teal,
  },
})
