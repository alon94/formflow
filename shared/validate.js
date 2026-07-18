/**
 * Field validation — single implementation used by the public form (on blur)
 * and by the server on submit (source of truth, per spec §4.2).
 * Returns a Hebrew error message or null.
 */
export function validateValue(field, value) {
  const v = String(value ?? '').trim()
  if (field.required && v === '') return 'שדה חובה'
  if (v === '') return null
  switch (field.type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
        return field.errorMessage || 'נא להזין כתובת מייל תקינה'
      break
    case 'phone':
      if (!/^0(5\d|[2-9])-?\d{7}$/.test(v.replaceAll(' ', '')))
        return field.errorMessage || 'נא להזין מספר טלפון ישראלי תקין (05X-XXXXXXX)'
      break
    case 'id_number': {
      if (!/^\d{9}$/.test(v)) return field.errorMessage || 'ת״ז חייבת לכלול 9 ספרות'
      const sum = v
        .split('')
        .map((d, i) => {
          const n = Number(d) * (i % 2 === 0 ? 1 : 2)
          return n > 9 ? n - 9 : n
        })
        .reduce((a, b) => a + b, 0)
      if (sum % 10 !== 0) return field.errorMessage || 'מספר ת״ז אינו תקין'
      break
    }
    case 'number':
      if (!/^\d+$/.test(v)) return 'נא להזין מספר'
      break
    default:
      break
  }
  return null
}

/**
 * Validate a whole submission against the form definition, skipping fields
 * hidden by fill-scope rules or belonging to skipped pages.
 * Returns a map of fieldKey -> error message (empty when valid).
 */
export function validateSubmission(fields, values, hiddenFieldKeys, skipped) {
  const errors = {}
  for (const field of fields) {
    if (hiddenFieldKeys?.has(field.fieldKey)) continue
    if (skipped?.has(field.page ?? 1)) continue
    const err = validateValue(field, values[field.fieldKey])
    if (err) errors[field.fieldKey] = err
  }
  return errors
}
