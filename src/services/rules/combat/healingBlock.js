import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// MA-0016: heal-block te ('no_healing', e.g. Aberrant Spirit (Slaad) Claw —
// "the target can't regain Hit Points until the start of the spirit's next
// turn"). Single consumer seam for the canonical HP-regain helpers
// (applyHealingToTarget + applyHealingDirectly): Second Wind, spell heals,
// hit dice, short-rest bonus and aura/reaction heals all route through those
// two helpers, so gating both blocks the app-wide heal paths.
// Residual (GM-enforced, CLA-325 precedent): direct currentHitPoints writers
// (turn-start ticks, long-rest restore, GM initiative-card HP input) bypass
// this gate — adjudicate manually.
function getHealingBlockEffect(targetName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName);
    if (!Array.isArray(storedEffects)) return null;
    return storedEffects.find(te => te.target === targetName && te.effect === 'no_healing') || null;
}

function isHealingBlocked(targetName, campaignName, healAmount) {
    if (!(Number(healAmount) > 0)) return null;
    const effect = getHealingBlockEffect(targetName, campaignName);
    if (!effect) return null;
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'healing_blocked',
        characterName: targetName,
        abilityName: 'no_healing',
        description: `${targetName} can't regain Hit Points — ${Number(healAmount)} healing refused (Claw of ${effect.source || 'the spirit'}; lasts until the start of the spirit's next turn). GM-enforced for scattered direct-HP writes.`,
        timestamp: Date.now(),
    }).catch(e => console.error('[healingBlock] refusal log failed:', e));
    return effect;
}

// Zero-heal result shape for blocked applyHealingToTarget calls.
function blockedHealResult(combatSummary, targetName, campaignName) {
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);
    const oldHp = creature?.type === 'player'
        ? (getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0)
        : (creature?.currentHp ?? 0);
    return { actualHeal: 0, oldHp, newHp: oldHp, maxHp: creature?.maxHp ?? null };
}

export { getHealingBlockEffect, isHealingBlocked, blockedHealResult };
