import type { ApplicationField, ChatMessage, ConciergeApplication, UploadedFile } from '../types'

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const SESSION_KEY = 'hyna-ai-concierge-session-v1'

export type ApiHealth = {
  ok: boolean
  service: string
  ai: { mode: 'demo' | 'openai'; model: string | null; configured: boolean; requiresRealAi: boolean }
  storage: string
}

export type ChatApiResponse = {
  reply: string
  updates: Array<{ id: string; value: string; confidence: number; sourceMessageId: string }>
  runtime: { mode: 'demo' | 'openai'; model: string | null; configured: boolean; fallback: boolean }
}

function apiUrl(path: string) {
  return `${configuredBase}${path}`
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeout = 12_000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

async function responseOrError(response: Response) {
  const payload = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`)
  return payload
}

export function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const sessionId = crypto.randomUUID()
  localStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetchWithTimeout(apiUrl('/api/health'), { headers: { Accept: 'application/json' } }, 2500)
  return responseOrError(response) as Promise<ApiHealth>
}

export async function sendChatToApi(input: {
  message: string
  messageId: string
  applicationId?: string
  fields: ApplicationField[]
  messages: ChatMessage[]
}): Promise<ChatApiResponse> {
  const response = await fetchWithTimeout(apiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...input, sessionId: getSessionId() }),
  }, 35_000)
  return responseOrError(response) as Promise<ChatApiResponse>
}

export async function createApplicationWithApi(application: ConciergeApplication): Promise<ConciergeApplication> {
  const response = await fetchWithTimeout(apiUrl('/api/applications'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(application),
  })
  const payload = await responseOrError(response) as { application: ConciergeApplication }
  return payload.application
}

export async function uploadDocumentToApi(file: File, applicationId?: string): Promise<UploadedFile> {
  const query = new URLSearchParams({ sessionId: getSessionId() })
  if (applicationId) query.set('applicationId', applicationId)
  const form = new FormData()
  form.append('document', file)
  const response = await fetchWithTimeout(apiUrl(`/api/documents?${query.toString()}`), {
    method: 'POST', body: form, headers: { Accept: 'application/json' },
  }, 30_000)
  const payload = await responseOrError(response) as { document: UploadedFile }
  return payload.document
}

export const frontendRequiresApi = import.meta.env.VITE_REQUIRE_API === 'true'
