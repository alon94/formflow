/** JSON-file storage adapter â fallback when better-sqlite3 isn't available. */
import fs from 'node:fs'
import { buildSeedDb } from '../shared/seed.js'

export class JsonStore {
  constructor(path) {
    this.path = path
    try {
      this.db = JSON.parse(fs.readFileSync(path, 'utf-8'))
      if (!this.db.workspaces) throw new Error('stale schema')
    } catch {
      this.db = buildSeedDb()
      this.#flush()
    }
    if (!Array.isArray(this.db.customTemplates)) this.db.customTemplates = []
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

  workspaceForEmail(email) {
    return (
      this.db.workspaces.find((w) => w.members.includes(email) || w.ownerEmail === email) ?? null
    )
  }

  createWorkspace(w) {
    this.db.workspaces.push(w)
    this.#flush()
    return w
  }

  updateWorkspace(id, patch) {
    const ws = this.db.workspaces.find((w) => w.id === id)
    if (!ws) return null
    for (const k of ['name', 'businessName', 'phone', 'domain', 'goal', 'website']) {
      if (patch[k] !== undefined) ws[k] = patch[k]
    }
    this.#flush()
    return ws
  }

  listWorkspacesForEmail(email) {
    return this.db.workspaces.filter(
      (w) => w.members.includes(email) || w.ownerEmail === email,
    )
  }

  getWorkspace(id) {
    return this.db.workspaces.find((w) => w.id === id) ?? null
  }

  deleteWorkspace(id) {
    const before = this.db.workspaces.length
    this.db.workspaces = this.db.workspaces.filter((w) => w.id !== id)
    this.db.customTemplates = this.db.customTemplates.filter((t) => t.workspaceId !== id)
    this.#flush()
    return before !== this.db.workspaces.length
  }

  listForms(workspaceId) {
    return this.db.forms.filter((f) => f.workspaceId === workspaceId)
  }

  getForm(idOrSlug) {
    return this.db.forms.find((f) => f.id === idOrSlug || f.slug === idOrSlug) ?? null
  }

  createForm(form) {
    this.db.forms.push(form)
    this.#flush()
  }

  saveForm(form) {
    const i = this.db.forms.findIndex((f) => f.id === form.id)
    if (i !== -1) this.db.forms[i] = form
    this.#flush()
  }

  deleteForm(formId, { withSubmissions }) {
    if (withSubmissions) {
      const subIds = new Set(
        this.db.submissions.filter((s) => s.formId === formId).map((s) => s.id),
      )
      this.db.notifications = this.db.notifications.filter((n) => !subIds.has(n.submissionId))
      this.db.submissions = this.db.submissions.filter((s) => s.formId !== formId)
    }
    this.db.webhookLogs = this.db.webhookLogs.filter((l) => l.formId !== formId)
    this.db.versions = this.db.versions.filter((v) => v.formId !== formId)
    this.db.forms = this.db.forms.filter((f) => f.id !== formId)
    this.#flush()
  }

  listSubmissions(formId, { q, track, status }) {
    return this.db.submissions
      .filter((s) => {
        if (s.formId !== formId) return false
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

  hasValue(formId, fieldKey, value) {
    return this.db.submissions.some(
      (s) => s.formId === formId && String(s.values?.[fieldKey] ?? '') === value,
    )
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

  deleteSubmission(id) {
    this.db.notifications = this.db.notifications.filter((n) => n.submissionId !== id)
    this.db.submissions = this.db.submissions.filter((s) => s.id !== id)
    this.#flush()
  }

  submissionCount(formId) {
    return this.db.submissions.filter((s) => s.formId === formId).length
  }

  latestSubmissionAt(formId) {
    return (
      this.db.submissions
        .filter((s) => s.formId === formId)
        .reduce((m, s) => (s.submittedAt > m ? s.submittedAt : m), '') || null
    )
  }

  trackCounts(formId) {
    const counts = {}
    for (const s of this.db.submissions) {
      if (s.formId === formId) counts[s.track ?? 'â'] = (counts[s.track ?? 'â'] ?? 0) + 1
    }
    return counts
  }

  dailyCounts(formId) {
    const counts = {}
    for (const s of this.db.submissions) {
      if (s.formId !== formId) continue
      const day = s.submittedAt.slice(0, 10)
      counts[day] = (counts[day] ?? 0) + 1
    }
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

  listWebhookLogs(formId) {
    return this.db.webhookLogs.filter((l) => l.formId === formId).slice(0, 50)
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
    this.db.versions = this.db.versions
      .filter((v) => v.formId === formId)
      .slice(0, 50)
      .concat(this.db.versions.filter((v) => v.formId !== formId))
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

  /* ---- custom templates ---- */
  listTemplates(workspaceId) {
    return this.db.customTemplates.filter(
      (t) => t.scope === 'global' || t.workspaceId === workspaceId,
    )
  }

  getTemplate(id) {
    return this.db.customTemplates.find((t) => t.id === id) ?? null
  }

  createTemplate(tpl) {
    this.db.customTemplates.push(tpl)
    this.#flush()
    return tpl
  }

  updateTemplate(id, patch) {
    const tpl = this.db.customTemplates.find((t) => t.id === id)
    if (!tpl) return null
    for (const k of ['name', 'description', 'icon', 'category', 'scope', 'fields']) {
      if (patch[k] !== undefined) tpl[k] = patch[k]
    }
    tpl.updatedAt = new Date().toISOString()
    this.#flush()
    return tpl
  }

  deleteTemplate(id) {
    const before = this.db.customTemplates.length
    this.db.customTemplates = this.db.customTemplates.filter((t) => t.id !== id)
    this.#flush()
    return before !== this.db.customTemplates.length
  }

  reset() {
    this.db = buildSeedDb()
    this.#flush()
  }
}
