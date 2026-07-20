import { buildAttackInfo } from './automationInfoBuilder.js'

export { buildAttackInfo } from './automationInfoBuilder.js'
export { evaluateAutoExpression, resolveDiceExpression } from './automationExpressions.js'
export { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
export { collectSaveModifiers } from './automationModifiers.js'
export { getConditionImmunities, getConditionalImmunities, playerIsImmuneToCondition, hasSelfRestoration } from './automationImmunities.js'
export { getPassiveBuffs, collectWeaponMastery, resolveHealingBonuses, resolveHealingBonusesWithDetails, hasHealingMaximization, hasRerollHealingOnes, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, hasIgnoreResistance, hasMinDamage, hasTruesight, hasFastWrestler, hasGreatWeaponFighting, hasTwoWeaponFighting, hasSomaticComponentWaiver, hasNaturallyStealthy, hasInterception, hasProtection, hasThrownWeaponFighting, hasBlessedWarrior, applyGreatWeaponFightingToDamage } from './automationPassives.js'

export function hasAutomation(feature) {
    return !!(feature?.automation)
}

const INTERACTIVE_HANDLER_TYPES = new Set([
    'teleport',
    'signature_spells',
    'spell_mastery',
    'combat_superiority',
    'weapon_kind_mastery',
    'weapon_mastery_choice',
    'tactical_mind',
    'concentration_bonus_attack',
    'font_of_inspiration',
    'defensive_tactics',
    'hunter_prey',
    'resource_pool',
    'natural_recovery',
    'circle_of_the_land_spells',
    'animal_aspect',
    'stride_of_the_elements',
    'elemental_epitome',
    'destructive_stride',
    'combat_stance',
    'damage_type_choice',
    'wild_magic_surge',
    'wild_magic_tamed',
    'feats_of_chaos',
    'initiative_action',
    'quivering_palm',
    'magical_cunning',
]);

const INTERACTIVE_PASSIVE_EFFECTS = new Set([
    'abjuration_savant',
    'divination_savant',
    'evocation_savant',
    'illusion_savant',
    'persistent_rage',
    'superior_defense',
]);

export function isInteractiveAutomation(feature) {
    if (!feature?.automation) return false;
    const auto = Array.isArray(feature.automation) ? feature.automation[0] : feature.automation;
    if (auto.type === 'passive_rule') {
        return auto.effect && INTERACTIVE_PASSIVE_EFFECTS.has(auto.effect);
    }
    return INTERACTIVE_HANDLER_TYPES.has(auto.type);
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

export function getAllSaveProficiencies(features, playerStats) {
    const allSaves = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
    if (!features) return allSaves
    const result = new Set()
    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'auto_reroll' && auto.target === 'saving_throw') {
                for (const save of allSaves) {
                    result.add(save)
                }
            }
            if (auto.type === 'save_proficiency') {
                const saveName = auto.saveType || ''
                const fallbackTypes = auto.fallbackTypes || []
                if (saveName) {
                    // Normalize: capitalize first letter, lowercase rest
                    const normalizedSave = saveName.charAt(0).toUpperCase() + saveName.slice(1).toLowerCase()
                    // Check if character already has proficiency in this save
                    const classSaves = playerStats?.class?.saving_throw_proficiencies || []
                    const hasSave = result.has(normalizedSave) || classSaves.includes(normalizedSave)
                    if (hasSave) {
                        // Use fallback types in order
                        for (const fallback of fallbackTypes) {
                            const normalizedFallback = fallback.charAt(0).toUpperCase() + fallback.slice(1).toLowerCase()
                            const hasFallback = result.has(normalizedFallback) || classSaves.includes(normalizedFallback)
                            if (!hasFallback) {
                                result.add(normalizedFallback)
                                break
                            }
                        }
                    } else {
                        result.add(normalizedSave)
                    }
                }
            }
        }
    })
    return Array.from(result)
}
