import type { ExprSpec } from "../primitives/expressions";

/**
 * Factory for creating expression specifications.
 *
 * @param expr - Raw ExprTk expression string.
 * @param refDesc - Human-readable description label.
 *
 * @returns An {@linkcode ExprSpec} object.
 *
 * @example
 * ```ts
 * const isSecureInput = expr("AXSecureTextField", "Focused element is a secure text field");
 * ```
 */
const expr = (expr: string, refDesc: string): ExprSpec => ({
    type: "expression",
    expr,
    refDesc,
});

export const EXPRS = {
    isSecureInput: expr("AXSecureTextField", "focused element is a secure text field"),
} as const satisfies Record<string, ExprSpec>; 