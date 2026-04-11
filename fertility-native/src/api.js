import { API_BASE_URL } from './config'

/**
 * Upload a document to the backend OCR endpoint.
 * @param {object} file - object from expo-document-picker { uri, name, mimeType }
 * @returns {Promise<object>} - parsed OCR result
 */
export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/pdf',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)  // 120s timeout

  let response
  try {
    response = await fetch(`${API_BASE_URL}/ocr`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — React Native sets it automatically with the correct multipart boundary
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Erreur serveur: ${response.status}`)
  }

  return response.json()
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`)
  return response.json()
}