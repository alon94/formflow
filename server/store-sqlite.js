/**
 * SQLite storage adapter (better-sqlite3) — multi-tenant schema per spec ch.6.
 * Documents (form docs) are stored as JSON columns; swapping to PostgreSQL 16
 * with JSONB is a mechanical adapter change.
 */
import Database from 'better-sqlite3'
import { buildSeedDb } from '../shared/seed.js'

const SCHEMA_VERSION = 3

const SCHEMA = `
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT,
  members TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_ws_owner ON workspaces(owner_email);
CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  doc TEXT NOT NULL
);
CREATE INDEX idx_forms_ws ON forms(workspace_id);
CREATE UNIQUE INDEX idx_forms_slug ON forms(slug);
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY,
  form_id TEXT NOT NULL,
  data TEXT NOT NULL,
  name TEXT,
  email TEXT,
  track TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL
);
CREATE INDEX idx_sub_form_time ON submissions(form_id, submitted_at DESC);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  submission_id INTEGER,
  channel TEXT,
  recipient TEXT,
  status TEXT,
  note TEXT,
  at TEXT
);
CREATE TABLE webhook_logs (
  id TEXT PRIMARY KEY,
  form_id TEXT,
  webhook_id TEXT,
  submission_id INTEGER,
  event TEXT,
  status INTEGER,
  attempt INTEGER,
  payload TEXT,
  at TEXT
);
CREATE TABLE form_versions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  at TEXT NOT NULL,
  fields TEXT NOT NULL
);
CREATE INDEX idx_versions_form_time ON form_versions(form_id, at DESC);
`

const rowToSubmission = (r) => ({
  id: r.id,
  formId: r.form_id,
  values: JSON.parse(r.data),
  name: r.name,
  email: r.email,
  track: r.track,
  tags: JSON.parse(r.tags),
  assignedTo: r.assigned_to,
  status: r.status,
  notes: r.notes,
  submittedAt: r.submitted_at,
})

const rowToWorkspace = (r) => ({
  id: r.id,
  name: r.name,
  ownerEmail: r.owner_email,
  ownerName: r.owner_name,
  members: JSON.parse(r.members),
  createdAt: r.created_at,
})

export class SqliteStore {
  constructor(path) {
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    if (this.db.pragma('user_version', { simple: true }) !== SCHEMA_VERSION) {
      this.#recreate()
    }
  }

  #recreate() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'")
      .all()
    for (const t of tables) {
      this.db.exec(`DROP ${t.name.startsWith('idx_') ? 'INDEX' : 'TABLE'} IF EXISTS "${t.name}"`)
    }
    this.db.exec(SCHEMA)
    this.#seed()
    this.db.pragma(`user_version = ${SCHEMA_VERSION}`)
  }

  #seed() {
    const seed = buildSeedDb()
    const tx = this.db.transaction(() => {
      for (const t of ['workspaces', 'forms', 'submissions', 'notifications', 'webhook_logs', 'form_versions']) {
        this.db.prepare(`DELETE FROM ${t}`).run()
      }
      for (const w of seed.workspaces) {
        this.db
          .prepare('INSERT INTO workspaces (id, name, owner_email, owner_name, members, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(w.id, w.name, w.ownerEmail, w.ownerName, JSON.stringify(w.members), w.createdAt)
      }
      for (const form of seed.forms) {
        this.db
          .prepare('INSERT INTO forms (id, workspace_id, slug, doc) VALUES (?, ?, ?, ?)')
          .run(form.id, form.workspaceId, form.slug, JSON.stringify(form))
      }
      const insSub = this.db.prepare(
        `INSERT INTO submissions (id, form_id, data, name, email, track, tags, assigned_to, status, notes, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const s of seed.submissions) {
        insSub.run(s.id, s.formId, JSON.stringify(s.values), s.name, s.email, s.track, JSON.stringify(s.tags), s.assignedTo ?? null, s.status, s.notes ?? '', s.submittedAt)
      }
      const insNtf = this.db.prepare(
        'INSERT INTO notifications (id, submission_id, channel, recipient, status, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      for (const n of seed.notifications) insNtf.run(n.id, n.submissionId, n.channel, n.recipient, n.status, n.note, n.at)
      const insWhl = this.db.prepare(
        'INSERT INTO webhook_logs (id, form_id, webhook_id, submission_id, event, status, attempt, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const l of seed.webhookLogs) insWhl.run(l.id, l.formId ?? seed.forms[0].id, l.webhookId, l.submissionId, l.event, l.status, l.attempt, l.payload, l.at)
    })
    tx()
  }

  get kind() {
    return 'sqlite'
  }

  getBaseline() {
    return buildSeedDb().baseline
  }

  /* ---- workspaces ---- */
  workspaceForEmail(email) {
    const rows = this.db.prepare('SELECT * FROM workspaces').all().map(rowToWorkspace)
    return rows.find((w) => w.members.includes(email) || w.ownerEmail === email) ?? null
  }

  createWorkspace(w) {
    this.db
      .prepare('INSERT INTO workspaces (id, name, owner_email, owner_name, members, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(w.id, w.name, w.ownerEmail, w.ownerName, JSON.stringify(w.members), w.createdAt)
    return w
  }

  /* ---- forms ---- */
  listForms(workspaceId) {
    return this.db
      .prepare('SELECT doc FROM forms WHERE workspace_id = ?')
      .all(workspaceId)
      .map((r) => JSON.parse(r.doc))
  }

  getForm(idOrSlug) {
    const r = this.db.prepare('SELECT doc FROM forms WHERE id = ? OR slug = ?').get(idOrSlug, idOrSlug)
    return r ? JSON.parse(r.doc) : null
  }

  createForm(form) {
    this.db
      .prepare('INSERT INTO forms (id, workspace_id, slug, doc) VALUES (?, ?, ?, ?)')
      .run(form.id, form.workspaceId, form.slug, JSON.stringify(form))
  }

  saveForm(form) {
    this.db.prepare('UPDATE forms SET doc = ?, slug = ? WHERE id = ?').run(JSON.stringify(form), form.slug, form.id)
  }

  deleteForm(formId, { withSubmissions }) {
    if (withSubmissions) {
      const subIds = this.db.prepare('SELECT id FROM submissions WHERE form_id = ?').all(formId).map((r) => r.id)
      if (subIds.length) {
        const ph = subIds.map(() => '?').join(',')
        this.db.prepare(`DELETE FROM notifications WHERE submission_id IN (${ph})`).run(...subIds)
      }
      this.db.prepare('DELETE FROM submissions WHERE form_id = ?').run(formId)
    }
    this.db.prepare('DELETE FROM webhook_logs WHERE form_id = ?').run(formId)
    this.db.prepare('DELETE FROM form_versions WHERE form_id = ?').run(formId)
    this.db.prepare('DELETE FROM forms WHERE id = ?').run(formId)
  }

  /* ---- submissions ---- */
  listSubmissions(formId, { q, track, status }) {
    let sql = 'SELECT * FROM submissions WHERE form_id = ?'
    const params = [formId]
    if (q) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR data LIKE ?)'
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (track && track !== 'all') {
      sql += ' AND track = ?'
      params.push(track)
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY submitted_at DESC'
    return this.db.prepare(sql).all(...params).map(rowToSubmission)
  }

  getSubmission(id) {
    const row = this.db.prepare('SELECT * FROM submissions WHERE id = ?').get(id)
    return row ? rowToSubmission(row) : null
  }

  hasValue(formId, fieldKey, value) {
    const needle = JSON.stringify({ [fieldKey]: value }).slice(1, -1)
    const row = this.db
      .prepare('SELECT id FROM submissions WHERE form_id = ? AND data LIKE ? LIMIT 1')
      .get(formId, `%${needle}%`)
    return !!row
  }

  nextSubmissionId() {
    const row = this.db.prepare('SELECT MAX(id) AS m FROM submissions').get()
    return Math.max(row?.m ?? 0, 1124) + 1
  }

  insertSubmission(sub) {
    this.db
      .prepare(
        `INSERT INTO submissions (id, form_id, data, name, email, track, tags, assigned_to, status, notes, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sub.id, sub.formId, JSON.stringify(sub.values), sub.name, sub.email, sub.track, JSON.stringify(sub.tags), sub.assignedTo ?? null, sub.status, sub.notes ?? '', sub.submittedAt)
  }

  updateSubmission(id, patch) {
    const current = this.getSubmission(id)
    if (!current) return null
    const next = { ...current, ...patch }
    this.db
      .prepare('UPDATE submissions SET status = ?, notes = ?, tags = ? WHERE id = ?')
      .run(next.status, next.notes, JSON.stringify(next.tags), id)
    return next
  }

  deleteSubmission(id) {
    this.db.prepare('DELETE FROM notifications WHERE submission_id = ?').run(id)
    this.db.prepare('DELETE FROM submissions WHERE id = ?').run(id)
  }

  submissionCount(formId) {
    return this.db.prepare('SELECT COUNT(*) AS c FROM submissions WHERE form_id = ?').get(formId).c
  }

  latestSubmissionAt(formId) {
    return this.db.prepare('SELECT MAX(submitted_at) AS m FROM submissions WHERE form_id = ?').get(formId).m
  }

  trackCounts(formId) {
    const rows = this.db
      .prepare('SELECT track, COUNT(*) AS c FROM submissions WHERE form_id = ? GROUP BY track')
      .all(formId)
    return Object.fromEntries(rows.map((r) => [r.track ?? '—', r.c]))
  }

  dailyCounts(formId, days) {
    const rows = this.db
      .prepare(
        `SELECT substr(submitted_at, 1, 10) AS day, COUNT(*) AS c
         FROM submissions WHERE form_id = ? GROUP BY day ORDER BY day DESC LIMIT ?`,
      )
      .all(formId, days)
    return Object.fromEntries(rows.map((r) => [r.day, r.c]))
  }

  /* ---- notifications ---- */
  insertNotification(n) {
    this.db
      .prepare('INSERT INTO notifications (id, submission_id, channel, recipient, status, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(n.id, n.submissionId, n.channel, n.recipient, n.status, n.note, n.at)
  }

  notificationsFor(submissionId) {
    return this.db
      .prepare('SELECT * FROM notifications WHERE submission_id = ? ORDER BY at DESC')
      .all(submissionId)
      .map((r) => ({
        id: r.id,
        submissionId: r.submission_id,
        channel: r.channel,
        recipient: r.recipient,
        status: r.status,
        note: r.note,
        at: r.at,
      }))
  }

  /* ---- webhook logs ---- */
  insertWebhookLog(l) {
    this.db
      .prepare('INSERT INTO webhook_logs (id, form_id, webhook_id, submission_id, event, status, attempt, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(l.id, l.formId, l.webhookId, l.submissionId, l.event, l.status, l.attempt, l.payload, l.at)
  }

  listWebhookLogs(formId) {
    return this.db
      .prepare('SELECT * FROM webhook_logs WHERE form_id = ? ORDER BY at DESC LIMIT 50')
      .all(formId)
      .map((r) => ({
        id: r.id,
        formId: r.form_id,
        webhookId: r.webhook_id,
        submissionId: r.submission_id,
        event: r.event,
        status: r.status,
        attempt: r.attempt,
        payload: r.payload,
        at: r.at,
      }))
  }

  getWebhookLog(id) {
    const r = this.db.prepare('SELECT * FROM webhook_logs WHERE id = ?').get(id)
    return r
      ? {
          id: r.id,
          formId: r.form_id,
          webhookId: r.webhook_id,
          submissionId: r.submission_id,
          event: r.event,
          status: r.status,
          attempt: r.attempt,
          payload: r.payload,
          at: r.at,
        }
      : null
  }

  /* ---- versions ---- */
  pushVersion(formId, fields) {
    this.db
      .prepare('INSERT INTO form_versions (id, form_id, at, fields) VALUES (?, ?, ?, ?)')
      .run(`ver-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, formId, new Date().toISOString(), JSON.stringify(fields))
    this.db
      .prepare(
        `DELETE FROM form_versions WHERE form_id = ? AND id NOT IN (
           SELECT id FROM form_versions WHERE form_id = ? ORDER BY at DESC LIMIT 50)`,
      )
      .run(formId, formId)
  }

  listVersions(formId) {
    return this.db
      .prepare('SELECT id, at, fields FROM form_versions WHERE form_id = ? ORDER BY at DESC')
      .all(formId)
      .map((r) => ({ id: r.id, at: r.at, fieldCount: JSON.parse(r.fields).length }))
  }

  getVersion(id) {
    const r = this.db.prepare('SELECT * FROM form_versions WHERE id = ?').get(id)
    return r ? { id: r.id, formId: r.form_id, at: r.at, fields: JSON.parse(r.fields) } : null
  }

  reset() {
    this.#seed()
  }
}
