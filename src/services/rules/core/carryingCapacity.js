import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';

export function getCarryingCapacity(playerStats) {
    const str = playerStats.abilities.find((a) => a.name === 'Strength');
    const strScore = str?.totalScore || 10;
    let capacity = strScore * 15;
    const sizeMultiplier = playerStats.sizeMultiplier || 1;
    return capacity * sizeMultiplier;
}

export function applyMaxHpPassives(playerStats, hitPoints) {
    // Apex guard (#204-class half-guarded apex): tolerant-quiet posture. This file's
    // declared neutral is pass-through of hitPoints (`|| []` below, pinned by
    // applyMaxHpPassives({}, 100) === 100); absent automation ≡ absent passives ≡
    // absent playerStats — all fold to "no known passives". Mirrors hasPassiveEffect
    // (automationPassives.js:19) and greatWeaponFightingApplies (greatWeaponFighting.js:42).
    // Consumers (abilityCalc(2024).getHitPoints) deref playerStats upstream — pre-gated.
    if (!playerStats) return hitPoints;
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        // FT-012: Fortified Health (2024 Epic Boon) carries amount:40 under its
        // own effect key — fold it identically to max_hp_increase on both rulesets.
        if (passive.type === 'passive_rule' && (passive.effect === 'max_hp_increase' || passive.effect === 'fortified_health')) {
            if (passive.amount) {
                hitPoints += passive.amount;
            } else if (passive.bonusExpression) {
                const bonus = evaluateAutoExpression(passive.bonusExpression, playerStats);
                if (typeof bonus === 'number' && !isNaN(bonus)) {
                    hitPoints += bonus;
                }
            }
        }
    }
    return hitPoints;
}
