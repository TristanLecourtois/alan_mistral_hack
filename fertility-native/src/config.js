export const CONFIG = {
  // Backend FastAPI
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000',

  // Mistral API key — fill in before the demo or set EXPO_PUBLIC_MISTRAL_API_KEY in .env
  MISTRAL_API_KEY: process.env.EXPO_PUBLIC_MISTRAL_API_KEY || '',

  // Thryve API key (Phase 2)
  THRYVE_API_KEY: process.env.EXPO_PUBLIC_THRYVE_API_KEY || '',

  // Set to true to always use mock data (useful for offline demo)
  FORCE_MOCK: false,
}
