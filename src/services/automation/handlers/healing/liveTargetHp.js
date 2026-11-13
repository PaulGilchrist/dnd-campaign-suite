// Display-side twin of the heal WRITE-lane HP-truth law (playbook §80): heals
// commit to the character bucket `currentHitPoints` (modifyHitPoints' player
// branch + HealingPoolModal's dice commit) and NEVER move the combatSummary
// creature row, so cs row HP goes stale after real heals (EH 2026-11-13 GET-
// proved drift: row 100 vs bucket 134). Heal-target choosers must therefore
// read the bucket FIRST and use the row only as FALLBACK when bucket data is
// missing. Monsters carry their HP truth on the cs row and have no runtime HP
// keys at all, so for them the bucket read is null and the row fallback wins —
// the same precedence the target modal (opened one click later) resolves with,
// which closes the chooser-vs-modal HP contradiction.
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// '' and non-numeric bucket values are the app's "no data" fingerprint
// (healingHandler.js selfHealingHpRefusal / massHealUtils resolveStoredCurrentHp
// idiom) — fall back to the row instead of rendering NaN HP.
function storedNumber(stored, fallback) {
    if (stored == null || stored === '') return fallback;
    const num = Number(stored);
    return Number.isFinite(num) ? num : fallback;
}

// Returns the display { currentHp, maxHp } pair for a combatSummary creature
// row: bucket `currentHitPoints`/`hitPoints` when available, row values only
// as fallback. Keeps the exact 4-key target shape producers already pin.
export function resolveLiveTargetHp(creature) {
    return {
        currentHp: storedNumber(getRuntimeValue(creature.name, 'currentHitPoints'), creature.currentHp),
        maxHp: storedNumber(getRuntimeValue(creature.name, 'hitPoints'), creature.maxHp),
    };
}
