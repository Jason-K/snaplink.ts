import type { ToEvent } from "../../types/karabiner";
import type { Action } from "../../data";
import { ensurePathQuotingInCommand } from "../utils";

import { actionToEvents, isActionSpec } from "./action-handlers";

export * from "./action-handlers";
export * from "./resolve-app";
export * from "./resolve-conditions";
export * from "./resolve-folder";
export * from "./resolve-map";
export * from "./resolve-script";

/** Normalize path quoting inside any shell command an action produced. */
function normalizeToEvent(event: ToEvent): ToEvent {
  if (!event || typeof event !== "object" || !("shell_command" in event)) return event;
  // Destructure rather than spread-and-override: spreading a `ExactlyOne` union
  // widens it back to "every member's keys at once", which no member satisfies.
  const { shell_command, ...rest } = event;
  // Asserted: rebuilding a union member from its own rest object drops the
  // `?: never` siblings that make it exclusive. This rewrites one string field
  // of an event that was already a valid `ToEvent`, so its member cannot change.
  return { ...rest, shell_command: ensurePathQuotingInCommand(shell_command) } as ToEvent;
}

/**
 * Compile one `do` entry into Karabiner `to` events.
 *
 * Entries are either a high-level {@link import('../../data').ActionSpec},
 * dispatched through the handler registry, or a raw `ToEvent` passed through
 * verbatim (used by mouse bindings for events the DSL does not model).
 */
export function resolveActionToEvents(action: Action): ToEvent[] {
  const events = isActionSpec(action) ? actionToEvents(action) : [action];
  return events.map(normalizeToEvent);
}
