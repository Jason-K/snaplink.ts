/**
 * Shared type utilities.
 */

/**
 * Widen optional properties so they also accept an explicit `undefined`,
 * leaving required properties untouched.
 *
 * `exactOptionalPropertyTypes` draws a distinction between "absent" and
 * "present but undefined". That distinction is exactly what we want for the
 * Karabiner AST in `types/snaplink.ts` — an `undefined`-valued key there would
 * be a schema error. It is *not* what we want for the engine's internal option
 * bags, where callers routinely forward a value that may or may not be set:
 *
 * ```ts
 * tapHold({ key, alone, hold, timeoutMs: binding.timing?.aloneMs })
 * ```
 *
 * Applying this to those parameter types keeps the strict check where it earns
 * its keep and drops the ceremony where it does not.
 */
export type AcceptUndefined<T> = {
  [K in keyof T]: undefined extends T[K] ? T[K] | undefined : T[K];
};
