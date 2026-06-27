import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';

export function getCarryingCapacity(playerStats) {
    const str = playerStats.abilities.find((a) => a.name === 'Strength');
    const strScore = str?.totalScore || 10;
    let capacity = strScore * 15;
    const sizeMultiplier = playerStats.sizeMultiplier || 1;
    return capacity * sizeMultiplier;
}

export function applyMaxHpPassives(playerStats, hitPoints) {
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'max_hp_increase') {
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
