import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import { z } from 'zod'
import { analyseApplicantMessage } from '../../src/services/mockAIService'
import type { ChatRequest, ChatResponse } from '../types'

const outputSchema = z.object({
  reply: z.string().min(1).max(1600),
  updates: z.array(z.object({
    id: z.string(),
    value: z.string().min(1).max(500),
    confidence: z.number().int().min(0).max(100),
  })).max(20),
})

const structuredOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'updates'],
  properties: {
    reply: { type: 'string' },
    updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'value', 'confidence'],
        properties: {
          id: { type: 'string' },
          value: { type: 'string' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
  },
}

export interface AiProvider {
  analyse(request: ChatRequest): Promise<ChatResponse>
}

export class DemoAiProvider implements AiProvider {
  async analyse(request: ChatRequest): Promise<ChatResponse> {
    const result = analyseApplicantMessage(request.message, request.fields, request.messageId)
    return {
      ...result,
      runtime: { mode: 'demo', model: null, configured: true, fallback: false },
    }
  }
}

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey })
  }

  async analyse(request: ChatRequest): Promise<ChatResponse> {
    const allowedIds = new Set(request.fields.map((field) => field.id))
    const safetyIdentifier = createHash('sha256').update(request.safetyIdentifier ?? request.sessionId).digest('hex').slice(0, 48)
    const recentMessages = request.messages.slice(-10).map(({ role, body }) => ({ role, body }))
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      reasoning: { effort: 'low' },
      safety_identifier: safetyIdentifier,
      max_output_tokens: 1200,
      instructions: [
        'You are the Hyna AI Loan Concierge for an Australian non-bank lending workflow prototype.',
        'Collect and organise applicant-provided information for later human broker review.',
        'Never state or imply eligibility, pricing, approval, decline, serviceability success, or a final credit decision.',
        'Extract only facts explicitly present in the latest message or unambiguous calculations from supplied figures.',
        'Use Australian financial terminology and the same language as the applicant.',
        'Keep the reply concise, explain what was captured, and ask for at most two useful missing items.',
        'Return only the required JSON structure. Field ids must come from the supplied field catalogue.',
      ].join(' '),
      input: JSON.stringify({
        latestMessage: request.message,
        fieldCatalogue: request.fields.map(({ id, label, required, value }) => ({ id, label, required, currentValue: value })),
        recentMessages,
      }),
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'loan_intake_update',
          strict: true,
          schema: structuredOutputSchema,
        },
      },
    })

    const parsed = outputSchema.parse(JSON.parse(response.output_text))
    return {
      reply: parsed.reply,
      updates: parsed.updates
        .filter((update) => allowedIds.has(update.id))
        .map((update) => ({ ...update, sourceMessageId: request.messageId })),
      runtime: { mode: 'openai', model: this.model, configured: true, fallback: false },
    }
  }
}
