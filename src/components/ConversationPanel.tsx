import { ArrowUp, FileUp, Mic, Minimize2, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, RuntimeState, UploadedFile } from '../types'

export function ConversationPanel({ messages, suggestions, progress, files, busy, runtime, onSend, onUpload, onMinimise, onStartOver }: {
  messages: ChatMessage[]
  suggestions: string[]
  progress: number
  files: UploadedFile[]
  busy: boolean
  runtime: RuntimeState
  onSend: (message: string) => void
  onUpload: (file: File) => void
  onMinimise: () => void
  onStartOver: () => void
}) {
  const [value, setValue] = useState('')
  const [voiceNotice, setVoiceNotice] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, files])
  const submit = () => { const text = value.trim(); if (!text || busy) return; onSend(text); setValue('') }

  return <section className="conversation-panel glass-panel">
    <div className="conversation-header">
      <div><small>Secure prototype conversation</small><h2>AI Loan Concierge</h2><span className={`runtime-badge ${runtime.mode}`}>{runtime.label}</span></div>
      <div><button type="button" className="icon-button" title="Start over" onClick={onStartOver}><RotateCcw size={15} /></button><button type="button" className="icon-button" title="Minimise" onClick={onMinimise}><Minimize2 size={15} /></button></div>
    </div>
    <div className="collection-progress"><div><span>Application collection</span><strong>{progress}%</strong></div><i><b style={{ width: `${progress}%` }} /></i></div>
    <div className="message-list" ref={listRef}>
      {messages.map((message) => <article key={message.id} className={`message ${message.role}`}><span>{message.role === 'assistant' ? 'AI' : message.role === 'user' ? 'You' : 'System'}</span><p>{message.body}</p><time>{new Date(message.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</time></article>)}
      {busy && <article className="message assistant is-thinking"><span>AI</span><p><i /><i /><i /></p></article>}
      {files.length > 0 && <div className="file-strip">{files.map((file) => <div key={file.id}><FileUp size={14} /><span><strong>{file.name}</strong><small>{file.category} • {file.pages || '—'} pages • {file.confidence}% confidence</small></span><em>{file.status}</em></div>)}</div>}
    </div>
    <div className="suggested-replies">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { if (suggestion === 'Use the remaining demo details') onSend('Individual Australian citizen. Residential investment refinance. No known credit issues. I have bank statements and tax returns and will provide the remaining details to my broker.'); else onSend(suggestion) }}>{suggestion}</button>)}</div>
    <div className="composer">
      <label className="upload-button" title="Upload supporting document"><FileUp size={16} /><input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.csv,.xls,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = '' }} /></label>
      <textarea aria-label="Message your AI loan concierge" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} placeholder="Tell us about your loan requirements…" />
      <button type="button" className="voice-button" title="Voice input — Coming soon" onClick={() => { setVoiceNotice(true); window.setTimeout(() => setVoiceNotice(false), 1800) }}><Mic size={16} /></button>
      <button type="button" className="send-button" aria-label="Send message" disabled={!value.trim() || busy} onClick={submit}><ArrowUp size={17} /></button>
      {voiceNotice && <span className="voice-notice">Voice input • Coming soon</span>}
    </div>
  </section>
}
