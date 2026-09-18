import { cloneDeep } from 'lodash';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { registerTargetEffect, getActiveTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../effects/expirationQueue.js';
import storage from '../../ui/storage.js';

// MA-0367: Bearded Devil Infernal Glaive — failed DC 12 CON save (attack hit,
// target without an existing wound) inflicts the INFERNAL WOUND: the target
// loses 1d10 Hit Points at the start of each of its turns. The wound closes
// after 1 minute (CLA-334 minutes×10 = ONE rounds:10 remove_target_effect
// clock, MA-0102/MA-0073 recipe), after ANY Hit Points are restored to the
// target (RAW says "a spell restores Hit Points"; any-heal implemented — the
// spell-only nuance is the documented residual), or after a DC 12 Wisdom
// (Medicine) action (GM-advisory §7 — removed via the removable badge).
// Damage is untyped: computeDamageAfterResistances throws on empty damageTypes,
// so the tick lands through the direct HP-write shape grapple_damage uses.

const WOUND_TE = 'infernal_wound';
const PENDING_KEY = 'pendingExpirations';

function woundFor(campaignName, targetName) {
    return getActiveTargetEffect(campaignName, targetName, WOUND_TE);
}

function stripWoundTe(campaignName, targetName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === WOUND_TE && te.target === targetName));
    if (filtered.length === effects.length) return false;
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    return true;
}

// Cancel every pending remove_target_effect clock this attacker (or any store)
// holds for this target's wound — heal-closes-the-wound must stop the 1-minute
// clock from firing later against an already-stripped te (expireForTarget scan
// shape, expirationQueue.js).
async function cancelWoundClocks(campaignName, targetName) {
    for (const key of getAllStoreKeys()) {
        if (typeof key !== 'string') continue;
        const list = getRuntimeValue(key, PENDING_KEY, campaignName);
        if (!Array.isArray(list) || list.length === 0) continue;
        const filtered = list.filter(item =>
            !(item.target === targetName && Array.isArray(item.effects) &&
                item.effects.some(ef => ef.type === 'remove_target_effect' && ef.effectKey === WOUND_TE))
        );
        if (filtered.length !== list.length) {
            await setRuntimeValue(key, PENDING_KEY, filtered, campaignName, true);
        }
    }
}

// Failed-save grant (MA-0073 grant shape): RAW only inflicts the wound on a
// creature that "doesn't already have an infernal wound" — a re-fire against an
// already-wounded target records NO second wound (no double bleed, no clock
// refresh), only an advisory log. te + ONE rounds:10 clock + named grant log.
export async function grantInfernalWound({ campaignName, attackerName, targetName, actionName, bleedDie }) {
    const die = String(bleedDie || '1d10').toLowerCase();
    const label = actionName || 'Infernal Glaive';
    if (woundFor(campaignName, targetName)) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'infernal_wound_refused',
            characterName: targetName,
            sourceName: attackerName,
            abilityName: label,
            description: `${targetName} failed ${attackerName}'s ${label} save but already has an Infernal Wound — RAW inflicts no second wound (the recurring 1d10 bleed continues under the original clock).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[infernalWoundService:refused]', e); });
        return { granted: false, alreadyWounded: true };
    }
    registerTargetEffect(campaignName, targetName, WOUND_TE, attackerName, {
        duration: 'until_1_minute',
        bleedDie: die,
        actionName: label,
    });
    addExpiration({
        attackerName,
        targetName,
        campaignName,
        rounds: 10,
        effects: [{ type: 'remove_target_effect', effectKey: WOUND_TE, source: attackerName, target: targetName }],
    });
    const granted = woundFor(campaignName, targetName);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'infernal_wound_granted',
        characterName: targetName,
        sourceName: attackerName,
        abilityName: label,
        description: `${targetName} failed ${attackerName}'s ${label} save (DC 12) — Infernal Wound: loses ${die} Hit Points at the start of each of its turns (10-round clock = 1 minute). Closes on any healing or a DC 12 Wisdom (Medicine) action (GM-enforced — badge ×).${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[infernalWoundService:granted]', e); });
    return { granted: true, alreadyWounded: false };
}

function resolveVictimMaxHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0);
    return Number(csCreature.maxHp ?? 0);
}

function resolveVictimCurrentHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0);
    return Number(csCreature.currentHp ?? csCreature.hit_points?.current ?? 0);
}

// Untyped HP loss for the bleed tick (computeDamageAfterResistances throws on
// empty damageTypes): PC → runtime currentHitPoints; monster → detached cs copy
// persisted through the serialized write queue (grapple_damage / applyHolyNimbus
// shapes, §2 HP truth).
async function applyUntypedWoundHpLoss(cs, csCreature, activeName, newHp, campaignName) {
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

// Start-of-turn bleed tick (turnStartEffects pre-playerStats seam — works for
// PC AND monster victims, clearResistanceUsedThisTurnFlags te-scan shape +
// grapple_damage/applyHolyNimbusDamage direct-HP + cs-persist shapes).
export async function applyInfernalWoundBleedTurnStart(activeName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const wounds = storedEffects.filter(te => te && te.effect === WOUND_TE && te.target === activeName);
    if (wounds.length === 0) return;

    const result = rollExpression(String(wounds[0].bleedDie || '1d10').toLowerCase());
    const damage = result ? Number(result.total) : 0;
    if (!(damage > 0)) return;

    const cs = await loadCombatSummary(campaignName);
    if (!cs) return;
    const csCreature = (cs.creatures || []).find(c => c.name === activeName);
    if (!csCreature) return;

    const currentHp = resolveVictimCurrentHp(csCreature, activeName, campaignName);
    if (!(currentHp > 0)) return;
    const newHp = Math.max(0, currentHp - damage);

    await applyUntypedWoundHpLoss(cs, csCreature, activeName, newHp, campaignName);

    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: activeName,
        delta: -damage,
        currentHp: newHp,
        maxHp: resolveVictimMaxHp(csCreature, activeName, campaignName),
        isHealing: false,
        isUnconscious: newHp <= 0,
        note: `Infernal Wound (turn-start bleed ${damage} [${String(wounds[0].bleedDie || '1d10')}], ${wounds[0].source || 'the devil'})`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[infernalWoundService:bleed-tick]', e); });
}

// Close conditions: ANY HP restored removes the wound + cancels its clock
// (MA-0016 heal choke point — applyHealingToTarget + applyHealingDirectly).
// Callers MUST gate on actual healed amount > 0.
export async function removeInfernalWoundOnHeal(targetName, campaignName) {
    if (!woundFor(campaignName, targetName)) return false;
    stripWoundTe(campaignName, targetName);
    await cancelWoundClocks(campaignName, targetName);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'infernal_wound_closed',
        characterName: targetName,
        abilityName: 'Infernal Wound',
        description: `${targetName} regained Hit Points — the Infernal Wound closes and its 1-minute clock is cancelled (RAW: "after a spell restores Hit Points"; any-heal implemented — spell-only nuance GM-adjudicated).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[infernalWoundService:heal-closed]', e); });
    return true;
}

// Save-reroll close (MA-0367 dc_success:"full" rows): a failed save that was
// rerolled into a success never should have taken the wound — strip te + clock
// (the full attack damage stays, the save gated only the wound).
export async function cancelInfernalWoundAfterSaveSuccess(targetName, campaignName) {
    if (!woundFor(campaignName, targetName)) return false;
    stripWoundTe(campaignName, targetName);
    await cancelWoundClocks(campaignName, targetName);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'infernal_wound_closed',
        characterName: targetName,
        abilityName: 'Infernal Wound',
        description: `${targetName}'s save reroll succeeded — the Infernal Wound is cancelled (this save determines only the wound; the attack damage stands in full).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[infernalWoundService:reroll-closed]', e); });
    return true;
}
