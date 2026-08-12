import type { BaseSpec } from "./base";

/**
 * Registry specification for ExprTk expressions.
 *
 * @example
 * ```ts
 * const isSecureInput = expr("isSecureInput", "AXSecureTextField");
 * ```
 * @summary
 * ```json
 * {
 *    "to": [
 *        {
 *            "set_variable": {
 *                "name": "variable name", // required, target variable name
 *                "value": variable value, // required | optional, assigns a value as either an integer | boolean | "string"
 *                "expression": expression, // required | optional, evaluates an expression using exprtk syntax and assigns the result to the variable
 *                "key_up_value": variable value, // optional, assigns a value as either an integer | boolean | "string" on key up
 *                "key_up_expression": expression, // optional, evaluates an expression using exprtk syntax and assigns the result to the variable on key up
 *                "type": "set" | "unset" // optional
 *            }
 *        }
 *    ]
 * }
 * ```
 * @summary
 * ```json
 * {
 *    "conditions": [
 *      { 
 *        "type": "variable_if" | "variable_unless", // required, one of "variable_if" | "variable_unless"
 *        "name": "variable name", // required, target variable name
 *        "value": variable value, // required, value to compare against. Can be an integer | boolean | "string"
 *        "description": string // optional, description of the condition
 *      }
 *    ]
 * }
 * ```
 * 
 * NOTES:
 *  - if key_up_value or type is specified, value is optional
 *  - expression /key_up_expression allow arithmetic expressions using exprtk syntax.  See https://github.com/ArashPartow/exprtk for documentation. 
 *  - The expression can use variables set by other set_variable manipulations or by system.now.milliseconds, system.scroll_direction_is_natural, and the following system-provided variables. 
 *  - If an undefined variable appears in the expression, its value is treated as 0.
 * 
 * @example
 * ```json
 * "to": [
 *     {
 *         "set_variable": {
 *             "name": "my_flag", // my flag is either 1 or 0
 *             "expression": "my_flag != 0 ? 0 : 1"
 *         }
 *     }
 * ]
 * ```
 * NOTES:
 *  - when the type of the value is different, it is treated as having different contents. (e.g., 1 != true, true != "true", etc.)
 *  - when the value of a variable is unset, it is treated as 0, not false or "false"
 *  - Accessibility API variables are either strings (accessibility.*_string) or integers (accessibility.*_size_* or accessibility.*_position_*)
 * 
 */

export interface ExprSpec extends BaseSpec {
    /** Discriminator identifying this primitive as an expression specification. */
    type: "expression";

    /** Raw ExprTk expression string. */
    expr: string;

    /** Optional ExprTk expression string to evaluate when the key is released. */
    key_up_expr?: string;

    /** Optional type of expression to evaluate. */
    expr_type?: "set" | "unset";
}