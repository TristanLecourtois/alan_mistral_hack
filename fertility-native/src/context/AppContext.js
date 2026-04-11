import { createContext, useContext, useState, useCallback } from 'react'

const AppContext = createContext(null)

function makeConversation(initialMessage = null) {
  return {
    id: Date.now().toString(),
    title: initialMessage ? initialMessage.slice(0, 40) + (initialMessage.length > 40 ? '…' : '') : 'New conversation',
    messages: [],
    createdAt: new Date(),
  }
}

export function AppProvider({ children }) {
  const [onboardingAnswers, setOnboardingAnswers] = useState([])
  const [uploadedDocument, setUploadedDocument] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [generatedQuestions, setGeneratedQuestions] = useState(null)
  const [habits, setHabits] = useState([])
  const [appointmentDate, setAppointmentDate] = useState(null)

  // Multi-conversation state
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  // Used to pre-fill Copilot from Prepare screen
  const [pendingCopilotMessage, setPendingCopilotMessage] = useState(null)

  function addHabit(habit) {
    setHabits(prev => prev.find(h => h.text === habit.text) ? prev : [...prev, habit])
  }

  const createConversation = useCallback((initialText = null) => {
    const conv = makeConversation(initialText)
    setConversations(prev => [conv, ...prev])
    setActiveConversationId(conv.id)
    return conv.id
  }, [])

  const deleteConversation = useCallback((id) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    setActiveConversationId(prev => prev === id ? null : prev)
  }, [])

  const updateConversationMessages = useCallback((id, messages) => {
    setConversations(prev => prev.map(c =>
      c.id === id
        ? { ...c, messages, title: messages.find(m => m.role === 'user')?.content?.slice(0, 40) || c.title }
        : c
    ))
  }, [])

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null

  return (
    <AppContext.Provider value={{
      onboardingAnswers, setOnboardingAnswers,
      uploadedDocument, setUploadedDocument,
      analysisResult, setAnalysisResult,
      generatedQuestions, setGeneratedQuestions,
      habits, addHabit,
      appointmentDate, setAppointmentDate,
      // Copilot conversations
      conversations,
      activeConversationId, setActiveConversationId,
      activeConversation,
      createConversation,
      deleteConversation,
      updateConversationMessages,
      pendingCopilotMessage, setPendingCopilotMessage,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
