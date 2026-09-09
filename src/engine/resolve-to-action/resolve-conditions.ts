import type { Condition, ToVariable, ToEvent } from "../../types/karabiner";

export function toVar(
  name: string,
  value: string | number | boolean | "toggle" = 1,
): ToEvent {
  let val: string | number = 1;
  if (value === "toggle") val = "toggle";
  else if (typeof value === "boolean") val = value ? 1 : 0;
  else if (value !== undefined) val = value;
  return { set_variable: { name, value: val } } as unknown as ToEvent;
}

export function toVarExpr(
  name: string,
  expression: string,
  keyUpExpression?: string,
): ToEvent {
  const payload: Record<string, unknown> = { name };
  if (expression) payload.expression = expression;
  if (keyUpExpression) payload.key_up_expression = keyUpExpression;
  return { set_variable: payload as ToVariable };
}

export function ifVarExpr(expression: string): Condition {
  return { type: "expression_if", expression } as unknown as Condition;
}

export function unlessVarExpr(expression: string): Condition {
  return { type: "expression_unless", expression } as unknown as Condition;
}

export { withCondition } from "../karabiner-helpers";
