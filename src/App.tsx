import { ChevronRight, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppearanceControl, type ThemeMode } from './components/AppearanceControl'
import { ConciergeOrb } from './components/ConciergeOrb'
import { ConversationPanel } from './components/ConversationPanel'
import { LiveSummary } from './components/LiveSummary'
import { PortalButton } from './components/PortalButton'
import { clearApplication, createDemoApplication, loadApplication, newApplication, saveApplication } from './services/applicationService'
import { createApplicationWithApi, frontendRequiresApi, getApiHealth, sendChatToApi, uploadDocumentToApi } from './services/backendService'
import { processDemoDocument } from './services/documentExtractionService'
import { analyseApplicantMessage, suggestedReplies } from './services/mockAIService'
import { getPortalUrl } from './services/portalHandoffService'
import type { ApplicationField, ChatMessage, ConciergeApplication, OrbState, RuntimeState, UploadedFile } from './types'

const message = (role: ChatMessage['role'], body: string): ChatMessage => ({ id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, role, body, timestamp: new Date().toISOString() })
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
const THEME_KEY = 'hyna-ai-concierge-theme-v1'

function loadTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

export default function App() {
  const [application, setApplication] = useState<ConciergeApplication>(() => loadApplication())
  const [expanded, setExpanded] = useState(() => loadApplication().messages.length > 1)
  const [orbState, setOrbState] = useState<OrbState>(() => loadApplication().status === 'AI Intake Complete — Broker Review Required' ? 'completed' : 'idle')
  const [runtime, setRuntime] = useState<RuntimeState>({ availability: 'checking', mode: 'unknown', label: 'Checking AI service…' })
  const [busy, setBusy] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const summaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => { saveApplication(application) }, [application])
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    let active = true
    getApiHealth().then((health) => {
      if (!active) return
      if (!health.ai.configured) {
        setRuntime({ availability: 'error', mode: 'unknown', label: 'AI setup required' })
        return
      }
      setRuntime(health.ai.mode === 'openai'
        ? { availability: 'online', mode: 'openai', label: `Live AI • ${health.ai.model}`, model: health.ai.model ?? undefined }
        : { availability: 'online', mode: 'demo', label: 'Demo AI • API connected' })
    }).catch(() => {
      if (active) setRuntime(frontendRequiresApi
        ? { availability: 'error', mode: 'unknown', label: 'Required API unavailable' }
        : { availability: 'offline', mode: 'browser-demo', label: 'Browser Demo • API offline' })
    })
    return () => { active = false }
  }, [])

  const required = application.fields.filter((field) => field.required)
  const completedRequired = required.filter((field) => field.value).length
  const progress = Math.round((completedRequired / required.length) * 100)
  const missing = required.filter((field) => !field.value)
  const ready = missing.length === 0
  const backendExpected = runtime.availability === 'online' || runtime.availability === 'error'

  const send = async (text: string) => {
    if (busy || runtime.availability === 'checking') return
    const userMessage = message('user', text)
    const fieldsAtSend = application.fields
    const messagesAtSend = [...application.messages, userMessage]
    setApplication((current) => ({ ...current, messages: [...current.messages, userMessage] }))
    setBusy(true)
    setOrbState('thinking')
    try {
      const analysis = backendExpected
        ? await sendChatToApi({ message: text, messageId: userMessage.id, applicationId: application.applicationId, fields: fieldsAtSend, messages: messagesAtSend })
        : runtime.availability === 'offline' && !frontendRequiresApi
          ? await wait(720).then(() => ({ ...analyseApplicantMessage(text, fieldsAtSend, userMessage.id), runtime: { mode: 'demo' as const, model: null, configured: true, fallback: true } }))
          : await Promise.reject(new Error('The configured AI API is unavailable.'))
      const aiMessage = message('assistant', analysis.reply)
      setApplication((current) => ({
        ...current,
        fields: current.fields.map((field) => {
          const update = analysis.updates.find((item) => item.id === field.id)
          return update ? { ...field, value: update.value, status: 'AI interpreted', source: field.id === 'calculatedLvr' ? 'AI calculation' : 'User message', confidence: update.confidence, sourceMessageId: update.sourceMessageId } : field
        }),
        messages: [...current.messages, aiMessage],
      }))
      setOrbState(analysis.updates.length ? 'responding' : 'collecting')
      window.setTimeout(() => setOrbState('collecting'), 650)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown AI service error'
      setApplication((current) => ({ ...current, messages: [...current.messages, message('system', `${detail} No simulated answer was substituted.`)] }))
      setNotice(detail)
      setOrbState('error')
      if (backendExpected) setRuntime((current) => ({ ...current, availability: 'error', label: 'AI service error • Retry available' }))
    } finally {
      setBusy(false)
    }
  }

  const updateField = (id: string, value: string) => setApplication((current) => ({ ...current, fields: current.fields.map((field) => field.id === id ? { ...field, value, status: 'Confirmed', source: 'User message', confidence: 100 } : field) }))
  const confirmField = (id: string) => setApplication((current) => ({ ...current, fields: current.fields.map((field) => field.id === id ? { ...field, status: 'Confirmed', confidence: field.confidence ?? 100 } : field) }))
  const explain = (field: ApplicationField) => {
    setExpanded(true)
    setApplication((current) => ({ ...current, messages: [...current.messages, message('assistant', `${field.label} is currently recorded as “${field.value || 'not provided'}”. Its source is ${field.source.toLowerCase()}${field.confidence ? ` with ${field.confidence}% confidence` : ''}. You can edit or confirm it in the summary.`)] }))
  }

  const upload = async (file: File) => {
    const pending: UploadedFile = { id: `pending-${Date.now()}`, name: file.name, category: 'Classifying', status: 'Processing', pages: 0, extracted: 'Processing in progress', confidence: 0 }
    setOrbState('collecting')
    setApplication((current) => ({ ...current, files: [...current.files, pending] }))
    try {
      const processed = backendExpected
        ? await uploadDocumentToApi(file, application.applicationId)
        : runtime.availability === 'offline' && !frontendRequiresApi
          ? await processDemoDocument(file)
          : await Promise.reject(new Error('Document API is unavailable.'))
      setApplication((current) => ({
        ...current,
        files: current.files.map((item) => item.id === pending.id ? processed : item),
        fields: current.fields.map((field) => field.id === 'documents' ? { ...field, value: [...current.files.filter((item) => item.status === 'Ready').map((item) => item.name), processed.name].join(', '), status: 'Needs review', source: 'Uploaded document', confidence: processed.confidence } : field),
        messages: [...current.messages, message('assistant', `${processed.name}: ${processed.extracted} A broker must review all document-derived information.`)],
      }))
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Document upload failed.'
      setApplication((current) => ({ ...current, files: current.files.filter((item) => item.id !== pending.id), messages: [...current.messages, message('system', detail)] }))
      setNotice(detail)
      setOrbState('error')
    }
  }

  const startOver = () => {
    clearApplication()
    setApplication(newApplication())
    setOrbState('idle')
    setSubmitOpen(false)
    setExpanded(true)
  }

  const complete = async () => {
    if (!ready) {
      setOrbState('error')
      setNotice(`Please complete: ${missing.slice(0, 3).map((field) => field.label).join(', ')}`)
      window.setTimeout(() => setOrbState('collecting'), 1900)
      return
    }
    setBusy(true)
    setOrbState('validating')
    try {
      const completed = backendExpected
        ? await createApplicationWithApi(application)
        : runtime.availability === 'offline' && !frontendRequiresApi
          ? await createDemoApplication(application)
          : await Promise.reject(new Error('Application API is unavailable.'))
      setApplication(completed)
      setOrbState('completed')
      setSubmitOpen(false)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Application creation failed.'
      setNotice(detail)
      setOrbState('error')
    } finally {
      setBusy(false)
    }
  }

  const openPortal = () => {
    if (!application.applicationId) {
      setNotice('Complete your AI intake to open a specific application.')
      window.open(getPortalUrl(), '_blank', 'noopener,noreferrer')
      return
    }
    window.location.assign(getPortalUrl(application.applicationId))
  }

  const suggestions = useMemo(() => suggestedReplies(application.fields), [application.fields])
  return <main className={`concierge-app theme-${theme} ${expanded ? 'is-expanded' : ''}`}>
    <div className="ambient-grid" /><div className="ambient-glow glow-one" /><div className="ambient-glow glow-two" />
    <header className="site-header"><div className="brand"><span>HA</span><div><strong>HYNA AI</strong><small>AI LENDING PLATFORM</small></div></div><div className="header-actions"><div className="powered">Intelligent lending <strong>infrastructure</strong></div><AppearanceControl theme={theme} onChange={setTheme} /></div></header>
    <PortalButton applicationId={application.applicationId} onOpen={openPortal} />
    <ConciergeOrb state={orbState} compact={expanded} progress={progress} onClick={() => { setExpanded(true); setOrbState(application.applicationId ? 'completed' : 'collecting') }} />

    {!expanded ? <section className="hero"><div className="hero-kicker"><Sparkles size={12} /> Intelligent application intake</div><h1>AI Loan <em>Concierge</em></h1><p>Tell us what you’re looking to finance. Your AI loan concierge will organise the information and prepare your application for review.</p><div className="hero-orb-space" aria-hidden="true" /><div className="hero-trust"><span><ShieldCheck size={13} /> Broker reviewed</span><span><LockKeyhole size={13} /> Prototype data only</span></div></section> : <section className="workspace">
      <div className="workspace-intro"><div><span>HYNA AI INTAKE</span><h1>Your application, organised through conversation.</h1></div></div>
      <div className="workspace-grid" ref={summaryRef}><ConversationPanel messages={application.messages} suggestions={suggestions} progress={progress} files={application.files} busy={busy || runtime.availability === 'checking'} runtime={runtime} onSend={send} onUpload={upload} onMinimise={() => { setExpanded(false); setOrbState(application.applicationId ? 'completed' : 'idle') }} onStartOver={startOver} /><LiveSummary fields={application.fields} onUpdate={updateField} onConfirm={confirmField} onExplain={explain} /></div>
      <div className="completion-bar glass-panel"><div><small>{application.applicationId ? 'Application created' : ready ? 'Core information collected' : `${missing.length} required fields remaining`}</small><strong>{application.applicationId ? application.applicationId : ready ? 'Your application information is ready for broker review.' : 'Continue the conversation to complete your intake.'}</strong>{application.applicationId && <span>AI Intake Complete — Broker Review Required • Prototype data handoff</span>}</div><div><button type="button" className="text-button" onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' })}>Review Summary</button>{application.applicationId ? <button type="button" className="primary-button" onClick={openPortal}>Open Application Portal <ChevronRight size={14} /></button> : <button type="button" className="primary-button" onClick={() => setSubmitOpen(true)}>Complete & Submit <ChevronRight size={14} /></button>}</div></div>
    </section>}

    <footer><p>AI-assisted information collection only. All information must be reviewed by a broker. Loan eligibility, pricing and approval remain subject to the relevant licensed lender.</p><div><a href="#privacy">Privacy</a><span>Interactive product concept • Fictional demo data</span></div></footer>
    {notice && <button type="button" className="toast" onClick={() => setNotice('')}><span>{notice}</span><X size={13} /></button>}
    {submitOpen && <div className="modal-backdrop" onClick={() => setSubmitOpen(false)}><section className="submit-modal glass-panel" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Close submission review" className="icon-button modal-close" onClick={() => setSubmitOpen(false)}><X size={15} /></button><small>Applicant confirmation</small><h2>{ready ? 'Ready for broker review' : 'Complete required information'}</h2><p>{ready ? 'Please confirm that the AI-organised information is accurate to the best of your knowledge. A broker will review every field before submission to a lender.' : 'The application cannot be created until the required fields below are provided.'}</p>{!ready && <ul>{missing.map((field) => <li key={field.id}>{field.label}</li>)}</ul>}<label className="confirmation"><input type="checkbox" checked={application.confirmedByApplicant} onChange={(event) => setApplication((current) => ({ ...current, confirmedByApplicant: event.target.checked }))} /><span>I confirm that I have reviewed the summary and understand this is not a loan approval.</span></label><button type="button" className="primary-button wide" disabled={!ready || !application.confirmedByApplicant || busy} onClick={complete}>{busy ? 'Creating application…' : 'Confirm & Create Application'}</button></section></div>}
  </main>
}
