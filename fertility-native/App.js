import { View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavProvider, useNav, SCREENS } from './src/navigation'
import { AppProvider } from './src/context/AppContext'
import TabBar from './src/components/TabBar'

import WelcomeScreen  from './src/screens/WelcomeScreen'
import UploadScreen   from './src/screens/UploadScreen'
import AnalyseScreen  from './src/screens/AnalyseScreen'
import ProfileScreen  from './src/screens/ProfileScreen'
import ResultsScreen  from './src/screens/ResultsScreen'
import CopilotScreen  from './src/screens/CopilotScreen'
import HealthScreen   from './src/screens/HealthScreen'

// Screens in the main flow — no tab bar
const FLOW_SCREENS = new Set([
  SCREENS.WELCOME,
  SCREENS.UPLOAD,
  SCREENS.ANALYSE,
  SCREENS.PROFILE,
])

function Router() {
  const { screen } = useNav()
  const showTabs = !FLOW_SCREENS.has(screen)

  const renderScreen = () => {
    switch (screen) {
      case SCREENS.WELCOME:  return <WelcomeScreen />
      case SCREENS.UPLOAD:   return <UploadScreen />
      case SCREENS.ANALYSE:  return <AnalyseScreen />
      case SCREENS.PROFILE:  return <ProfileScreen />
      case SCREENS.RESULTS:  return <ResultsScreen />
      case SCREENS.COPILOT:  return <CopilotScreen />
      case SCREENS.HEALTH:   return <HealthScreen />
      default:               return <WelcomeScreen />
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.screen}>{renderScreen()}</View>
      {showTabs && <TabBar />}
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavProvider>
          <StatusBar style="auto" />
          <Router />
        </NavProvider>
      </AppProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
})
