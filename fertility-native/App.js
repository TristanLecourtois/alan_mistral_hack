import { View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavProvider, useNav, SCREENS } from './src/navigation'
import TabBar from './src/components/TabBar'

import WelcomeScreen      from './src/screens/WelcomeScreen'
import OnboardingScreen   from './src/screens/OnboardingScreen'
import ResultOkScreen     from './src/screens/ResultOkScreen'
import UploadScreen       from './src/screens/UploadScreen'
import AnalyseScreen      from './src/screens/AnalyseScreen'
import FichePatientScreen from './src/screens/FichePatientScreen'
import QuestionsScreen    from './src/screens/QuestionsScreen'
import DashboardScreen    from './src/screens/DashboardScreen'
import PlanningScreen     from './src/screens/PlanningScreen'
import PredictionScreen   from './src/screens/PredictionScreen'
import ConnectedScreen    from './src/screens/ConnectedScreen'

// Screens sans tab bar (flux onboarding / loading)
const FLOW_SCREENS = new Set([
  SCREENS.WELCOME,
  SCREENS.RESULT_OK,
  SCREENS.ANALYSE,
])

function Router() {
  const { screen } = useNav()
  const showTabs = !FLOW_SCREENS.has(screen)

  const renderScreen = () => {
    switch (screen) {
      case SCREENS.WELCOME:    return <WelcomeScreen />
      case SCREENS.ONBOARDING: return <OnboardingScreen />
      case SCREENS.RESULT_OK:  return <ResultOkScreen />
      case SCREENS.UPLOAD:     return <UploadScreen />
      case SCREENS.ANALYSE:    return <AnalyseScreen />
      case SCREENS.FICHE:      return <FichePatientScreen />
      case SCREENS.QUESTIONS:  return <QuestionsScreen />
      case SCREENS.DASHBOARD:  return <DashboardScreen />
      case SCREENS.PLANNING:   return <PlanningScreen />
      case SCREENS.PREDICTION: return <PredictionScreen />
      case SCREENS.CONNECTED:  return <ConnectedScreen />
      default:                 return <WelcomeScreen />
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        {renderScreen()}
      </View>
      {showTabs && <TabBar />}
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavProvider>
        <StatusBar style="auto" />
        <Router />
      </NavProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
})
