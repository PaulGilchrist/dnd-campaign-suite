/**
 * Level 5 — React binding for the assertCanAct gate (L5-001).
 *
 * Returns a stable gate callback bound to (campaignName, creatureName) so call
 * sites become:
 *   const gate = useActionGate(campaignName, characterName)
 *   ...
 *   if (!gate('bonusAction', { cannotAct, cannotActReason, setPopupHtml }).allowed) return
 *
 * All decision logic lives in services/combat/canTakeAction.js (pure); this
 * hook only pins identity. When enforcement is off the gate is a no-op.
 */
import { useCallback } from 'react';
import { assertCanAct } from '../../services/combat/assertCanAct.js';

export function useActionGate(campaignName, creatureName) {
    return useCallback(
        (bucket = 'action', overrides = {}) =>
            assertCanAct({ campaignName, creatureName, bucket, ...overrides }),
        [campaignName, creatureName],
    );
}
