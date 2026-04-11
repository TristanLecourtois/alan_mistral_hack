import { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [onboardingAnswers, setOnboardingAnswers] = useState([])
  const [uploadedDocument, setUploadedDocument] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [generatedQuestions, setGeneratedQuestions] = useState(null)
  const [habits, setHabits] = useState([])
  const [appointmentDate, setAppointmentDate] = useState(null)

  function addHabit(habit) {
    setHabits(prev => prev.find(h => h.text === habit.text) ? prev : [...prev, habit])
  }

  return (
    <AppContext.Provider value={{
      onboardingAnswers, setOnboardingAnswers,
      uploadedDocument, setUploadedDocument,
      analysisResult, setAnalysisResult,
      generatedQuestions, setGeneratedQuestions,
      habits, addHabit,
      appointmentDate, setAppointmentDate,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
