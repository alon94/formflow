/**
 * SQLite storage adapter (better-sqlite3) — schema follows spec chapter 6.
 * The production plan is PostgreSQL 16 with JSONB; this adapter keeps the
 * same shape (document columns hold JSON) so swapping drivers is mechanical.
 */
import Database from 'better-sqlite3'
import { buildSeedDb } from '../shared/seed.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  doc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
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
CREATE INDEX IF NOT EXISTS idx_sub_form_time ON submissions(form_id, submitted_at DESC);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  submission_id INTEGER,
  channel TEXT,
  recipient TEXT,
  status TEXT,
  note TEXT,
  at TEXT
);
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT,
  submission_id INTEGER,
  event TEXT,
  status INTEGER,
  attempt INTEGER,
  payload TEXT,
  at TEXT
);
CREATE TABLE IF NOT EXISTS form_versions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  at TEXT NOT NULL,
  fields TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_form_time ON form_versions(form_id, at DESC);
`

const rowToSubmission = (r) => ({
  id: r.id,
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

export class SqliteStore {
  constructor(path) {
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
    if (!this.db.prepare('SELECT id FROM forms LIMIT 1').get()) this.#seed()
  }

  #seed() {
    const seed = buildSeedDb()
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM forms').run()
      this.db.prepare('DELETE FROM submissions').run()
      this.db.prepare('DELETE FROM notifications').run()
      this.db.prepare('DELETE FROM webhook_logs').run()
      this.db.prepare('DELETE FROM form_versions').run()
      this.db
        .prepare('INSERT INTO forms (id, doc) VALUES (?, ?)')
        .run(seed.form.id, JSON.stringify(seed.form))
      const insSub = this.db.prepare(
        `INSERT INTO submissions (id, form_id, data, name, email, track, tags, assigned_to, status, notes, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const s of seed.submissions) {
        insSub.run(
          s.id,
          seed.form.id,
          JSON.stringify(s.values),
          s.name,
          s.email,
          s.track,
          JSON.stringify(s.tags),
          s.assignedTo ?? null,
          s.status,
          s.notes ?? '',
          s.submittedAt,
        )
      }
      const insNtf = this.db.prepare(
        'INSERT INTO notifications (id, submission_id, channel, recipient, status, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      for (const n of seed.notifications) {
        insNtf.run(n.id, n.submissionId, n.channel, n.recipient, n.status, n.note, n.at)
      }
      const insWhl = this.db.prepare(
        'INSERT INTO webhook_logs (id, webhook_id, submission_id, event, status, attempt, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const l of seed.webhookLogs) {
        insWhl.run(l.id, l.webhookId, l.submissionId, l.event, l.status, l.attempt, l.payload, l.at)
      }
    })
    tx()
    this.baseline = seed.baseline
  }

  get kind() {
    return 'sqlite'
  }

  getBaseline() {
    return buildSeedDb().baseline
  }

  getForm() {
    const row = this.db.prepare('SELECT doc FROM forms LIMIT 1').get()
    return row ? JSON.parse(row.doc) : null
  }

  saveForm(form) {
    this.db.prepare('UPDATE forms SET doc = ? WHERE id = ?').run(JSON.stringify(form), form.id)
  }

  listSubmissions({ q, track, status }) {
    let sql = 'SELECT * FROM submissions WHERE 1=1'
    const params = []
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

  hasValue(fieldKey, value) {
    /* uniqueness check against the JSON data column */
    const needle = JSON.stringify({ [fieldKey]: value }).slice(1, -1)
    const row = this.db
      .prepare('SELECT id FROM submissions WHERE data LIKE ? LIMIT 1')
      .get(`%${needle}%`)
    return !!row
  }

  nextSubmissionId() {
    const row = this.db.prepare('SELECT MAX(id) AS m FROM submissions').get()
    return (row?.m ?? 1124) + 1
  }

  insertSubmission(sub) {
    this.db
      .prepare(
        `INSERT INTO submissions (id, form_id, data, name, email, track, tags, assigned_to, status, notes, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sub.id,
        this.getForm().id,
        JSON.stringify(sub.values),
        sub.name,
        sub.email,
        sub.track,
        JSON.stringify(sub.tags),
        sub.assignedTo ?? null,
        sub.status,
        sub.notes ?? '',
        sub.submittedAt,
      )
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

  submissionCount() {
    return this.db.prepare('SELECT COUNT(*) AS c FROM submissions').get().c
  }

  latestSubmissionAt() {
    return this.db.prepare('SELECT MAX(submitted_at) AS m FROM submissions').get().m
  }

  trackCounts() {
    const rows = this.db
      .prepare('SELECT track, COUNT(*) AS c FROM submissions GROUP BY track')
      .all()
    return Object.fromEntries(rows.map((r) => [r.track, r.c]))
  }

  insertNotification(n) {
    this.db
      .prepare(
        'INSERT INTO notifications (id, submission_id, channel, recipient, status, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
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

  insertWebhookLog(l) {
    this.db
      .prepare(
        'INSERT INTO webhook_logs (id, webhook_id, submission_id, event, status, attempt, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(l.id, l.webhookId, l.submissionId, l.event, l.status, l.attempt, l.payload, l.at)
  }

  listWebhookLogs() {
    return this.db
      .prepare('SELECT * FROM webhook_logs ORDER BY at DESC LIMIT 50')
      .all()
      .map((r) => ({
        id: r.id,
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

  pushVersion(formId, fields) {
    this.db
      .prepare('INSERT INTO form_versions (id, form_id, at, fields) VALUES (?, ?, ?, ?)')
      .run(`ver-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, formId, new Date().toISOString(), JSON.stringify(fields))
    /* cap at 50 versions (spec §4.1.1) */
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
    return r ? { id: r.id, at: r.at, fields: JSON.parse(r.fields) } : null
  }

  reset() {
    this.#seed()
  }
}
