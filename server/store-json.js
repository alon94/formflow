/** JSON-file storage adapter — fallback when better-sqlite3 isn't available. */
import fs from 'node:fs'
import { buildSeedDb } from '../shared/seed.js'

export class JsonStore {
  constructor(path) {
    this.path = path
    try {
      this.db = JSON.parse(fs.readFileSync(path, 'utf-8'))
      if (!this.db.webhookLogs) throw new Error('stale schema')
    } catch {
      this.db = buildSeedDb()
      this.#flush()
    }
  }

  #flush() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      fs.writeFileSync(this.path, JSON.stringify(this.db, null, 2))
    }, 250)
  }

  get kind() {
    return 'json'
  }

  getBaseline() {
    return this.db.baseline
  }

  getForm() {
    return this.db.form
  }

  saveForm(form) {
    this.db.form = form
    this.#flush()
  }

  listSubmissions({ q, track, status }) {
    return this.db.submissions
      .filter((s) => {
        if (q) {
          const hay = `${s.name} ${s.email} ${Object.values(s.values ?? {}).join(' ')}`
          if (!hay.includes(q)) return false
        }
        if (track && track !== 'all' && s.track !== track) return false
        if (status && status !== 'all' && s.status !== status) return false
        return true
      })
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
  }

  getSubmission(id) {
    return this.db.submissions.find((s) => s.id === id) ?? null
  }

  hasValue(fieldKey, value) {
    return this.db.submissions.some((s) => String(s.values?.[fieldKey] ?? '') === value)
  }

  nextSubmissionId() {
    return Math.max(1124, ...this.db.submissions.map((s) => s.id)) + 1
  }

  insertSubmission(sub) {
    this.db.submissions.unshift(sub)
    this.#flush()
  }

  updateSubmission(id, patch) {
    const sub = this.getSubmission(id)
    if (!sub) return null
    Object.assign(sub, patch)
    this.#flush()
    return sub
  }

  submissionCount() {
    return this.db.submissions.length
  }

  latestSubmissionAt() {
    return this.db.submissions.reduce(
      (m, s) => (s.submittedAt > m ? s.submittedAt : m),
      '',
    ) || null
  }

  trackCounts() {
    const counts = {}
    for (const s of this.db.submissions) counts[s.track] = (counts[s.track] ?? 0) + 1
    return counts
  }

  insertNotification(n) {
    this.db.notifications.unshift(n)
    this.#flush()
  }

  notificationsFor(submissionId) {
    return this.db.notifications.filter((n) => n.submissionId === submissionId)
  }

  insertWebhookLog(l) {
    this.db.webhookLogs.unshift(l)
    this.#flush()
  }

  listWebhookLogs() {
    return this.db.webhookLogs.slice(0, 50)
  }

  getWebhookLog(id) {
    return this.db.webhookLogs.find((l) => l.id === id) ?? null
  }

  pushVersion(formId, fields) {
    this.db.versions.unshift({
      id: `ver-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      formId,
      at: new Date().toISOString(),
      fields,
    })
    this.db.versions = this.db.versions.slice(0, 50)
    this.#flush()
  }

  listVersions(formId) {
    return this.db.versions
      .filter((v) => v.formId === formId)
      .map((v) => ({ id: v.id, at: v.at, fieldCount: v.fields.length }))
  }

  getVersion(id) {
    return this.db.versions.find((v) => v.id === id) ?? null
  }

  reset() {
    this.db = buildSeedDb()
    this.#flush()
  }
}
