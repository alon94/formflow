import type { FormField } from '../src/lib/types'

export declare function validateValue(field: FormField, value: string | undefined): string | null

export declare function validateSubmission(
  fields: FormField[],
  values: Record<string, string>,
  hiddenFieldKeys?: Set<string>,
  skipped?: Set<number>,
): Record<string, string>
