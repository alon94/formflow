import { Mail, MessageCircle, Send, X } from 'lucide-react'
import { useState } from 'react'
import Toggle from '../components/Toggle'
import LogoMark from '../components/LogoMark'
import { smsLog } from '../lib/data'
import { useStore } from '../lib/store'

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

export default function NotificationsScreen() {
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
    <div className="ntf-body">
      <aside className="ntf-side" aria-label="הגדרות הטופס">
        {SIDE_ITEMS.map((item) => (
          <button key={item} type="button" className={item === 'התראות' ? 'active' : ''}>
            {item}
          </button>
        ))}
      </aside>

      <div className="ntf-main">
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
                  <span className="box">{notif.attachPdf ? '✓' : ''}</span> צירוף PDF של
                  התשובה
                </button>
                <button
                  type="button"
                  className={`check-pill${notif.attachIcal ? ' checked' : ''}`}
                  onClick={() => setNotif({ attachIcal: !notif.attachIcal })}
                  aria-pressed={notif.attachIcal}
                >
                  <span className="box">{notif.attachIcal ? '✓' : ''}</span> קובץ iCal
                  לאירוע
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
              <button
                type="button"
                className="add-recipient"
                onClick={() => setNewRecipient('')}
              >
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
      </div>
    </div>
  )
}
