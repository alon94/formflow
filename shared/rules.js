/**
 * FormFlow rules engine — shared between the client (fill-scope, live)
 * and the server (submit-scope, source of truth). Plain ESM so Node can
 * import it directly; typed via rules.d.ts for the TS frontend.
 */

export const OP_LABELS = {
  eq: 'שווה ל…',
  neq: 'שונה מ…',
  contains: 'מכיל…',
  gt: 'גדול מ…',
  lt: 'קטן מ…',
  empty: 'ריק',
  filled: 'מלא',
}

export const ACTION_LABELS = {
  show_field: 'הצג שדה',
  hide_field: 'הסתר שדה',
  jump_page: 'קפוץ לעמוד',
  route_email: 'שלח מייל אל',
  add_tag: 'הוסף תגית',
  assign: 'הקצה מטפל',
}

function toNumber(v) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}

export function evalCondition(cond, values) {
  const raw = values[cond.fieldKey]
  const v = String(raw ?? '').trim()
  switch (cond.op) {
    case 'eq':
      return v === String(cond.value ?? '')
    case 'neq':
      return v !== String(cond.value ?? '')
    case 'contains':
      return v.includes(String(cond.value ?? ''))
    case 'gt': {
      const a = toNumber(v)
      const b = toNumber(cond.value)
      return a !== null && b !== null && a > b
    }
    case 'lt': {
      const a = toNumber(v)
      const b = toNumber(cond.value)
      return a !== null && b !== null && a < b
    }
    case 'empty':
      return v === ''
    case 'filled':
      return v !== ''
    default:
      return false
  }
}

export function evalRule(rule, values) {
  if (!rule.conditions.length) return false
  const results = rule.conditions.map((c) => evalCondition(c, values))
  return rule.combinator === 'or' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Fill-scope visibility: a field targeted by show_field starts hidden and is
 * revealed while the rule matches; hide_field is the inverse. Later rules win.
 * Returns { hiddenFieldKeys: Set<string>, jumpTargets: Map<number, number> }
 * where jumpTargets maps a source page to the page to jump to after it.
 */
export function computeFillState(fields, rules, values) {
  const hidden = new Set()
  const jumpTargets = new Map()
  for (const rule of rules) {
    if (!rule.enabled || rule.scope !== 'fill') continue
    const matched = evalRule(rule, values)
    for (const action of rule.actions) {
      if (action.type === 'show_field') {
        if (matched) hidden.delete(action.fieldKey)
        else hidden.add(action.fieldKey)
      } else if (action.type === 'hide_field') {
        if (matched) hidden.add(action.fieldKey)
        else hidden.delete(action.fieldKey)
      } else if (action.type === 'jump_page' && matched) {
        const sourcePage = Math.max(
          1,
          ...rule.conditions
            .map((c) => fields.find((f) => f.fieldKey === c.fieldKey)?.page ?? 1),
        )
        jumpTargets.set(sourcePage, action.page)
      }
    }
  }
  return { hiddenFieldKeys: hidden, jumpTargets }
}

/** Pages skipped by jump rules, given current values. */
export function skippedPages(fields, rules, values) {
  const { jumpTargets } = computeFillState(fields, rules, values)
  const skipped = new Set()
  for (const [from, to] of jumpTargets) {
    for (let p = from + 1; p < to; p++) skipped.add(p)
  }
  return skipped
}

/**
 * Submit-scope actions for a submission.
 * Returns { routes: string[], tags: {text,color}[], assigns: string[] }
 */
export function runSubmitActions(rules, values) {
  const routes = []
  const tags = []
  const assigns = []
  for (const rule of rules) {
    if (!rule.enabled || rule.scope !== 'submit') continue
    if (!evalRule(rule, values)) continue
    for (const action of rule.actions) {
      if (action.type === 'route_email') routes.push(action.to)
      else if (action.type === 'add_tag') tags.push({ text: action.text, color: action.color })
      else if (action.type === 'assign') assigns.push(action.user)
    }
  }
  return { routes, tags, assigns }
}

/** Render a structured rule as display pills (kind/text pairs). */
export function ruleToParts(rule, fields) {
  const label = (key) => fields.find((f) => f.fieldKey === key)?.label ?? key
  const parts = [{ kind: 'if', text: 'אם' }]
  rule.conditions.forEach((c, i) => {
    if (i > 0) parts.push({ kind: 'and', text: rule.combinator === 'or' ? 'או' : 'וגם' })
    parts.push({ kind: 'field', text: label(c.fieldKey) })
    parts.push({ kind: 'op', text: OP_LABELS[c.op] ?? c.op })
    if (c.op !== 'empty' && c.op !== 'filled') {
      parts.push({ kind: 'value', text: String(c.value ?? '') })
    }
  })
  parts.push({ kind: 'then', text: 'אז' })
  rule.actions.forEach((a, i) => {
    if (i > 0) parts.push({ kind: 'and', text: 'וגם' })
    parts.push({ kind: 'action', text: ACTION_LABELS[a.type] ?? a.type })
    if (a.type === 'show_field' || a.type === 'hide_field') {
      parts.push({ kind: 'value', text: label(a.fieldKey) })
    } else if (a.type === 'jump_page') {
      parts.push({ kind: 'value', text: a.label ?? `עמוד ${a.page}` })
    } else if (a.type === 'route_email') {
      parts.push({ kind: 'value', text: a.to, ltr: true })
    } else if (a.type === 'add_tag') {
      parts.push({ kind: 'tag', text: a.text })
    } else if (a.type === 'assign') {
      parts.push({ kind: 'value', text: a.user })
    }
  })
  return parts
}
