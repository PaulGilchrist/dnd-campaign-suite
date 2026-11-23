import { useCallback } from 'react';
import { useSyncedState } from '../runtime/useSyncedState.js';

/**
 * GM Copilot state (learnability plan Phase 1): per-campaign, server-first
 * record of which one-time guidance tips the GM has settled. A tip is
 * SETTLED when either:
 *   - `dismissed[tipId]` — the GM clicked × ("don't show again", forever), or
 *   - `seen[tipId]`      — the GM took the guided action (or the learning
 *                          moment itself fired, e.g. the monster card opened).
 *
 * The value lives in the campaign change-data bucket (`gmCopilot`), the same
 * lane `sessionState` uses: every device sees the same state, and tips never
 * resurface on another tab. Writes are settled-once — a repeat settle with no
 * change returns the previous object so the store's equality guard skips the
 * POST entirely.
 *
 * Registered in server/utils/changeDataKeys.js SPECIAL_TOP_LEVEL_KEYS so the
 * Admin census never flags it as a phantom key.
 */
export const GM_COPILOT_KEY = 'gmCopilot';

// Stable empty-object identity: a fresh `{}` literal per render would churn
// isSettled's useCallback deps (and re-arm consumers' effects) every render.
const NO_TIPS = {};

export function useGmCopilot(campaignName) {
  const [copilot, setCopilot] = useSyncedState('campaign', GM_COPILOT_KEY, null, campaignName);
  const dismissed = copilot?.dismissed ?? NO_TIPS;
  const seen = copilot?.seen ?? NO_TIPS;

  const isSettled = useCallback(
    (tipId) => dismissed[tipId] === true || seen[tipId] === true,
    [dismissed, seen]
  );

  const settle = useCallback((field, tipId) => {
    setCopilot((prev) => {
      const current = prev || {};
      if (current[field]?.[tipId] === true) return prev; // settled-once: no write
      return { ...current, [field]: { ...(current[field] || {}), [tipId]: true } };
    });
  }, [setCopilot]);

  const dismiss = useCallback((tipId) => settle('dismissed', tipId), [settle]);
  const markSeen = useCallback((tipId) => settle('seen', tipId), [settle]);

  return { dismissed, seen, isSettled, dismiss, markSeen };
}
