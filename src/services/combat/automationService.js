import { buildAttackInfo } from './automationInfoBuilder.js'

export { evaluateAutoExpression } from './automationExpressions.js'
export { collectAutomationFromFeatures, processFeatureAutomation } from './automationCollector.js'
export { collectSaveModifiers } from './automationModifiers.js'
export { getConditionImmunities, getConditionalImmunities, playerIsImmuneToCondition } from './automationImmunities.js'
export { getPassiveBuffs, collectWeaponMastery, resolveHealingBonuses, hasHealingMaximization } from './automationPassives.js'

export function hasAutomation(feature) {
    return !!(feature?.automation)
}

export function getEvasionEffects(features) {
    const effects = [];
    if (!features) return effects;
    features.forEach(feature => {
        if (feature?.automation?.type === 'evasion') {
            effects.push({
                source: feature.name,
                saveType: (feature.automation.saveType || 'DEX').toUpperCase(),
                shareable: !!feature.automation.shareable,
                shareRange: feature.automation.shareRange || 0,
            });
        }
    });
    return effects;
}

export function getAutomationInfo(feature, playerStats) {
    if (!feature?.automation) return null
    return buildAttackInfo(feature, playerStats)
}
