import { applyRegenerateEffect } from '../../automation/index.js';

// DEAD-EXPORT CENSUS #1398 (dead-export batch — DORMANT-retire-pending RE-VERIFIED
// against fix#211 fresh bytes 2026-10-23, then excised per fix#82/fix#97 precedent).
// triggerRegenerate (old :3-:23) was a ZERO-prod-caller forwarder into executeHandler
// with a hand-built automation.type 'regenerate'. fix#211 (#1483/#1472) made the LIVE
// regenerate lane WITHOUT wiring this symbol:
//   route home (disk-byte cast): SERVICE_HANDLED_SPELLS shield 'regenerate'
//     (triggerSpells.js:64, fix#211 one-literal) -> execution/index.js:314
//     handleRegenerate arm (triggerSpells.js:67) -> helpers.applyRegenerateSpell
//     (spellCastService/execution/helpers.js:486).
//   route home (modal cast): spellGates.js gateRegenerate :642 -> cfSetPending
//     ('regenerate') :833 -> useSimpleSpellHandlers.js runRegenerate :124 ->
//     confirmRegenerate below -> applyRegenerateEffect (automation/index.js).
//   registry: automation/index.js HANDLER_MAP 'regenerate' :614 stays wired as
//     fix#211's registry shield — NEVER edited here (owner constraint, cited).
// Fresh grep census (src/**, 2026-10-23): zero production callers of
// triggerRegenerate remain after fix#211 — the modal lane enters via
// confirmRegenerate, never via executeHandler. Retire-pending RESOLVED to DELETE.

export async function confirmRegenerate(action, playerStats, campaignName, mapName, targetName) {
    try {
        const appliedResult = await applyRegenerateEffect(action, playerStats, campaignName, mapName, targetName);
        return appliedResult;
    } catch (e) {
        console.error('[regenerate] Failed to apply Regenerate effect:', e);
        return null;
    }
}
