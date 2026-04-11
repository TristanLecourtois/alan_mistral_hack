import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font } from '../theme'

const TABS = [
  { icon: '📊', label: 'Results',  screen: SCREENS.RESULTS },
  { icon: '📋', label: 'Prepare',  screen: SCREENS.PREPARE },
  { icon: '💬', label: 'Chat',     screen: SCREENS.COPILOT },
  { icon: '💪', label: 'Improve',  screen: SCREENS.IMPROVE },
]

export default function TabBar() {
  const { screen, navigate } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 2 }]}>
      {TABS.map((tab) => {
        const active = screen === tab.screen
        return (
          <TouchableOpacity
            key={tab.screen}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => navigate(tab.screen)}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
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
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  tabActive: {},
  icon: { fontSize: 20 },
  label: { fontSize: 10, color: colors.mid, fontWeight: font.medium },
  labelActive: { color: colors.blue, fontWeight: font.bold },
})
