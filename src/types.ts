export type OrbState = 'idle' | 'listening' | 'typing' | 'thinking' | 'responding' | 'collecting' | 'validating' | 'completed' | 'error'
export type FieldStatus = 'Confirmed' | 'AI interpreted' | 'Missing' | 'Needs review' | 'Broker review required'
export type FieldSource = 'User message' | 'Uploaded document' | 'Broker amendment' | 'AI calculation'
export type FieldCategory = 'Loan Request' | 'Borrowers' | 'Income' | 'Assets' | 'Liabilities' | 'Security' | 'Documents' | 'Additional Notes'

export type ApplicationField = {
  id: string
  label: string
  category: FieldCategory
  value: string
  status: FieldStatus
  source: FieldSource
  required: boolean
  confidence?: number
  sourceMessageId?: string
}

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user' | 'system'
  body: string
  timestamp: string
}

export type UploadedFile = {
  id: string
  name: string
  category: string
  status: 'Uploaded' | 'Processing' | 'Ready'
  pages: number
  extracted: string
  confidence: number
}

export type ConciergeApplication = {
  applicationId?: string
  status: 'Draft' | 'AI Intake Complete — Broker Review Required'
  fields: ApplicationField[]
  messages: ChatMessage[]
  files: UploadedFile[]
  confirmedByApplicant: boolean
  createdAt?: string
}

export type RuntimeState = {
  availability: 'checking' | 'online' | 'offline' | 'error'
  mode: 'demo' | 'openai' | 'browser-demo' | 'unknown'
  label: string
  model?: string
}
