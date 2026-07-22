import path from 'node:path'

export type AiMode = 'demo' | 'openai'

export type ServerConfig = {
  host: string
  port: number
  dataDir: string
  uploadDir: string
  corsOrigins: string[]
  aiMode: AiMode
  openAiApiKey?: string
  openAiModel: string
  requireRealAi: boolean
}

const truthy = new Set(['1', 'true', 'yes', 'on'])

function asBoolean(value: string | undefined, fallback: boolean) {
  return value === undefined ? fallback : truthy.has(value.toLowerCase())
}

export function resolveConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const dataDir = path.resolve(overrides.dataDir ?? process.env.DATA_DIR ?? '.data')
  const openAiApiKey = overrides.openAiApiKey ?? (process.env.OPENAI_API_KEY?.trim() || undefined)
  const requestedMode = overrides.aiMode ?? process.env.AI_MODE
  const aiMode: AiMode = requestedMode === 'openai' || requestedMode === 'demo'
    ? requestedMode
    : openAiApiKey ? 'openai' : 'demo'

  return {
    host: overrides.host ?? process.env.API_HOST ?? '127.0.0.1',
    port: overrides.port ?? Number(process.env.API_PORT ?? 8787),
    dataDir,
    uploadDir: path.resolve(overrides.uploadDir ?? path.join(dataDir, 'uploads')),
    corsOrigins: overrides.corsOrigins ?? (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:4180,http://localhost:4180').split(',').map((value) => value.trim()).filter(Boolean),
    aiMode,
    openAiApiKey,
    openAiModel: overrides.openAiModel ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-sol',
    requireRealAi: overrides.requireRealAi ?? asBoolean(process.env.REQUIRE_REAL_AI, false),
  }
}
