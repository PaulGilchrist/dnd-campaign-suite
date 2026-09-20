// MA-0610: Djinni Create Whirlwind — turn-start recurring tick.
// The zone picker (MA-0042/MA-0043 lane, zone dict authored on the row) arms
// the registered `whirlwind` containment te on covered creatures; the
// failed-save leg (MA-0063 grant in SaveAttackAoeModal) lands Restrained.
// This consumer is the MA-0367 infernal-wound turn-start seam twin: RAW "At
// the start of each of its turns, the Restrained target takes 21 (6d6)
// Thunder damage" — te-keyed + Restrained-gated untyped HP loss at the
// ACTIVE creature's turn start, BEFORE the playerStats guard in
// turnStartEffects.js so PC AND monster victims tick alike. The die rides
// the te descriptor (zone.recurring_damage → te.recurringDie), default 6d6.
// Untyped direct-HP shape (grapple_damage / infernalWoundService precedent —
// computeDamageAfterResistances throws on empty damageTypes); the Thunder
// label is honest copy in the log. Concentration anchor, up-to-20-ft zone
// movement, enters-space re-save, and the once-per-turn latch stay
// GM-enforced (§7 advisory residuals, logged at zone arm).

import { cloneDeep } from 'lodash';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';

export const WHIRLWIND_TE = 'whirlwind';

function hasRestrained(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    return Array.isArray(stored) && stored.some(c => String(c).toLowerCase() === 'restrained');
}

function resolveVictimMaxHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0);
    return Number(csCreature.maxHp ?? 0);
}

function resolveVictimCurrentHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0);
    return Number(csCreature.currentHp ?? csCreature.hit_points?.current ?? 0);
}

// Untyped HP loss (infernalWoundService bleed-tick shape): PC → runtime
// currentHitPoints; monster → detached cs copy persisted through the
// serialized write queue.
async function applyUntypedThunderHpLoss(cs, csCreature, activeName, newHp, campaignName) {
    if (csCreature.type === 'player') {
        await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
        return;
    }
    const detached = cloneDeep(cs);
    const target = (detached.creatures || []).find(c => c.name === activeName);
    if (!target) return;
    target.currentHp = newHp;
    if (target.hit_points && typeof target.hit_points === 'object') {
        target.hit_points.current = newHp;
    }
    setCombatSummaryCache(detached, campaignName);
    storage.set('combatSummary', detached, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

// Turn-start tick (turnStartEffects pre-playerStats seam — PC AND monster
// victims). Gated on the whirlwind te AND Restrained: a creature inside the
// zone that saved is unaffected (containment marker only), and a Restrained
// creature freed by a repeat save takes no further tick.
export async function applyWhirlwindTurnStart(activeName, campaignName) {
    if (!activeName) return;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const tes = storedEffects.filter(te => te && te.effect === WHIRLWIND_TE && te.target === activeName);
    if (tes.length === 0) return;
    if (!hasRestrained(activeName, campaignName)) return;

    const die = String(tes[0].recurringDie || '6d6').toLowerCase();
    const result = rollExpression(die);
    const damage = result ? Number(result.total) : 0;
    if (!(damage > 0)) return;

    const cs = await loadCombatSummary(campaignName);
    if (!cs) return;
    const csCreature = (cs.creatures || []).find(c => c.name === activeName);
    if (!csCreature) return;

    const currentHp = resolveVictimCurrentHp(csCreature, activeName, campaignName);
    if (!(currentHp > 0)) return;
    const newHp = Math.max(0, currentHp - damage);

    await applyUntypedThunderHpLoss(cs, csCreature, activeName, newHp, campaignName);

    const source = tes[0].source || 'the whirlwind';
    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: activeName,
        delta: -damage,
        currentHp: newHp,
        maxHp: resolveVictimMaxHp(csCreature, activeName, campaignName),
        isHealing: false,
        isUnconscious: newHp <= 0,
        note: `Whirlwind turn-start thunder ${damage} (${die}) from ${source} — Restrained in the whirlwind; repeats the save at turn end.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[whirlwindService:turn-start-tick]', e); });

    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'whirlwind_turn_start_tick',
        characterName: activeName,
        sourceName: source,
        abilityName: 'Create Whirlwind',
        description: `${activeName} is Restrained in ${source}'s whirlwind — takes ${damage} Thunder damage (${die}) at the start of its turn (turn-end repeat save still to come; zone concentration, 20-ft/turn movement and the once-per-turn save latch are GM-enforced).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[whirlwindService:tick-log]', e); });
}
