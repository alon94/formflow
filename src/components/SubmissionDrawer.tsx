import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageCircle, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { relTime } from '../lib/data'
import { useStore } from '../lib/store'
import { useState } from 'react'
import type { HandleStatus } from '../lib/types'

const HANDLE_LABEL: Record<HandleStatus, string> = {
  new: 'חדש',
  in_progress: 'בטיפול',
  done: 'טופל',
}

export default function SubmissionDrawer({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  const { fields } = useStore()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => api.getSubmission(id),
  })

  const patch = useMutation({
    mutationFn: (p: Parameters<typeof api.patchSubmission>[1]) =>
      api.patchSubmission(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', id] })
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
    },
  })

  const del = useMutation({
    mutationFn: () => api.deleteSubmission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      onClose()
    },
  })

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} role="presentation" />
      <aside className="drawer" aria-label={`פרטי תשובה ${id}`}>
        <div className="drawer-head">
          <span className="sub-id">#{id}</span>
          <div style={{ minWidth: 0 }}>
            <div className="drawer-title">{data?.name ?? '…'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }} dir="ltr">
              {data?.email}
            </div>
          </div>
          <button
            type="button"
            className={confirmDelete ? 'btn' : 'icon-btn'}
            style={
              confirmDelete
                ? {
                    marginInlineStart: 'auto',
                    background: 'var(--error)',
                    color: '#fff',
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }
                : { marginInlineStart: 'auto', color: 'var(--error)' }
            }
            onClick={() => (confirmDelete ? del.mutate() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
            aria-label={confirmDelete ? 'אישור מחיקת הרשומה' : 'מחיקת הרשומה'}
          >
            {confirmDelete ? (del.isPending ? 'מוחק…' : 'אישור מחיקה?') : <Trash2 size={15} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="סגירת החלונית"
          >
            <X size={16} />
          </button>
        </div>
        {data && (
          <div className="drawer-body">
            <div className="drawer-controls">
              <select
                className="status-select"
                value={data.status}
                onChange={(e) => patch.mutate({ status: e.target.value as HandleStatus })}
                aria-label="סטטוס טיפול"
              >
                {(Object.keys(HANDLE_LABEL) as HandleStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {HANDLE_LABEL[s]}
                  </option>
                ))}
              </select>
              {data.tags.map((t) => (
                <span key={t.text} className={`tag-chip ${t.color}`}>
                  {t.text}
                </span>
              ))}
              <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
                {relTime(data.submittedAt)}
              </span>
            </div>

            <div>
              <div className="drawer-section-title" style={{ marginBottom: 8 }}>
                תשובות
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map((f) => (
                  <div key={f.id} className="answer-row">
                    <span className="q">{f.label}</span>
                    <span
                      className={`a${data.values[f.fieldKey] ? '' : ' empty'}`}
                      dir={f.type === 'email' ? 'ltr' : undefined}
                      style={f.type === 'email' ? { textAlign: 'right' } : undefined}
                    >
                      {data.values[f.fieldKey] || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="drawer-section-title" style={{ marginBottom: 8 }}>
                התראות שנשלחו
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.notifications.length === 0 && (
                  <span style={{ fontSize: 12.5, color: 'var(--text-placeholder)' }}>
                    לא נשלחו התראות לתשובה זו
                  </span>
                )}
                {data.notifications.map((n) => (
                  <div key={n.id} className="notif-log-row">
                    {n.channel === 'email' ? <Mail size={13} /> : <MessageCircle size={13} />}
                    <span className="rec" dir="ltr">
                      {n.recipient}
                    </span>
                    <span>· {n.note}</span>
                    <span className="when">{relTime(n.at)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="drawer-section-title" style={{ marginBottom: 6 }}>
                הערות פנימיות
              </div>
              <textarea
                className="textarea-input"
                rows={3}
                defaultValue={data.notes}
                placeholder="הערה לצוות…"
                onBlur={(e) => {
                  if (e.target.value !== data.notes) patch.mutate({ notes: e.target.value })
                }}
                aria-label="הערות פנימיות"
              />
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
