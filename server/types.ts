import type { ApplicationField, ChatMessage, ConciergeApplication, UploadedFile } from '../src/types'

export type AiRuntime = {
  mode: 'demo' | 'openai'
  model: string | null
  configured: boolean
  fallback: boolean
}

export type ChatRequest = {
  message: string
  messageId: string
  applicationId?: string
  sessionId: string
  fields: ApplicationField[]
  messages: ChatMessage[]
  safetyIdentifier?: string
}

export type FieldUpdate = {
  id: string
  value: string
  confidence: number
  sourceMessageId: string
}

export type ChatResponse = {
  reply: string
  updates: FieldUpdate[]
  runtime: AiRuntime
}

export type StoredDocument = UploadedFile & {
  size: number
  mimeType: string
  sha256: string
  storageMode: 'local-pilot'
  analysisMode: 'not-configured'
}

export type CreateApplicationResponse = {
  application: ConciergeApplication
  receipt: {
    applicationId: string
    version: number
    createdAt: string
  }
}
