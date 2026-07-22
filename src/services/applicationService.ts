import { fieldDefinitions } from '../data/fieldDefinitions'
import type { ConciergeApplication } from '../types'

const STORAGE_KEY = 'hyna-ai-concierge-demo-v1'

export function newApplication(): ConciergeApplication {
  return {
    status: 'Draft',
    fields: fieldDefinitions.map((field) => ({ ...field })),
    files: [],
    confirmedByApplicant: false,
    messages: [{
      id: 'welcome', role: 'assistant', timestamp: new Date().toISOString(),
      body: "Hi, I’m your Hyna AI Loan Concierge. I’ll help organise your loan requirements before your broker reviews and submits the application. What would you like to finance?",
    }],
  }
}

export function loadApplication() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) as ConciergeApplication : newApplication()
  } catch {
    return newApplication()
  }
}

export function saveApplication(application: ConciergeApplication) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(application))
}

export async function createDemoApplication(application: ConciergeApplication) {
  await new Promise((resolve) => window.setTimeout(resolve, 1100))
  const completed: ConciergeApplication = {
    ...application,
    applicationId: 'HYA-DEMO-00127',
    status: 'AI Intake Complete — Broker Review Required',
    confirmedByApplicant: true,
    createdAt: new Date().toISOString(),
  }
  saveApplication(completed)
  return completed
}

export function clearApplication() {
  localStorage.removeItem(STORAGE_KEY)
}
