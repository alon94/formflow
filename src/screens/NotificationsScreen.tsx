import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Webhook,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ShareBlock from '../components/ShareBlock'
import Toggle from '../components/Toggle'
import LogoMark from '../components/LogoMark'
import { api } from '../lib/api'
import { relTime, smsLog } from '../lib/data'
import { useStore } from '../lib/store'
import type { WebhookConfig } from '../lib/types'

const SIDE_ITEMS = ['כללי', 'התראות', 'פרסום והפצה', 'אינטגרציות', 'Webhooks', 'גישה והרשאות']

const SAMPLE_TAGS: Record<string, string> = {
  first_name: 'נועה',
  submission_id: '1128',
  short_url: 'shv.io/x4T9',
}

function fillTags(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE_TAGS[key] ?? `{{${key}}}`)
}

const SEGMENT_SIZE = 134
const SMS_MAX = 268

/* ---------- התראות ---------- */
function NotificationsPanel() {
  const { notif, setNotif } = useStore()
  const [newRecipient, setNewRecipient] = useState<string | null>(null)

  const smsLen = notif.smsTemplate.length
  const segments = Math.max(1, Math.ceil(smsLen / SEGMENT_SIZE))

  const addRecipient = () => {
    const email = newRecipient?.trim()
    if (email && email.includes('@')) {
      setNotif({ recipients: [...notif.recipients, email] })
    }
    setNewRecipient(null)
  }

  return (
    <>
      {/* מייל אישור לממלא */}
      <section className="ntf-card">
        <div className="ntf-card-head">
          <span className="ntf-icon">
            <Mail size={18} />
          </span>
          <div>
            <div className="ntf-title">מייל אישור לממלא</div>
            <div className="ntf-sub">נשלח אוטומטית לשדה המייל שזוהה בטופס</div>
          </div>
          <Toggle
            on={notif.confirmEnabled}
            onChange={(v) => setNotif({ confirmEnabled: v })}
            label="מייל אישור לממלא"
          />
        </div>
        <div className={`ntf-cols${notif.confirmEnabled ? '' : ' card-disabled'}`}>
          <div className="ntf-fields">
            <div className="set-group">
              <label className="field-label" htmlFor="mail-subject">
                נושא
              </label>
              <input
                id="mail-subject"
                className="text-input"
                value={notif.subject}
                onChange={(e) => setNotif({ subject: e.target.value })}
              />
              <span className="merge-hint">
                משתני מיזוג: <code dir="ltr">{'{{first_name}}'}</code>{' '}
                <code dir="ltr">{'{{submission_id}}'}</code>{' '}
                <code dir="ltr">{'{{short_url}}'}</code>
              </span>
            </div>
            <div className="set-group">
              <label className="field-label" htmlFor="mail-from">
                כתובת From
              </label>
              <div className="from-wrap">
                <input
                  id="mail-from"
                  className="text-input"
                  dir="ltr"
                  value={notif.fromAddress}
                  onChange={(e) => setNotif({ fromAddress: e.target.value })}
                />
                <span className="verified-badge">דומיין מאומת ✓</span>
              </div>
            </div>
            <div className="check-pills">
              <button
                type="button"
                className={`check-pill${notif.attachPdf ? ' checked' : ''}`}
                onClick={() => setNotif({ attachPdf: !notif.attachPdf })}
                aria-pressed={notif.attachPdf}
              >
                <span className="box">{notif.attachPdf ? '✓' : ''}</span> צירוף PDF של התשובה
              </button>
              <button
                type="button"
                className={`check-pill${notif.attachIcal ? ' checked' : ''}`}
                onClick={() => setNotif({ attachIcal: !notif.attachIcal })}
                aria-pressed={notif.attachIcal}
              >
                <span className="box">{notif.attachIcal ? '✓' : ''}</span> קובץ iCal לאירוע
              </button>
            </div>
          </div>
          <div className="mail-preview-panel">
            <div className="mini-mail">
              <LogoMark size={15} withText={false} />
              <div className="mini-mail-title">{fillTags(notif.subject)}</div>
              <div className="mini-mail-body">
                הרשמה מס׳ 1128 · מסלול מוצר וניהול
                <br />
                12 בנובמבר · מרכז הכנסים תל אביב
              </div>
              <span className="mini-mail-btn">לצפייה בפרטים</span>
            </div>
            <div className="preview-caption">תצוגה מקדימה חיה</div>
          </div>
        </div>
      </section>

      {/* מייל לבעל הטופס */}
      <section className="ntf-card">
        <div className="ntf-card-head">
          <span className="ntf-icon">
            <Send size={18} />
          </span>
          <div>
            <div className="ntf-title">מייל התראה לבעל הטופס</div>
            <div className="ntf-sub">
              כל תשובה נשלחת לנמענים; ניתוב מותנה מוגדר בלשונית לוגיקה
            </div>
          </div>
          <Toggle
            on={notif.ownerEnabled}
            onChange={(v) => setNotif({ ownerEnabled: v })}
            label="מייל התראה לבעל הטופס"
          />
        </div>
        <div className={`recipients-row${notif.ownerEnabled ? '' : ' card-disabled'}`}>
          <span className="field-label">נמענים:</span>
          {notif.recipients.map((r) => (
            <span key={r} className="recipient-chip" dir="ltr">
              {r}
              <button
                type="button"
                aria-label={`הסרת ${r}`}
                onClick={() =>
                  setNotif({ recipients: notif.recipients.filter((x) => x !== r) })
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {newRecipient === null ? (
            <button type="button" className="add-recipient" onClick={() => setNewRecipient('')}>
              ＋ נמען
            </button>
          ) : (
            <input
              className="add-recipient-input"
              dir="ltr"
              autoFocus
              placeholder="name@company.co.il"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onBlur={addRecipient}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addRecipient()
                if (e.key === 'Escape') setNewRecipient(null)
              }}
              aria-label="הוספת נמען"
            />
          )}
          <span className="digest-row">
            Digest יומי במקום מייל לכל תשובה
            <Toggle
              small
              on={notif.digest}
              onChange={(v) => setNotif({ digest: v })}
              label="Digest יומי"
            />
          </span>
        </div>
      </section>

      {/* SMS */}
      <section className="ntf-card">
        <div className="ntf-cols">
          <div className="ntf-fields">
            <div className="ntf-card-head">
              <span className="ntf-icon">
                <MessageCircle size={18} />
              </span>
              <div>
                <div className="ntf-title">SMS אישור לממלא</div>
                <div className="ntf-sub">ספק: 019 (ישראל) · שם שולח: SHAVEH360</div>
              </div>
              <Toggle
                on={notif.smsEnabled}
                onChange={(v) => setNotif({ smsEnabled: v })}
                label="SMS אישור לממלא"
              />
            </div>
            <div className={notif.smsEnabled ? '' : 'card-disabled'}>
              <textarea
                className="sms-template"
                rows={2}
                value={notif.smsTemplate}
                maxLength={SMS_MAX}
                onChange={(e) => setNotif({ smsTemplate: e.target.value })}
                aria-label="תבנית הודעת SMS"
              />
              <div className="sms-meta" style={{ marginTop: 10 }}>
                <span>
                  {smsLen} / {SMS_MAX} תווים · מקטע {segments} מ-2
                </span>
                <span className="quota-badge">מכסה: 1,420 / 2,000 החודש</span>
                <span className="reminder-row">
                  תזכורת יומיים לפני האירוע
                  <Toggle
                    small
                    on={notif.smsReminder}
                    onChange={(v) => setNotif({ smsReminder: v })}
                    label="תזכורת לפני האירוע"
                  />
                </span>
              </div>
            </div>
          </div>
          <div className="sms-log">
            <span className="field-label" style={{ fontSize: 12 }}>
              לוג שליחות אחרון
            </span>
            {smsLog.map((row) => (
              <div key={row.phone} className="log-row">
                <span dir="ltr">{row.phone}</span>
                <span className={`log-status ${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------- Webhooks (spec §4.9.2) ---------- */
function WebhooksPanel() {
  const { webhooks, setWebhooks, formId } = useStore()
  const queryClient = useQueryClient()
  const [newUrl, setNewUrl] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const { data: logs } = useQuery({
    queryKey: ['webhook-logs', formId],
    queryFn: () => api.getWebhookLogs(formId),
  })

  const retry = useMutation({
    mutationFn: (id: string) => api.retryWebhookLog(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-logs'] }),
  })

  const addWebhook = () => {
    const url = newUrl.trim()
    if (!url.startsWith('http')) return
    const wh: WebhookConfig = {
      id: `wh-${Date.now()}`,
      url,
      events: ['submission.created'],
      active: true,
      secret: `whsec_${Math.random().toString(16).slice(2, 18)}`,
    }
    setWebhooks([...webhooks, wh])
    setNewUrl('')
  }

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <section className="ntf-card">
        <div className="ntf-card-head">
          <span className="ntf-icon">
            <Webhook size={18} />
          </span>
          <div>
            <div className="ntf-title">Webhooks</div>
            <div className="ntf-sub">
              קריאת HTTP לכל אירוע · Payload JSON חתום ב-HMAC-SHA256 · Retry אוטומטי (5 ניסיונות)
            </div>
          </div>
        </div>

        {webhooks.map((wh) => (
          <div key={wh.id} className="whk-row">
            <Toggle
              small
              on={wh.active}
              onChange={(v) =>
                setWebhooks(webhooks.map((w) => (w.id === wh.id ? { ...w, active: v } : w)))
              }
              label={`הפעלת ${wh.url}`}
            />
            <div className="whk-main">
              <span className="whk-url mono" dir="ltr">
                {wh.url}
              </span>
              <div className="whk-meta">
                {wh.events.map((ev) => (
                  <span key={ev} className="whk-event mono" dir="ltr">
                    {ev}
                  </span>
                ))}
                <span className="whk-secret mono" dir="ltr">
                  {revealed.has(wh.id) ? wh.secret : 'whsec_••••••••••••'}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={revealed.has(wh.id) ? 'הסתרת ה-Secret' : 'הצגת ה-Secret'}
                  onClick={() => toggleReveal(wh.id)}
                >
                  {revealed.has(wh.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`מחיקת ${wh.url}`}
              onClick={() => setWebhooks(webhooks.filter((w) => w.id !== wh.id))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div className="whk-add">
          <input
            className="text-input"
            dir="ltr"
            placeholder="https://example.com/webhooks/formflow"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWebhook()}
            aria-label="כתובת Webhook חדשה"
          />
          <button type="button" className="btn btn-primary" onClick={addWebhook}>
            <Plus size={14} aria-hidden="true" /> Webhook
          </button>
        </div>
      </section>

      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          לוג קריאות אחרונות
        </div>
        <div className="whk-log">
          {(logs ?? []).map((log) => (
            <div key={log.id} className="whk-log-row" title={log.payload}>
              <span className={`whk-status${log.status < 400 ? ' ok' : ' fail'}`}>
                {log.status}
              </span>
              <span className="mono" dir="ltr" style={{ fontSize: 12 }}>
                {log.event}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                תשובה #{log.submissionId} · ניסיון {log.attempt}
              </span>
              <span className="whk-when">{relTime(log.at)}</span>
              {log.status >= 400 && (
                <button
                  type="button"
                  className="btn btn-secondary whk-retry"
                  onClick={() => retry.mutate(log.id)}
                >
                  <RotateCcw size={12} aria-hidden="true" /> שליחה חוזרת
                </button>
              )}
            </div>
          ))}
          {(logs ?? []).length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              אין קריאות עדיין — שלחו תשובה בטופס הציבורי
            </span>
          )}
        </div>
      </section>
    </>
  )
}

/* ---------- פרסום והפצה (spec §4.8) ---------- */
function PublishPanel() {
  const { settings, setSettings } = useStore()
  return (
    <>
      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          קישור ציבורי, QR והטמעה
        </div>
        <ShareBlock />
      </section>
      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          הגבלות פרסום
        </div>
        <div className="limits-grid">
          <div className="set-group">
            <label className="field-label" htmlFor="close-at">
              תאריך סגירה
            </label>
            <input
              id="close-at"
              type="date"
              className="text-input"
              value={settings.closeAt}
              onChange={(e) => setSettings({ closeAt: e.target.value })}
            />
          </div>
          <div className="set-group">
            <label className="field-label" htmlFor="max-resp">
              מכסת תשובות מקסימלית
            </label>
            <input
              id="max-resp"
              className="text-input"
              inputMode="numeric"
              value={settings.maxResponses}
              onChange={(e) => setSettings({ maxResponses: e.target.value })}
            />
          </div>
          <div className="toggle-row">
            תשובה אחת למשתמש
            <Toggle
              on={settings.onePerUser}
              onChange={(v) => setSettings({ onePerUser: v })}
              label="תשובה אחת למשתמש"
            />
          </div>
          <div className="toggle-row">
            הגנת סיסמה
            <Toggle
              on={settings.passwordProtect}
              onChange={(v) => setSettings({ passwordProtect: v })}
              label="הגנת סיסמה"
            />
          </div>
        </div>
        <div className="ntf-sub">
          שמירת טיוטה לממלא פעילה — ממלאים יכולים להמשיך מאוחר יותר מאותו מכשיר.
        </div>
      </section>
      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          עמוד תודה והפניה
        </div>
        <div className="limits-grid">
          <div className="set-group" style={{ gridColumn: '1 / -1' }}>
            <label className="field-label" htmlFor="ty-title">
              כותרת עמוד התודה
            </label>
            <input
              id="ty-title"
              className="text-input"
              placeholder="תודה שמילאתם! 🎉"
              value={settings.thankYouTitle}
              onChange={(e) => setSettings({ thankYouTitle: e.target.value })}
            />
          </div>
          <div className="set-group" style={{ gridColumn: '1 / -1' }}>
            <label className="field-label" htmlFor="ty-msg">
              הודעת תודה
            </label>
            <textarea
              id="ty-msg"
              className="text-input"
              rows={2}
              placeholder="הפרטים נקלטו אצלנו ונחזור אליכם בהקדם."
              value={settings.thankYouMessage}
              onChange={(e) => setSettings({ thankYouMessage: e.target.value })}
            />
          </div>
          <div className="set-group" style={{ gridColumn: '1 / -1' }}>
            <label className="field-label" htmlFor="redir-url">
              הפניה אוטומטית לאחר שליחה (URL)
            </label>
            <input
              id="redir-url"
              className="text-input"
              inputMode="url"
              placeholder="https://example.co.il/thanks"
              value={settings.redirectUrl}
              onChange={(e) => setSettings({ redirectUrl: e.target.value })}
            />
          </div>
          <div className="set-group">
            <label className="field-label" htmlFor="redir-delay">
              השהיה לפני הפניה (שניות)
            </label>
            <input
              id="redir-delay"
              className="text-input"
              inputMode="numeric"
              value={settings.redirectDelay}
              onChange={(e) => setSettings({ redirectDelay: e.target.value })}
            />
          </div>
        </div>
        <div className="ntf-sub">
          אם הוזן URL — הממלא יופנה אליו אוטומטית לאחר השליחה. אחרת יוצג עמוד התודה.
        </div>
      </section>
    </>
  )
}

/* ---------- כללי ---------- */
function GeneralPanel() {
  const { formName, setFormName, formSlug } = useStore()
  return (
    <section className="ntf-card">
      <div className="ntf-title" style={{ fontSize: 15 }}>
        הגדרות כלליות
      </div>
      <div className="limits-grid">
        <div className="set-group" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label" htmlFor="form-name">
            שם הטופס
          </label>
          <input
            id="form-name"
            className="text-input"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>
        <div className="set-group">
          <span className="field-label">קישור (Slug)</span>
          <span className="text-input mono" dir="ltr" style={{ color: 'var(--text-muted)' }}>
            /f/{formSlug}
          </span>
        </div>
        <div className="set-group">
          <label className="field-label" htmlFor="form-lang">
            שפת הטופס
          </label>
          <select id="form-lang" className="select-input" defaultValue="he">
            <option value="he">עברית</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="ru">Русский</option>
          </select>
        </div>
        <div className="set-group">
          <label className="field-label" htmlFor="retention">
            מחיקת נתונים אוטומטית (Retention)
          </label>
          <select id="retention" className="select-input" defaultValue="none">
            <option value="none">ללא מחיקה</option>
            <option value="6">אחרי 6 חודשים</option>
            <option value="12">אחרי 12 חודשים</option>
            <option value="24">אחרי 24 חודשים</option>
          </select>
        </div>
      </div>
    </section>
  )
}

/* ---------- גישה והרשאות (spec ch.3) ---------- */
function AccessPanel() {
  const roles = [
    ['מנהל מערכת (Admin)', 'ניהול Workspace, משתמשים, חיובים, אינטגרציות והגדרות אבטחה'],
    ['עורך (Editor)', 'יצירה ועריכה של טפסים, צפייה בתשובות, הגדרת התראות ואינטגרציות'],
    ['צופה (Viewer)', 'צפייה בטפסים ובתשובות בלבד, ייצוא נתונים'],
    ['ממלא (Respondent)', 'גישה לטופס פורסם בלבד — אנונימי או מזוהה, ללא חשבון'],
  ]
  return (
    <>
      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          חברי צוות
        </div>
        <div className="recipients-row">
          <span className="recipient-chip">
            <span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
              יש
            </span>
            ישראל שווה · Admin
          </span>
          <span className="recipient-chip" dir="ltr">
            michal@shaveh360.co.il · Editor
          </span>
          <button type="button" className="add-recipient">
            ＋ הזמנת חבר/ת צוות
          </button>
        </div>
      </section>
      <section className="ntf-card">
        <div className="ntf-title" style={{ fontSize: 15 }}>
          תפקידים והרשאות
        </div>
        <div className="roles-table">
          {roles.map(([role, desc]) => (
            <div key={role} className="roles-row">
              <span className="roles-name">{role}</span>
              <span className="roles-desc">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function IntegrationsPanel() {
  return (
    <section className="ntf-card" style={{ alignItems: 'flex-start' }}>
      <div className="ntf-title" style={{ fontSize: 15 }}>
        אינטגרציות
      </div>
      <div className="ntf-sub">
        חיבורי Google Sheets, Slack, CRM, תשלומים ועוד מנוהלים במסך האינטגרציות של
        ה-Workspace.
      </div>
      <Link to="/integrations" className="btn btn-primary">
        לניהול האינטגרציות <ArrowLeft size={14} aria-hidden="true" />
      </Link>
    </section>
  )
}

export default function SettingsScreen() {
  const [panel, setPanel] = useState('התראות')

  return (
    <div className="ntf-body">
      <aside className="ntf-side" aria-label="הגדרות הטופס">
        {SIDE_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === panel ? 'active' : ''}
            onClick={() => setPanel(item)}
          >
            {item}
          </button>
        ))}
      </aside>

      <div className="ntf-main">
        {panel === 'כללי' && <GeneralPanel />}
        {panel === 'התראות' && <NotificationsPanel />}
        {panel === 'פרסום והפצה' && <PublishPanel />}
        {panel === 'אינטגרציות' && <IntegrationsPanel />}
        {panel === 'Webhooks' && <WebhooksPanel />}
        {panel === 'גישה והרשאות' && <AccessPanel />}
      </div>
    </div>
  )
}
