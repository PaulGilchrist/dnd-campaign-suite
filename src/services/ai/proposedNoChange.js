// @maintained-by-ai
/**
 * AI refine echo-detection, SHARED across layers (backlog echo-no-op-audit).
 *
 * CLIENT (AiRefineButton): holds the modal open with the no-change notice when
 * a success echoes the input, so nothing looks applied that isn't.
 * SERVER (authoring/refine.js): runs the SAME predicate before appending the
 * ai_refine audit row, so an echo audits an honest no-op line instead of
 * "proposed a replacement" — both LAN clients benefit, not just the tab that
 * detected the echo.
 *
 * Subpath lodash import (default interop) so this file stays importable by
 * plain-Node ESM on the server, where named CJS imports resolve to undefined.
 */
import isEqual from 'lodash/isEqual.js';

// Server-owned stamps never round-trip in a proposal — the same strip the
// server refine preflight applies to the input before validating it.
export const SERVER_OWNED_KEYS = ['id', 'updatedAt', 'savedAt', 'draft'];

/**
 * Backlog refine-no-op-silent: a success whose replacement echoes the input
 * must not read like an applied change. No-change holds when every field the
 * proposal offers back matches the current input AND the proposal doesn't drop
 * a field the GM actually filled in (that WOULD alter the form via
 * setFormData). Server-owned keys and empty inputs are exempt.
 */
export function proposedNoChange(entity, replacement) {
  if (!replacement || typeof replacement !== 'object') return false;
  const current = Object.fromEntries(Object.entries(entity || {})
    .filter(([key]) => !SERVER_OWNED_KEYS.includes(key)));
  const keys = Object.keys(replacement);
  return keys.every((key) => isEqual(replacement[key], current[key]))
    && Object.keys(current).every((key) => keys.includes(key)
      || current[key] === '' || current[key] === null || current[key] === undefined);
}
