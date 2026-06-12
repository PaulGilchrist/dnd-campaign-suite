import { buildAttackInfo } from './automationInfoBuilder.js'

export { evaluateAutoExpression } from './automationExpressions.js'
export { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
export { collectSaveModifiers } from './automationModifiers.js'
export { getConditionImmunities, getConditionalImmunities, playerIsImmuneToCondition } from './automationImmunities.js'
export { getPassiveBuffs, collectWeaponMastery, resolveHealingBonuses, hasHealingMaximization, hasTacticalShift } from './automationPassives.js'

export function hasAutomation(feature) {
    return !!(feature?.automation)
}

export function getEvasionEffects(features) {
    const effects = [];
    if (!features) return effects;
    features.forEach(feature => {
        if (!feature?.automation) return;
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation];
        for (const auto of automations) {
            if (auto.type === 'evasion') {
                effects.push({
                    source: feature.name,
                    saveType: (auto.saveType || 'DEX').toUpperCase(),
                    shareable: !!auto.shareable,
                    shareRange: auto.shareRange || 0,
                });
            }
        }
    });
    return effects;
}

export function getAutomationInfo(feature, playerStats) {
    if (!feature?.automation) return null
    const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
    for (const auto of automations) {
        const info = buildAttackInfo({ ...feature, automation: auto }, playerStats)
        if (info) return info
    }
    return null
}
