import { MoreHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ACTION_LABELS, OP_LABELS, ruleToParts } from '../../shared/rules.js'
import Toggle from '../components/Toggle'
import { fillActions, submitActions } from '../lib/data'
import { useStore } from '../lib/store'
import type {
  LogicRule,
  RuleAction,
  RuleCondition,
  RuleOp,
  RulePart,
} from '../lib/types'

function ExprPart({ part }: { part: RulePart }) {
  const dir = part.ltr ? 'ltr' : undefined
  switch (part.kind) {
    case 'if':
      return <span className="expr-if">{part.text}</span>
    case 'then':
      return <span className="expr-then">{part.text}</span>
    case 'and':
    case 'or':
      return <span className="expr-join">{part.text}</span>
    case 'field':
      return <span className="expr-field">{part.text}</span>
    case 'op':
      return <span className="expr-op">{part.text}</span>
    case 'value':
      return (
        <span className="expr-value" dir={dir}>
          {part.text}
        </span>
      )
    case 'action':
      return <span className="expr-action">{part.text}</span>
    case 'tag':
      return <span className="expr-tag">{part.text}</span>
  }
}

let ruleCounter = 100

const FILL_ACTION_TYPES = ['show_field', 'hide_field', 'jump_page'] as const
const SUBMIT_ACTION_TYPES = ['route_email', 'add_tag', 'assign'] as const

function RuleEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: LogicRule
  onSave: (rule: LogicRule) => void
  onClose: () => void
}) {
  const { fields } = useStore()
  const [rule, setRule] = useState<LogicRule>(initial)

  const patch = (p: Partial<LogicRule>) => setRule((r) => ({ ...r, ...p }))

  const patchCondition = (i: number, p: Partial<RuleCondition>) =>
    patch({
      conditions: rule.conditions.map((c, j) => (j === i ? { ...c, ...p } : c)),
    })

  const defaultAction = (scope: LogicRule['scope']): RuleAction =>
    scope === 'fill'
      ? { type: 'show_field', fieldKey: fields[0]?.fieldKey ?? '' }
      : { type: 'route_email', to: '' }

  const changeActionType = (i: number, type: string) => {
    let next: RuleAction
    switch (type) {
      case 'show_field':
      case 'hide_field':
        next = { type, fieldKey: fields[0]?.fieldKey ?? '' }
        break
      case 'jump_page':
        next = { type, page: 3, label: '3 · סיכום' }
        break
      case 'route_email':
        next = { type, to: '' }
        break
      case 'add_tag':
        next = { type, text: 'VIP', color: 'peach' }
        break
      default:
        next = { type: 'assign', user: '' }
    }
    patch({ actions: rule.actions.map((a, j) => (j === i ? next : a)) })
  }

  const patchAction = (i: number, p: Record<string, unknown>) =>
    patch({
      actions: rule.actions.map((a, j) => (j === i ? ({ ...a, ...p } as RuleAction) : a)),
    })

  const actionTypes = rule.scope === 'fill' ? FILL_ACTION_TYPES : SUBMIT_ACTION_TYPES

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card rule-modal fade-up"
        role="dialog"
        aria-label="עריכת כלל"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="סגירה">
          <X size={16} />
        </button>
        <h2>{initial.name ? 'עריכת כלל' : 'כלל חדש'}</h2>

        <div className="set-group">
          <label className="field-label" htmlFor="rule-name">
            שם הכלל
          </label>
          <input
            id="rule-name"
            className="text-input"
            value={rule.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="למשל: ניתוב פניות VIP"
          />
        </div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="field-label">מתי רץ</span>
            <div className="seg-mini" role="radiogroup" aria-label="Scope">
              <button
                type="button"
                className={rule.scope === 'fill' ? 'active' : ''}
                onClick={() =>
                  patch({ scope: 'fill', actions: [defaultAction('fill')] })
                }
              >
                בזמן מילוי
              </button>
              <button
                type="button"
                className={rule.scope === 'submit' ? 'active' : ''}
                onClick={() =>
                  patch({ scope: 'submit', actions: [defaultAction('submit')] })
                }
              >
                אחרי שליחה
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="field-label">שילוב תנאים</span>
            <div className="seg-mini" role="radiogroup" aria-label="שילוב תנאים">
              <button
                type="button"
                className={rule.combinator === 'and' ? 'active' : ''}
                onClick={() => patch({ combinator: 'and' })}
              >
                וגם
              </button>
              <button
                type="button"
                className={rule.combinator === 'or' ? 'active' : ''}
                onClick={() => patch({ combinator: 'or' })}
              >
                או
              </button>
            </div>
          </div>
        </div>

        <div className="set-group">
          <span className="field-label">תנאים (אם)</span>
          {rule.conditions.map((c, i) => {
            const field = fields.find((f) => f.fieldKey === c.fieldKey)
            const needsValue = c.op !== 'empty' && c.op !== 'filled'
            return (
              <div key={i} className="cond-row">
                <select
                  className="select-input"
                  value={c.fieldKey}
                  onChange={(e) => patchCondition(i, { fieldKey: e.target.value })}
                  aria-label="שדה"
                >
                  {fields.map((f) => (
                    <option key={f.fieldKey} value={f.fieldKey}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="select-input"
                  value={c.op}
                  onChange={(e) => patchCondition(i, { op: e.target.value as RuleOp })}
                  aria-label="אופרטור"
                >
                  {Object.entries(OP_LABELS).map(([op, label]) => (
                    <option key={op} value={op}>
                      {label}
                    </option>
                  ))}
                </select>
                {needsValue ? (
                  field?.options?.length ? (
                    <select
                      className="select-input"
                      value={c.value ?? ''}
                      onChange={(e) => patchCondition(i, { value: e.target.value })}
                      aria-label="ערך"
                    >
                      <option value="">בחרו ערך…</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="text-input"
                      value={c.value ?? ''}
                      onChange={(e) => patchCondition(i, { value: e.target.value })}
                      aria-label="ערך"
                    />
                  )
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="הסרת תנאי"
                  onClick={() =>
                    patch({ conditions: rule.conditions.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className="add-line"
            onClick={() =>
              patch({
                conditions: [
                  ...rule.conditions,
                  { fieldKey: fields[0]?.fieldKey ?? '', op: 'eq', value: '' },
                ],
              })
            }
          >
            ＋ תנאי
          </button>
        </div>

        <div className="set-group">
          <span className="field-label">פעולות (אז)</span>
          {rule.actions.map((a, i) => (
            <div key={i} className="cond-row" style={{ gridTemplateColumns: '1.2fr 1.5fr auto' }}>
              <select
                className="select-input"
                value={a.type}
                onChange={(e) => changeActionType(i, e.target.value)}
                aria-label="סוג פעולה"
              >
                {actionTypes.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
              {(a.type === 'show_field' || a.type === 'hide_field') && (
                <select
                  className="select-input"
                  value={a.fieldKey}
                  onChange={(e) => patchAction(i, { fieldKey: e.target.value })}
                  aria-label="שדה יעד"
                >
                  {fields.map((f) => (
                    <option key={f.fieldKey} value={f.fieldKey}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
              {a.type === 'jump_page' && (
                <input
                  className="text-input"
                  type="number"
                  min={1}
                  max={9}
                  value={a.page}
                  onChange={(e) =>
                    patchAction(i, {
                      page: Number(e.target.value),
                      label: `עמוד ${e.target.value}`,
                    })
                  }
                  aria-label="מספר עמוד"
                />
              )}
              {a.type === 'route_email' && (
                <input
                  className="text-input"
                  dir="ltr"
                  placeholder="name@company.co.il"
                  value={a.to}
                  onChange={(e) => patchAction(i, { to: e.target.value })}
                  aria-label="כתובת מייל"
                />
              )}
              {a.type === 'add_tag' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="text-input"
                    value={a.text}
                    onChange={(e) => patchAction(i, { text: e.target.value })}
                    aria-label="טקסט תגית"
                  />
                  <select
                    className="select-input"
                    style={{ width: 110 }}
                    value={a.color}
                    onChange={(e) => patchAction(i, { color: e.target.value })}
                    aria-label="צבע תגית"
                  >
                    <option value="peach">כתום</option>
                    <option value="purple">סגול</option>
                  </select>
                </div>
              )}
              {a.type === 'assign' && (
                <input
                  className="text-input"
                  placeholder="שם המטפל/ת"
                  value={a.user}
                  onChange={(e) => patchAction(i, { user: e.target.value })}
                  aria-label="מטפל"
                />
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label="הסרת פעולה"
                onClick={() => patch({ actions: rule.actions.filter((_, j) => j !== i) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="add-line"
            onClick={() => patch({ actions: [...rule.actions, defaultAction(rule.scope)] })}
          >
            ＋ פעולה
          </button>
        </div>

        <div className="rule-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave({ ...rule, name: rule.name.trim() || 'כלל ללא שם' })
              onClose()
            }}
          >
            שמירת הכלל
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LogicScreen() {
  const { rules, setRules, fields } = useStore()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [editing, setEditing] = useState<LogicRule | null>(null)

  useEffect(() => {
    const close = () => setMenuFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const activeCount = rules.filter((r) => r.enabled).length

  const toggleRule = (id: string, enabled: boolean) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled } : r)))

  const newRule = (): LogicRule => {
    ruleCounter += 1
    return {
      id: `rule-${ruleCounter}-${Date.now()}`,
      name: '',
      scope: 'fill',
      enabled: true,
      combinator: 'and',
      conditions: [{ fieldKey: fields[0]?.fieldKey ?? '', op: 'eq', value: '' }],
      actions: [{ type: 'show_field', fieldKey: fields[0]?.fieldKey ?? '' }],
    }
  }

  const saveRule = (rule: LogicRule) => {
    const exists = rules.some((r) => r.id === rule.id)
    setRules(exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule])
  }

  const duplicateRule = (rule: LogicRule) => {
    ruleCounter += 1
    const idx = rules.findIndex((r) => r.id === rule.id)
    const copy = {
      ...rule,
      id: `rule-${ruleCounter}-${Date.now()}`,
      name: `${rule.name} (עותק)`,
    }
    const next = [...rules]
    next.splice(idx + 1, 0, copy)
    setRules(next)
  }

  const deleteRule = (id: string) => setRules(rules.filter((r) => r.id !== id))

  return (
    <div className="lgc-body">
      <div className="lgc-main">
        <div className="lgc-title-row">
          <h1>כללי לוגיקה</h1>
          <span className="count-chip">{activeCount} כללים פעילים</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(newRule())}
          >
            ＋ כלל חדש
          </button>
        </div>

        {rules.map((rule, i) => (
          <article key={rule.id} className="rule-card fade-up">
            <div className="rule-head">
              <span className="rule-num">{i + 1}</span>
              <button
                type="button"
                className="rule-name"
                style={{ textAlign: 'start' }}
                onClick={() => setEditing(rule)}
                title="עריכת הכלל"
              >
                {rule.name}
              </button>
              <span className={`scope-chip ${rule.scope}`}>
                {rule.scope === 'fill' ? 'בזמן מילוי' : 'אחרי שליחה'}
              </span>
              <div className="rule-head-end">
                <Toggle
                  small
                  on={rule.enabled}
                  onChange={(v) => toggleRule(rule.id, v)}
                  label={`הפעלת הכלל ${rule.name}`}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`פעולות לכלל ${rule.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuFor(menuFor === rule.id ? null : rule.id)
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuFor === rule.id && (
                  <div className="rule-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(rule)
                        setMenuFor(null)
                      }}
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        duplicateRule(rule)
                        setMenuFor(null)
                      }}
                    >
                      שכפול כלל
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        deleteRule(rule.id)
                        setMenuFor(null)
                      }}
                    >
                      מחיקה
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={`rule-expr${rule.enabled ? '' : ' disabled'}`}>
              {ruleToParts(rule, fields).map((p, j) => (
                <ExprPart key={j} part={p} />
              ))}
            </div>
          </article>
        ))}
      </div>

      <aside className="lgc-side" aria-label="פעולות זמינות">
        <h2>פעולות זמינות</h2>
        <span className="field-label">בזמן מילוי</span>
        <div className="action-chips">
          {fillActions.map((a) => (
            <span key={a} className="action-chip fill">
              {a}
            </span>
          ))}
        </div>
        <span className="field-label" style={{ marginTop: 4 }}>
          אחרי שליחה
        </span>
        <div className="action-chips">
          {submitActions.map((a) => (
            <span key={a} className="action-chip submit">
              {a}
            </span>
          ))}
        </div>
        <div className="tip-box">
          💡 הכללים רצים לפי הסדר. לחצו על שם כלל לעריכה; שילוב תנאים עם וגם / או.
          כללי "בזמן מילוי" רצים חיים בטופס הציבורי, וכללי "אחרי שליחה" מופעלים בשרת.
        </div>
      </aside>

      {editing && (
        <RuleEditor
          initial={editing}
          onSave={saveRule}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
