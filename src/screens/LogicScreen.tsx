import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import Toggle from '../components/Toggle'
import { fillActions, submitActions } from '../lib/data'
import { useStore } from '../lib/store'
import type { LogicRule, RulePart } from '../lib/types'

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

export default function LogicScreen() {
  const { rules, setRules } = useStore()
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    const close = () => setMenuFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const activeCount = rules.filter((r) => r.enabled).length

  const toggleRule = (id: string, enabled: boolean) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled } : r)))

  const addRule = () => {
    ruleCounter += 1
    const rule: LogicRule = {
      id: `rule-${ruleCounter}`,
      name: 'כלל חדש',
      scope: 'fill',
      enabled: true,
      parts: [
        { kind: 'if', text: 'אם' },
        { kind: 'field', text: 'בחרו שדה…' },
        { kind: 'op', text: 'שווה ל…' },
        { kind: 'value', text: 'ערך' },
        { kind: 'then', text: 'אז' },
        { kind: 'action', text: 'בחרו פעולה…' },
      ],
    }
    setRules([...rules, rule])
  }

  const duplicateRule = (rule: LogicRule) => {
    ruleCounter += 1
    const idx = rules.findIndex((r) => r.id === rule.id)
    const copy = { ...rule, id: `rule-${ruleCounter}`, name: `${rule.name} (עותק)` }
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
          <button type="button" className="btn btn-primary" onClick={addRule}>
            ＋ כלל חדש
          </button>
        </div>

        {rules.map((rule, i) => (
          <article key={rule.id} className="rule-card fade-up">
            <div className="rule-head">
              <span className="rule-num">{i + 1}</span>
              <h3 className="rule-name">{rule.name}</h3>
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
                    <button type="button" onClick={() => { duplicateRule(rule); setMenuFor(null) }}>
                      שכפול כלל
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => { deleteRule(rule.id); setMenuFor(null) }}
                    >
                      מחיקה
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={`rule-expr${rule.enabled ? '' : ' disabled'}`}>
              {rule.parts.map((p, j) => (
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
          💡 הכללים רצים לפי הסדר. גררו כלל כדי לשנות עדיפות; שילוב תנאים עם וגם /
          או וקיבוץ בסוגריים.
        </div>
      </aside>
    </div>
  )
}
