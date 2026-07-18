import type { FormField, LogicRule, RulePart, TagColor } from '../src/lib/types'

export declare const OP_LABELS: Record<string, string>
export declare const ACTION_LABELS: Record<string, string>

export declare function evalCondition(
  cond: LogicRule['conditions'][number],
  values: Record<string, string>,
): boolean

export declare function evalRule(rule: LogicRule, values: Record<string, string>): boolean

export declare function computeFillState(
  fields: FormField[],
  rules: LogicRule[],
  values: Record<string, string>,
): { hiddenFieldKeys: Set<string>; jumpTargets: Map<number, number> }

export declare function skippedPages(
  fields: FormField[],
  rules: LogicRule[],
  values: Record<string, string>,
): Set<number>

export declare function runSubmitActions(
  rules: LogicRule[],
  values: Record<string, string>,
): { routes: string[]; tags: { text: string; color: TagColor }[]; assigns: string[] }

export declare function ruleToParts(rule: LogicRule, fields: FormField[]): RulePart[]
