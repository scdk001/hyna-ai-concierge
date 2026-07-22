import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { ChatMessage, ConciergeApplication } from '../src/types'
import type { StoredDocument } from './types'

export class PilotDatabase {
  private readonly db: DatabaseSync

  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true })
    this.db = new DatabaseSync(filename)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        application_id TEXT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_application_idx ON messages(application_id, created_at);
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        application_id TEXT,
        session_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id TEXT,
        session_id TEXT,
        event_type TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `)
  }

  saveApplication(application: ConciergeApplication, version = 1) {
    if (!application.applicationId || !application.createdAt) throw new Error('Application identity is required')
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO applications (id, status, payload_json, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json,
        version = excluded.version, updated_at = excluded.updated_at
    `).run(application.applicationId, application.status, JSON.stringify(application), version, application.createdAt, now)
  }

  getApplication(id: string): ConciergeApplication | null {
    const row = this.db.prepare('SELECT payload_json FROM applications WHERE id = ?').get(id) as { payload_json: string } | undefined
    return row ? JSON.parse(row.payload_json) as ConciergeApplication : null
  }

  saveMessage(message: ChatMessage, sessionId: string, applicationId?: string) {
    this.db.prepare(`
      INSERT OR IGNORE INTO messages (id, application_id, session_id, role, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(message.id, applicationId ?? null, sessionId, message.role, message.body, message.timestamp)
  }

  saveDocument(document: StoredDocument, storedName: string, sessionId: string, applicationId?: string) {
    this.db.prepare(`
      INSERT INTO documents (id, application_id, session_id, original_name, stored_name, mime_type, size, sha256, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(document.id, applicationId ?? null, sessionId, document.name, storedName, document.mimeType, document.size, document.sha256, JSON.stringify(document), new Date().toISOString())
  }

  audit(eventType: string, details: Record<string, unknown>, sessionId?: string, applicationId?: string) {
    this.db.prepare(`
      INSERT INTO audit_events (application_id, session_id, event_type, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(applicationId ?? null, sessionId ?? null, eventType, JSON.stringify(details), new Date().toISOString())
  }

  close() {
    this.db.close()
  }
}
