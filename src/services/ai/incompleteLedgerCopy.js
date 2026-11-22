/**
 * Backlog 2026-11-22 (OOO) — the quest_draft ledger-check INCOMPLETE face's
 * pill copy, as a pure string builder (sibling pattern to proposalNameAudit.js:
 * no I/O, no React). Unify the lane labels on ONE all-lowercase style: the
 * copy embeds them mid-sentence ("— X, Y unreadable") and the lane keys are
 * verbatim labels, so a mixed Title-case/lowercase enumeration can never
 * render in one pill. AiWorldConsole.jsx renders the returned string verbatim.
 */

// Canonical enumeration order — index-bound to the Promise.allSettled array
// and to LEDGER_LANES in AiWorldConsole.jsx (unknown keys are dropped).
const LANE_ORDER = ['npcs', 'settlements', 'factions', 'quests']

/**
 * Full pill copy for the incomplete face.
 * @param {string[]} unreadableLaneKeys failed lane keys, any order.
 * @returns {string} `Ledger check incomplete — <labels in lane order> unreadable`;
 *   '' for empty/unknown input (documented no-render contract: the component
 *   only mounts the pill when at least one known lane is unreadable).
 */
export function incompleteLedgerCopy(unreadableLaneKeys) {
    const labels = LANE_ORDER.filter(key => Array.isArray(unreadableLaneKeys) && unreadableLaneKeys.includes(key))
    if (labels.length === 0) return ''
    return `Ledger check incomplete — ${labels.join(', ')} unreadable`
}
