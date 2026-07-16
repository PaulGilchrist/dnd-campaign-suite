import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../rules/combat/rangeCheck.js';

export function applyWardingBond(creature, combatSummary, campaignName, wardDamage) {
    const targetBondSource = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBondSource) ? targetBondSource : [];
    const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
    if (wardingBondBuff && wardingBondBuff.sourceCharacter && wardingBondBuff.sourceCharacter !== creature.name) {
        const casterName = wardingBondBuff.sourceCharacter;
        const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
        const targetCreature = combatSummary.creatures.find(c => c.name === creature.name);
        const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
        if (isDistanceInRange(distance, 60)) {
            if (casterCreature && casterCreature.currentHp > 0) {
                const sharedDamage = wardDamage;
                casterCreature.currentHp = Math.max(0, casterCreature.currentHp - sharedDamage);
                addEntry(campaignName, {
                    type: 'hp_change',
                    targetName: casterName,
                    delta: -sharedDamage,
                    currentHp: casterCreature.currentHp,
                    maxHp: casterCreature.maxHp,
                    isHealing: false,
                    isUnconscious: casterCreature.currentHp <= 0,
                    abilityName: 'Warding Bond',
                }).catch((e) => { console.error("[wardingBond] Error:", e); });
                if (casterCreature.concentration && sharedDamage > 0) {
                    casterCreature.concentration.dc = Math.max(10, Math.floor(sharedDamage / 2));
                }
            }
        }
    }
}
