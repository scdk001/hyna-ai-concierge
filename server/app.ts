import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import { z } from 'zod'
import type { ConciergeApplication } from '../src/types'
import { resolveConfig, type ServerConfig } from './config'
import { PilotDatabase } from './database'
import { DemoAiProvider, OpenAiProvider, type AiProvider } from './services/aiProvider'
import type { ChatRequest, StoredDocument } from './types'

const fieldSchema = z.object({
  id: z.string(), label: z.string(), category: z.string(), value: z.string(), status: z.string(),
  source: z.string(), required: z.boolean(), confidence: z.number().optional(), sourceMessageId: z.string().optional(),
})
const messageSchema = z.object({ id: z.string(), role: z.enum(['assistant', 'user', 'system']), body: z.string(), timestamp: z.string() })
const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  messageId: z.string().min(1).max(120),
  applicationId: z.string().max(80).optional(),
  sessionId: z.string().min(8).max(120),
  fields: z.array(fieldSchema).max(100),
  messages: z.array(messageSchema).max(100),
  safetyIdentifier: z.string().max(120).optional(),
})
const applicationSchema = z.object({
  applicationId: z.string().optional(),
  status: z.string(),
  fields: z.array(fieldSchema).max(100),
  messages: z.array(messageSchema).max(200),
  files: z.array(z.object({
    id: z.string(), name: z.string(), category: z.string(), status: z.string(), pages: z.number(), extracted: z.string(), confidence: z.number(),
  })).max(100),
  confirmedByApplicant: z.boolean(),
  createdAt: z.string().optional(),
})

const acceptedMimeTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function createApplicationId() {
  return `HYA-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
}

function classifyFile(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.includes('bank')) return 'Bank statements'
  if (lower.includes('tax')) return 'Tax returns'
  if (lower.includes('licence') || lower.includes('license') || lower.includes('passport')) return 'Identity'
  return 'Supporting document'
}

export async function buildApp(overrides: Partial<ServerConfig> = {}) {
  const config = resolveConfig(overrides)
  const app = Fastify({ logger: false, bodyLimit: 2_000_000 })
  const database = new PilotDatabase(path.join(config.dataDir, 'pilot.sqlite'))
  let aiProvider: AiProvider | null = null

  if (config.aiMode === 'openai' && config.openAiApiKey) aiProvider = new OpenAiProvider(config.openAiApiKey, config.openAiModel)
  if (config.aiMode === 'demo' && !config.requireRealAi) aiProvider = new DemoAiProvider()

  await mkdir(config.uploadDir, { recursive: true })
  await app.register(cors, {
    origin(origin, callback) {
      callback(null, !origin || config.corsOrigins.includes(origin))
    },
    credentials: false,
  })
  await app.register(multipart, { limits: { files: 1, fileSize: 15 * 1024 * 1024, fields: 5 } })

  app.get('/api/health', async () => ({
    ok: true,
    service: 'hyna-ai-concierge-api',
    ai: {
      mode: config.aiMode,
      model: config.aiMode === 'openai' ? config.openAiModel : null,
      configured: Boolean(aiProvider),
      requiresRealAi: config.requireRealAi,
    },
    storage: 'sqlite-local-pilot',
  }))

  app.post('/api/chat', async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid chat request', details: parsed.error.flatten() })
    if (!aiProvider) return reply.code(503).send({ error: 'Real AI is required but OPENAI_API_KEY is not configured.' })

    const payload = parsed.data as ChatRequest
    database.saveMessage({ id: payload.messageId, role: 'user', body: payload.message, timestamp: new Date().toISOString() }, payload.sessionId, payload.applicationId)
    try {
      const result = await aiProvider.analyse(payload)
      database.saveMessage({ id: randomUUID(), role: 'assistant', body: result.reply, timestamp: new Date().toISOString() }, payload.sessionId, payload.applicationId)
      database.audit('ai.intake_analysis', { mode: result.runtime.mode, updateCount: result.updates.length }, payload.sessionId, payload.applicationId)
      return result
    } catch (error) {
      request.log.error(error)
      database.audit('ai.intake_error', { mode: config.aiMode }, payload.sessionId, payload.applicationId)
      return reply.code(502).send({ error: 'The AI service could not complete this request. No demo answer was substituted.' })
    }
  })

  app.post('/api/applications', async (request, reply) => {
    const parsed = applicationSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid application payload', details: parsed.error.flatten() })
    if (!parsed.data.confirmedByApplicant) return reply.code(409).send({ error: 'Applicant confirmation is required.' })

    const createdAt = new Date().toISOString()
    const application = {
      ...parsed.data,
      applicationId: parsed.data.applicationId ?? createApplicationId(),
      status: 'AI Intake Complete — Broker Review Required',
      createdAt: parsed.data.createdAt ?? createdAt,
    } as ConciergeApplication
    database.saveApplication(application)
    database.audit('application.created', { status: application.status, version: 1 }, undefined, application.applicationId)
    return reply.code(201).send({ application, receipt: { applicationId: application.applicationId, version: 1, createdAt } })
  })

  app.get('/api/applications/:id', async (request, reply) => {
    const id = z.object({ id: z.string().min(1).max(80) }).safeParse(request.params)
    if (!id.success) return reply.code(400).send({ error: 'Invalid application id' })
    const application = database.getApplication(id.data.id)
    return application ? application : reply.code(404).send({ error: 'Application not found' })
  })

  app.post('/api/documents', async (request, reply) => {
    const query = z.object({ sessionId: z.string().min(8).max(120), applicationId: z.string().max(80).optional() }).safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: 'A valid sessionId is required.' })
    const part = await request.file()
    if (!part) return reply.code(400).send({ error: 'No document was uploaded.' })
    if (!acceptedMimeTypes.has(part.mimetype)) return reply.code(415).send({ error: 'Unsupported document type.' })
    const buffer = await part.toBuffer()
    const id = randomUUID()
    const extension = path.extname(part.filename).slice(0, 12).toLowerCase()
    const storedName = `${id}${extension}`
    const target = path.join(config.uploadDir, storedName)
    await writeFile(target, buffer, { flag: 'wx' })

    const document: StoredDocument = {
      id,
      name: path.basename(part.filename),
      category: classifyFile(part.filename),
      status: 'Ready',
      pages: 0,
      extracted: 'Stored for the local pilot. Real OCR/document extraction is not configured.',
      confidence: 0,
      size: buffer.length,
      mimeType: part.mimetype,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      storageMode: 'local-pilot',
      analysisMode: 'not-configured',
    }
    database.saveDocument(document, storedName, query.data.sessionId, query.data.applicationId)
    database.audit('document.uploaded', { documentId: id, mimeType: part.mimetype, size: buffer.length, sha256: document.sha256 }, query.data.sessionId, query.data.applicationId)
    return reply.code(201).send({ document })
  })

  app.addHook('onClose', async () => database.close())
  return app
}
