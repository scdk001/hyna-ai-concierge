import { buildApp } from './app'
import { resolveConfig } from './config'

const config = resolveConfig()
const app = await buildApp(config)

try {
  await app.listen({ host: config.host, port: config.port })
  console.log(`Hyna AI Concierge API listening on http://${config.host}:${config.port}`)
  console.log(`AI mode: ${config.aiMode}${config.aiMode === 'openai' ? ` (${config.openAiModel})` : ' (explicit demo adapter)'}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
