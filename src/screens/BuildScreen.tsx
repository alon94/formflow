import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AtSign,
  Calendar,
  ChevronDown,
  CircleDot,
  Copy,
  CreditCard,
  GripVertical,
  IdCard,
  Monitor,
  Phone,
  Redo2,
  Search,
  Smartphone,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Toggle from '../components/Toggle'
import { LogoArrow } from '../components/LogoMark'
import { fieldLibrary, fieldTypeMeta } from '../lib/data'
import { useStore } from '../lib/store'
import type { FieldType, FormField } from '../lib/types'
import type { FormShellContext } from './FormShell'

const FIELDS_KEY = 'formflow.fields'

function TypeIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  switch (icon) {
    case 'Aa':
      return <span style={{ fontSize: size - 1, fontWeight: 800 }}>Aa</span>
    case '@':
      return <AtSign size={size} />
    case 'phone':
      return <Phone size={size} />
    case 'radio':
      return <CircleDot size={size} />
    case 'dropdown':
      return <ChevronDown size={size} />
    case 'date':
      return <Calendar size={size} />
    case 'star':
      return <Star size={size} />
    case 'id':
      return <IdCard size={size} />
    case 'card':
      return <CreditCard size={size} />
    default:
      return null
  }
}

function LibraryItem({ type, label, icon, dimmed, onAdd }: {
  type: FieldType
  label: string
  icon: string
  dimmed: boolean
  onAdd: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${type}`,
    data: { source: 'library', type },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`lib-item${isDragging || dimmed ? ' source-dim' : ''}`}
      onClick={onAdd}
      title="גרירה לקנבס או לחיצה להוספה"
      {...attributes}
      {...listeners}
    >
      <span className="lib-icon">
        <TypeIcon icon={icon} />
      </span>
      {label}
    </button>
  )
}

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case 'radio':
      return (
        <div className="option-grid">
          {(field.options ?? []).map((opt, i) => (
            <div key={opt} className={`option-card${i === 0 ? ' chosen' : ''}`}>
              {opt}
            </div>
          ))}
        </div>
      )
    case 'dropdown':
      return (
        <div className="f-input" style={{ justifyContent: 'space-between' }}>
          {field.placeholder ?? 'בחירה מהרשימה…'}
          <ChevronDown size={15} />
        </div>
      )
    case 'date':
      return (
        <div className="f-input" style={{ justifyContent: 'space-between' }}>
          {field.placeholder ?? 'dd/mm/yyyy'}
          <Calendar size={15} />
        </div>
      )
    case 'rating':
      return (
        <div className="rating-row" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={22} fill={n <= 4 ? 'currentColor' : 'none'} />
          ))}
        </div>
      )
    default:
      return (
        <div className="f-input" dir={field.type === 'email' ? 'ltr' : undefined}>
          {field.placeholder ?? ''}
        </div>
      )
  }
}

function CanvasField({ field, selected, onSelect, onDuplicate, onDelete }: {
  field: FormField
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id, data: { source: 'canvas' } })
  const meta = fieldTypeMeta[field.type]
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`field-card${field.half ? ' half' : ''}${selected ? ' selected' : ''}${
        isDragging ? ' drag-ghost' : ''
      }`}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onFocus={onSelect}
      aria-label={`שדה ${field.label}${selected ? ' (נבחר)' : ''}`}
    >
      {selected && (
        <>
          <span className="field-tag">
            <TypeIcon icon={meta.icon} size={11} />
            {meta.label} · נבחר
          </span>
          <span className="field-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="icon-btn" aria-label="שכפול שדה" onClick={onDuplicate}>
              <Copy size={14} />
            </button>
            <button type="button" className="icon-btn" aria-label="מחיקת שדה" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
            <span className="icon-btn" style={{ cursor: 'grab' }} aria-hidden="true">
              <GripVertical size={14} />
            </span>
          </span>
        </>
      )}
      <div className="f-label">
        {field.label} {field.required && <span className="req-star">*</span>}
      </div>
      <FieldPreview field={field} />
      {field.help && <div className="f-help">{field.help}</div>}
    </div>
  )
}

let fieldCounter = 1

function newField(type: FieldType): FormField {
  const meta = fieldTypeMeta[type]
  fieldCounter += 1
  const base: FormField = {
    id: `fld-${Date.now()}-${fieldCounter}`,
    type,
    label: meta.label,
    required: false,
    fieldKey: `${type}_${fieldCounter}`,
  }
  switch (type) {
    case 'short_text':
      return { ...base, label: 'שאלה חדשה', placeholder: 'הקלידו תשובה…' }
    case 'email':
      return {
        ...base,
        label: 'כתובת מייל',
        placeholder: 'name@company.co.il',
        errorMessage: 'נא להזין כתובת מייל תקינה',
      }
    case 'phone':
      return { ...base, label: 'טלפון נייד', placeholder: '050-0000000' }
    case 'radio':
      return { ...base, label: 'בחירה יחידה', options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3'] }
    case 'dropdown':
      return { ...base, label: 'רשימה נפתחת', options: ['אפשרות 1', 'אפשרות 2'] }
    case 'date':
      return { ...base, label: 'תאריך' }
    case 'rating':
      return { ...base, label: 'דירוג' }
    case 'id_number':
      return { ...base, label: 'תעודת זהות', placeholder: '9 ספרות' }
    case 'payment':
      return { ...base, label: 'תשלום', help: 'שדה תשלום — יחויב בעת השליחה' }
    default:
      return base
  }
}

const VALIDATION_LABELS: Record<string, string[]> = {
  email: ['פורמט מייל תקין'],
  phone: ['פורמט טלפון ישראלי'],
  id_number: ['ספרת ביקורת ת״ז'],
  date: ['תאריך עתידי בלבד'],
}

export default function BuildScreen() {
  const { fields, setFields } = useStore()
  const { setSaveStatus } = useOutletContext<FormShellContext>()
  const [selectedId, setSelectedId] = useState<string | null>('fld-email')
  const [libSearch, setLibSearch] = useState('')
  const [libCat, setLibCat] = useState<'all' | 'text' | 'choice' | 'advanced'>('all')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [settingsTab, setSettingsTab] = useState<'settings' | 'validation' | 'logic'>('settings')
  const [activeDrag, setActiveDrag] = useState<
    | { kind: 'lib'; type: FieldType }
    | { kind: 'field'; field: FormField }
    | null
  >(null)

  const [past, setPast] = useState<FormField[][]>([])
  const [future, setFuture] = useState<FormField[][]>([])
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  /* autosave: debounce writes, mirror to localStorage (per spec — every few seconds) */
  const saveTimer = useRef<number | undefined>(undefined)
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setSaveStatus('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(fields))
      setSaveStatus('saved')
    }, 900)
    return () => window.clearTimeout(saveTimer.current)
  }, [fields, setSaveStatus])

  /* history-recording update (add/remove/reorder/toggles) */
  const commit = useCallback(
    (next: FormField[]) => {
      setPast((p) => [...p.slice(-49), fieldsRef.current])
      setFuture([])
      setFields(next)
    },
    [setFields],
  )

  /* light update without history (typing) */
  const update = useCallback(
    (next: FormField[]) => {
      setFields(next)
    },
    [setFields],
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture((f) => [...f, fieldsRef.current])
      setFields(prev)
      return p.slice(0, -1)
    })
  }, [setFields])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[f.length - 1]
      setPast((p) => [...p.slice(-49), fieldsRef.current])
      setFields(next)
      return f.slice(0, -1)
    })
  }, [setFields])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { setNodeRef: dropzoneRef, isOver: overDropzone } = useDroppable({
    id: 'dropzone',
  })

  const selected = fields.find((f) => f.id === selectedId) ?? null

  const visibleLibrary = fieldLibrary.filter(
    (f) =>
      (libCat === 'all' || f.category === libCat) &&
      (libSearch.trim() === '' || f.label.includes(libSearch.trim())),
  )

  const addField = (type: FieldType, index?: number) => {
    const f = newField(type)
    const next = [...fields]
    next.splice(index ?? fields.length, 0, f)
    commit(next)
    setSelectedId(f.id)
  }

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current
    if (data?.source === 'library') {
      setActiveDrag({ kind: 'lib', type: data.type as FieldType })
    } else {
      const f = fields.find((x) => x.id === e.active.id)
      if (f) setActiveDrag({ kind: 'field', field: f })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveDrag(null)
    if (!over) return
    const fromLibrary = active.data.current?.source === 'library'
    if (fromLibrary) {
      const type = active.data.current?.type as FieldType
      if (over.id === 'dropzone') {
        addField(type)
      } else {
        const idx = fields.findIndex((f) => f.id === over.id)
        addField(type, idx === -1 ? undefined : idx)
      }
      return
    }
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        commit(arrayMove(fields, oldIndex, newIndex))
      }
    }
  }

  const patchSelected = (patch: Partial<FormField>, withHistory = false) => {
    if (!selected) return
    const next = fields.map((f) => (f.id === selected.id ? { ...f, ...patch } : f))
    if (withHistory) commit(next)
    else update(next)
  }

  const duplicateField = (id: string) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx === -1) return
    const src = fields[idx]
    fieldCounter += 1
    const copy: FormField = {
      ...src,
      id: `fld-${Date.now()}-${fieldCounter}`,
      fieldKey: `${src.fieldKey}_copy`,
    }
    const next = [...fields]
    next.splice(idx + 1, 0, copy)
    commit(next)
    setSelectedId(copy.id)
  }

  const deleteField = (id: string) => {
    commit(fields.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const validations = useMemo(() => {
    if (!selected) return []
    const list = [...(VALIDATION_LABELS[selected.type] ?? [])]
    if (selected.unique) list.push('לא נשלח בעבר')
    return list
  }, [selected])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="bld-body">
        {/* field library */}
        <aside className="bld-panel bld-library" aria-label="ספריית שדות">
          <label className="search-pill">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="חיפוש שדה…"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              aria-label="חיפוש שדה"
            />
          </label>
          <div className="lib-chips">
            {(
              [
                ['all', 'הכל'],
                ['text', 'טקסט'],
                ['choice', 'בחירה'],
                ['advanced', 'מתקדם'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`lib-chip${libCat === id ? ' active' : ''}`}
                onClick={() => setLibCat(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lib-list">
            {visibleLibrary.map((f) => (
              <LibraryItem
                key={f.type}
                type={f.type}
                label={f.label}
                icon={f.icon}
                dimmed={activeDrag?.kind === 'lib' && activeDrag.type === f.type}
                onAdd={() => addField(f.type)}
              />
            ))}
          </div>
        </aside>

        {/* canvas */}
        <section className="bld-panel bld-canvas" aria-label="קנבס הטופס">
          <div className={`canvas-form${device === 'mobile' ? ' mobile' : ''}`}>
            <div>
              <span className="event-tag">🎟 12 בנובמבר · תל אביב</span>
              <div className="canvas-title">הרשמה לכנס המוצר 2026</div>
              <div className="canvas-sub">3 דקות וסיימתם — נשמח לראותכם!</div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '40%' }} />
            </div>
            <SortableContext items={fields.map((f) => f.id)} strategy={rectSortingStrategy}>
              <div className="fields-wrap">
                {fields.map((f) => (
                  <CanvasField
                    key={f.id}
                    field={f}
                    selected={f.id === selectedId}
                    onSelect={() => setSelectedId(f.id)}
                    onDuplicate={() => duplicateField(f.id)}
                    onDelete={() => deleteField(f.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <div
              ref={dropzoneRef}
              className={`dropzone${overDropzone ? ' over' : ''}`}
            >
              ＋ גררו שדה לכאן
            </div>
            <div className="canvas-footer">
              <span className="submit-demo">שליחת הרשמה ←</span>
              <span className="powered">
                <LogoArrow size={13} /> מופעל ע״י שווה עסקים 360
              </span>
            </div>
          </div>
          <div className="device-bar">
            <button
              type="button"
              className={`device-pill${device === 'desktop' ? ' active' : ''}`}
              onClick={() => setDevice('desktop')}
            >
              <Monitor size={13} aria-hidden="true" /> דסקטופ
            </button>
            <button
              type="button"
              className={`device-pill${device === 'mobile' ? ' active' : ''}`}
              onClick={() => setDevice('mobile')}
            >
              <Smartphone size={13} aria-hidden="true" /> מובייל
            </button>
            <span className="vdivider" aria-hidden="true" />
            <button
              type="button"
              className="undo-btn"
              onClick={undo}
              disabled={past.length === 0}
              aria-label="ביטול (Ctrl+Z)"
              title="ביטול (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="undo-btn"
              onClick={redo}
              disabled={future.length === 0}
              aria-label="ביצוע חוזר (Ctrl+Y)"
              title="ביצוע חוזר (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
          </div>
        </section>

        {/* field settings */}
        <aside className="bld-panel bld-settings" aria-label="הגדרות שדה">
          <div className="settings-tabs" role="tablist">
            {(
              [
                ['settings', 'הגדרות'],
                ['validation', 'ולידציה'],
                ['logic', 'לוגיקה'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={settingsTab === id}
                className={`settings-tab${settingsTab === id ? ' active' : ''}`}
                onClick={() => setSettingsTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {!selected ? (
            <div className="settings-empty">
              בחרו שדה בקנבס
              <br />
              כדי לערוך את ההגדרות שלו
            </div>
          ) : settingsTab === 'logic' ? (
            <div className="settings-note">
              💡 כללי לוגיקה לשדה זה מנוהלים בלשונית <b>לוגיקה</b> שבסרגל העליון —
              תנאים (אם/אז), הצגה מותנית, קפיצה בין עמודים ועוד.
            </div>
          ) : (
            <>
              {settingsTab === 'settings' && (
                <>
                  <div className="set-group">
                    <label className="field-label" htmlFor="set-label">
                      תווית (Label)
                    </label>
                    <input
                      id="set-label"
                      className="text-input"
                      style={{ fontWeight: 600 }}
                      value={selected.label}
                      onChange={(e) => patchSelected({ label: e.target.value })}
                    />
                  </div>
                  <div className="set-group">
                    <label className="field-label" htmlFor="set-help">
                      טקסט עזרה
                    </label>
                    <input
                      id="set-help"
                      className="text-input"
                      value={selected.help ?? ''}
                      placeholder="טקסט הסבר מתחת לשדה"
                      onChange={(e) => patchSelected({ help: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="toggle-row">
                שדה חובה
                <Toggle
                  on={selected.required}
                  onChange={(v) => patchSelected({ required: v }, true)}
                  label="שדה חובה"
                />
              </div>
              <div className="toggle-row">
                ערך ייחודי
                <Toggle
                  on={!!selected.unique}
                  onChange={(v) => patchSelected({ unique: v }, true)}
                  label="ערך ייחודי"
                />
              </div>
              <div className="set-group">
                <span className="field-label">ולידציות פעילות</span>
                {validations.map((v) => (
                  <div key={v} className="validation-chip">
                    ✓ {v}
                    <button
                      type="button"
                      className="remove"
                      aria-label={`הסרת ולידציה ${v}`}
                      onClick={() =>
                        v === 'לא נשלח בעבר' && patchSelected({ unique: false }, true)
                      }
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-rule">
                  ＋ הוספת כלל
                </button>
              </div>
              <div className="set-group">
                <label className="field-label" htmlFor="set-error">
                  הודעת שגיאה
                </label>
                <input
                  id="set-error"
                  className="text-input"
                  value={selected.errorMessage ?? ''}
                  placeholder="הודעה כשהערך שגוי"
                  onChange={(e) => patchSelected({ errorMessage: e.target.value })}
                />
              </div>
              {settingsTab === 'settings' && (
                <div className="set-group">
                  <label className="field-label" htmlFor="set-key">
                    Field Key
                  </label>
                  <input
                    id="set-key"
                    className="text-input mono"
                    style={{ fontSize: 13, color: 'var(--text-muted)' }}
                    dir="ltr"
                    value={selected.fieldKey}
                    onChange={(e) => patchSelected({ fieldKey: e.target.value })}
                  />
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <DragOverlay>
        {activeDrag?.kind === 'lib' && (
          <div className="lib-item overlay">
            <span className="lib-icon">
              <TypeIcon icon={fieldTypeMeta[activeDrag.type].icon} />
            </span>
            {fieldTypeMeta[activeDrag.type].label}
          </div>
        )}
        {activeDrag?.kind === 'field' && (
          <div className="field-card selected" style={{ width: 560, margin: 0 }}>
            <div className="f-label">
              {activeDrag.field.label}{' '}
              {activeDrag.field.required && <span className="req-star">*</span>}
            </div>
            <FieldPreview field={activeDrag.field} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
