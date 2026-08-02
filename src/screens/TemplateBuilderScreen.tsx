import { ArrowRight, GripVertical, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminTopbar from '../components/AdminTopbar'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { CustomTemplate, FieldType, FormField, TemplateScope } from '../lib/types'

/* self-contained palette so the builder never depends on seed labels */
interface PaletteItem {
  type: FieldType
  label: string
  category: 'text' | 'choice' | 'advanced'
}

const PALETTE: PaletteItem[] = [
  { type: 'short_text', label: 'טקסט קצר', category: 'text' },
  { type: 'long_text', label: 'טקסט ארוך', category: 'text' },
  { type: 'email', label: 'כתובת מייל', category: 'text' },
  { type: 'phone', label: 'טלפון', category: 'text' },
  { type: 'number', label: 'מספר', category: 'text' },
  { type: 'radio', label: 'בחירה יחידה', category: 'choice' },
  { type: 'checkbox', label: 'תיבות סימון', category: 'choice' },
  { type: 'dropdown', label: 'רשימה נפתחת', category: 'choice' },
  { type: 'date', label: 'תאריך', category: 'advanced' },
  { type: 'rating', label: 'דירוג', category: 'advanced' },
  { type: 'id_number', label: 'תעודת זהות', category: 'advanced' },
  { type: 'payment', label: 'תשלום', category: 'advanced' },
]

const CATEGORIES = ['כללי', 'אירועים', 'עסקי', 'HR', 'חינוך', 'בריאות', 'נדל״ן']

function keyFor(type: FieldType, n: number): string {
  return type + '_' + n
}

export default function TemplateBuilderScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const { activeWorkspace } = useStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('כללי')
  const [scope, setScope] = useState<TemplateScope>('workspace')
  const [fields, setFields] = useState<FormField[]>([])
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(!editId)

  /* when editing, pull the existing template once */
  useMemo(() => {
    if (!editId || loaded) return
    void api.getTemplates().then((list) => {
      const tpl = (list as CustomTemplate[]).find((t) => t.id === editId)
      if (tpl) {
        setName(tpl.name)
        setDescription(tpl.description)
        setCategory(tpl.category)
        setScope(tpl.scope)
        setFields(tpl.fields)
      }
      setLoaded(true)
    })
  }, [editId, loaded])

  function addField(item: PaletteItem) {
    const n = fields.length + 1
    const needsOptions = item.type === 'radio' || item.type === 'checkbox' || item.type === 'dropdown'
    setFields((prev) => [
      ...prev,
      {
        id: 'fld-' + Date.now() + '-' + n,
        type: item.type,
        label: item.label,
        required: false,
        fieldKey: keyFor(item.type, n),
        options: needsOptions ? ['אפשרות 1', 'אפשרות 2'] : undefined,
      },
    ])
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  function move(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const i = prev.findIndex((f) => f.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(i, 1)
      next.splice(j, 0, item)
      return next
    })
  }

  async function save() {
    if (!name.trim() || fields.length === 0) return
    setSaving(true)
    try {
      if (editId) {
        await api.updateTemplate(editId, { name, description, category, scope, fields })
      } else {
        await api.createTemplate({ name, description, category, scope, fields })
      }
      navigate('/templates')
    } finally {
      setSaving(false)
    }
  }

  const canSave = name.trim().length > 0 && fields.length > 0

  return (
    <div className="admin-shell">
      <AdminTopbar search="" onSearch={() => {}} searchPlaceholder="חיפוש…" />
      <main className="page-body builder-page" dir="rtl">
        <div className="builder-head">
          <button type="button" className="ghost-btn" onClick={() => navigate('/templates')}>
            <ArrowRight size={16} /> חזרה לתבניות
          </button>
          <h1>{editId ? 'עריכת תבנית' : 'תבנית חדשה'}</h1>
          <p className="muted">
            {scope === 'global'
              ? 'תבנית משותפת — זמינה לכל העסקים שלך'
              : 'נשמרת לעסק: ' + (activeWorkspace?.businessName || activeWorkspace?.name || '—')}
          </p>
        </div>

        <div className="tpl-grid">
          <section className="tpl-meta card">
            <label className="fld">
              <span>שם התבנית</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: הרשמה לסדנה" />
            </label>
            <label className="fld">
              <span>תיאור קצר</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="מה התבנית עושה"
              />
            </label>
            <label className="fld">
              <span>קטגוריה</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>היקף</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as TemplateScope)}>
                <option value="workspace">רק לעסק הנוכחי</option>
                <option value="global">גלובלית (כל העסקים)</option>
              </select>
            </label>

            <div className="palette">
              <span className="palette-title">הוספת שדה</span>
              <div className="palette-grid">
                {PALETTE.map((p) => (
                  <button type="button" key={p.type} className="palette-chip" onClick={() => addField(p)}>
                    <Plus size={14} /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="tpl-fields card">
            <div className="tpl-fields-head">
              <h2>שדות התבנית</h2>
              <span className="muted">{fields.length} שדות</span>
            </div>
            {fields.length === 0 && <p className="empty">עדיין אין שדות — הוסיפו מהרשימה משמאל.</p>}
            <ul className="field-list">
              {fields.map((f, idx) => (
                <li key={f.id} className="field-row">
                  <span className="drag" aria-hidden>
                    <GripVertical size={16} />
                  </span>
                  <div className="field-main">
                    <input
                      className="field-label-input"
                      value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })}
                    />
                    <span className="field-type">{PALETTE.find((p) => p.type === f.type)?.label ?? f.type}</span>
                  </div>
                  <label className="req-toggle">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })}
                    />
                    חובה
                  </label>
                  <div className="field-actions">
                    <button type="button" onClick={() => move(f.id, -1)} disabled={idx === 0} aria-label="למעלה">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(f.id, 1)}
                      disabled={idx === fields.length - 1}
                      aria-label="למטה"
                    >
                      ↓
                    </button>
                    <button type="button" className="danger" onClick={() => removeField(f.id)} aria-label="מחיקה">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="builder-foot">
          <button type="button" className="ghost-btn" onClick={() => navigate('/templates')}>
            ביטול
          </button>
          <button type="button" className="cta" onClick={save} disabled={!canSave || saving}>
            <Save size={16} /> {saving ? 'שומר…' : editId ? 'שמירת שינויים' : 'שמירת תבנית'}
          </button>
        </div>
      </main>
    </div>
  )
}
