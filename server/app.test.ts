import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { fieldDefinitions } from '../src/data/fieldDefinitions'
import type { ConciergeApplication } from '../src/types'
import { buildApp } from './app'

let app: FastifyInstance
let dataDir: string

function newApplication(): ConciergeApplication {
  return {
    status: 'Draft',
    fields: fieldDefinitions.map((field) => ({ ...field })),
    files: [],
    confirmedByApplicant: false,
    messages: [{ id: 'welcome-test', role: 'assistant', body: 'Welcome', timestamp: new Date().toISOString() }],
  }
}

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'hyna-ai-api-'))
  app = await buildApp({ dataDir, uploadDir: path.join(dataDir, 'uploads'), aiMode: 'demo', requireRealAi: false })
})

after(async () => {
  await app.close()
  await rm(dataDir, { recursive: true, force: true })
})

test('health discloses the active demo runtime', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/health' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json().ai, { mode: 'demo', model: null, configured: true, requiresRealAi: false })
})

test('chat returns labelled demo analysis', async () => {
  const application = newApplication()
  const response = await app.inject({
    method: 'POST', url: '/api/chat',
    payload: {
      message: 'I need a $850,000 refinance for an investment property valued at $1.2 million.',
      messageId: 'test-message', sessionId: 'test-session-123', fields: application.fields, messages: application.messages,
    },
  })
  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.runtime.mode, 'demo')
  assert.ok(body.updates.some((field: { id: string }) => field.id === 'loanAmount'))
})

test('confirmed application is persisted and retrievable', async () => {
  const draft = { ...newApplication(), confirmedByApplicant: true }
  const created = await app.inject({ method: 'POST', url: '/api/applications', payload: draft })
  assert.equal(created.statusCode, 201)
  const id = created.json().application.applicationId as string
  const retrieved = await app.inject({ method: 'GET', url: `/api/applications/${id}` })
  assert.equal(retrieved.statusCode, 200)
  assert.equal(retrieved.json().applicationId, id)
})

test('uploaded documents are stored with an explicit OCR boundary', async () => {
  const boundary = 'hyna-ai-test-boundary'
  const payload = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="Demo Statement.pdf"',
    'Content-Type: application/pdf',
    '',
    '%PDF-1.4 fictional test document',
    `--${boundary}--`,
    '',
  ].join('\r\n'))
  const response = await app.inject({
    method: 'POST',
    url: '/api/documents?sessionId=test-session-123',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  })
  assert.equal(response.statusCode, 201)
  const body = response.json()
  assert.equal(body.document.name, 'Demo Statement.pdf')
  assert.equal(body.document.storageMode, 'local-pilot')
  assert.equal(body.document.analysisMode, 'not-configured')
  assert.match(body.document.extracted, /Real OCR\/document extraction is not configured/)
})
