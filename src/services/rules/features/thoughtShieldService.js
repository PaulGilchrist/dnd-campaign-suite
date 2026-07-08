import { addEntry } from '../../ui/logService.js';

export function applyThoughtShield(creature, attackerName, playerComputed, damageTypes, combatSummary, campaignName, wardDamage) {
    const hasThoughtShield = playerComputed?.characterAdvancement?.some(f => f.name === 'Thought Shield');
    if (hasThoughtShield && damageTypes?.some(d => d.toLowerCase() === 'psychic')) {
        const attackerCreature = combatSummary.creatures.find(c => c.name === attackerName);
        if (attackerCreature && attackerCreature.currentHp > 0) {
            const reflectedDamage = wardDamage;
            attackerCreature.currentHp = Math.max(0, attackerCreature.currentHp - reflectedDamage);
            addEntry(campaignName, {
                type: 'hp_change',
                targetName: attackerName,
                delta: -reflectedDamage,
                currentHp: attackerCreature.currentHp,
                maxHp: attackerCreature.maxHp,
                isHealing: false,
                isUnconscious: attackerCreature.currentHp <= 0,
                abilityName: 'Thought Shield',
            }).catch((e) => { console.error("[thoughtShield] Error:", e); });
            if (attackerCreature.concentration && reflectedDamage > 0) {
                attackerCreature.concentration.dc = Math.max(10, Math.floor(reflectedDamage / 2));
            }
        }
    }
}
