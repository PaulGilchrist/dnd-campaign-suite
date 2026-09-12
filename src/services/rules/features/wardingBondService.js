import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../rules/combat/rangeCheck.js';

function endWardingBond(targetName, casterName, campaignName, reason) {
    const rawTargetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetBuffs = Array.isArray(rawTargetBuffs) ? rawTargetBuffs : [];
    setRuntimeValue(targetName, 'activeBuffs', targetBuffs.filter(b => b.effect !== 'warding_bond'), campaignName);
    const rawCasterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterBuffs = Array.isArray(rawCasterBuffs) ? rawCasterBuffs : [];
    setRuntimeValue(casterName, 'activeBuffs', casterBuffs.filter(b => b.effect !== 'warding_bond'), campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Warding Bond',
        description: `Warding Bond ends — ${reason}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[wardingBond] Break log error:', e); });
}

function shareWardingBondDamage({ casterName, casterCreature, casterIsPlayer, casterHp, wardDamage, creature, campaignName }) {
    const sharedDamage = wardDamage;
    const oldHp = casterHp;
    const newHp = Math.max(0, casterHp - sharedDamage);
    if (casterIsPlayer) {
        setRuntimeValue(casterName, 'currentHitPoints', newHp, campaignName);
    } else {
        casterCreature.currentHp = newHp;
    }
    const casterMaxHp = casterIsPlayer
        ? getRuntimeValue(casterName, 'maxHitPoints', campaignName)
        : (casterCreature.maxHp || 10);
    const concentration = casterIsPlayer
        ? getRuntimeValue(casterName, 'concentration', campaignName)
        : casterCreature.concentration;
    addEntry(campaignName, {
        type: 'hp_change',
        targetName: casterName,
        delta: -(oldHp - newHp),
        currentHp: newHp,
        maxHp: casterMaxHp,
        isHealing: false,
        isUnconscious: newHp <= 0,
        abilityName: 'Warding Bond',
    }).catch((e) => { console.error("[wardingBond] Error:", e); });
    if (concentration && sharedDamage > 0) {
        concentration.dc = Math.max(10, Math.floor(sharedDamage / 2));
    }
    // RAW: the bond ends when the caster drops to 0 hit points.
    if (newHp <= 0) {
        endWardingBond(creature.name, casterName, campaignName, `${casterName} dropped to 0 hit points`);
    }
}

export function applyWardingBond(creature, combatSummary, campaignName, wardDamage) {
    const targetBondSource = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBondSource) ? targetBondSource : [];
    const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
    if (!wardingBondBuff || !wardingBondBuff.sourceCharacter || wardingBondBuff.sourceCharacter === creature.name) {
        return;
    }

    const casterName = wardingBondBuff.sourceCharacter;
    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    const targetCreature = combatSummary.creatures.find(c => c.name === creature.name);
    const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
    // Separation beyond 60 ft ends the bond (gridless distance is lenient — null stays in range).
    if (distance != null && !isDistanceInRange(distance, 60)) {
        endWardingBond(creature.name, casterName, campaignName, `${creature.name} separated from ${casterName} by more than 60 feet`);
        return;
    }
    if (!isDistanceInRange(distance, 60)) {
        return;
    }

    const casterIsPlayer = !casterCreature || casterCreature.type === 'player' || typeof casterCreature.currentHp === 'undefined';
    const casterHp = casterIsPlayer
        ? getRuntimeValue(casterName, 'currentHitPoints', campaignName)
        : casterCreature.currentHp;
    if (casterHp > 0) {
        shareWardingBondDamage({ casterName, casterCreature, casterIsPlayer, casterHp, wardDamage, creature, combatSummary, campaignName });
    }
}
