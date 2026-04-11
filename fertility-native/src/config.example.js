// Copy this file to config.js and fill in your values
// config.js is gitignored — never commit secrets

export const CONFIG = {
  // Backend FastAPI — update IP in .env if your Mac changes networks
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://YOUR_MAC_IP:8000',

  // Mistral API key — set EXPO_PUBLIC_MISTRAL_API_KEY in .env (never commit the key)
  MISTRAL_API_KEY: process.env.EXPO_PUBLIC_MISTRAL_API_KEY || '',

  // Set to true to always use mock data (useful for offline demo)
  FORCE_MOCK: false,
}
