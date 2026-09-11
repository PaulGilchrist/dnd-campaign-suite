import { isProtectionFromEvilAndGoodActive, isCreatureWarded } from '../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';

export function getConditionImmunities(features) {
    const immunities = []
    if (!features) return immunities

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'passive_immunity') {
                immunities.push(auto.conditionImmunity)
                if (auto.damageResistance && auto.damageResistance.length > 0) {
                    immunities.push(...auto.damageResistance.map(d => `damage:${d}`))
                }
            }
            if (auto.type === 'condition_immunity_while_active') {
                immunities.push(...auto.immunities)
            }
            if (auto.type === 'land_resistance' && auto.conditionImmunity) {
                immunities.push(auto.conditionImmunity)
            }
        }
    })

    return immunities
}

export function getConditionalImmunities(features) {
    const result = []
    if (!features) return result

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'condition_immunity_while_active') {
                result.push({
                    name: feature.name,
                    immunities: auto.immunities || [],
                    requiresActive: auto.requiresActive || '',
                })
            }
        }
    })

    return result
}

// Protection from Evil and Good: if target has the spell active, they are immune
// to Charmed and Frightened conditions from warded creature types.
// Also prevents possession from warded creature types — possession is tracked as a
// special state, not a condition — handled separately.
function isWardedConditionImmunity(lowerCondition, playerStats, campaignName, sourceCreatureType) {
    if (!isProtectionFromEvilAndGoodActive(playerStats.name, campaignName)) return false
    const isWardableCondition = lowerCondition === 'charmed' || lowerCondition === 'frightened'
    if (!isWardableCondition || !sourceCreatureType) return false
    return isCreatureWarded(sourceCreatureType, playerStats.name, campaignName)
}

function immunityStringMatches(immunityStr, lowerCondition) {
    const tokens = immunityStr.split(/[\s,]+/).filter(Boolean)
    return tokens.some(t => t === lowerCondition || immunityStr.includes(lowerCondition))
}

function passiveImmunityMatches(auto, lowerCondition) {
    if (immunityStringMatches(String(auto.conditionImmunity || '').toLowerCase(), lowerCondition)) {
        return true
    }
    if (auto.damageResistance && auto.damageResistance.length > 0) {
        const lowerDamage = lowerCondition.replace(/^damage:/, '')
        if (lowerDamage && auto.damageResistance.some(d => d.toLowerCase() === lowerDamage)) {
            return true
        }
    }
    return false
}

function conditionalImmunityMatches(auto, lowerCondition, playerStats, getRuntimeValue, campaignName) {
    const immunities = (auto.immunities || []).map(i => String(i).toLowerCase())
    if (!immunities.includes(lowerCondition)) return false

    const requiresActive = auto.requiresActive || ''
    if (!requiresActive) return true

    const activeBuffs = (getRuntimeValue && campaignName)
        ? (getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [])
        : []
    return Array.isArray(activeBuffs) && activeBuffs.some(
        b => String(b.name).toLowerCase() === requiresActive.toLowerCase()
    )
}

function automationGrantsImmunity(auto, lowerCondition, playerStats, getRuntimeValue, campaignName) {
    if (auto.type === 'passive_immunity' && passiveImmunityMatches(auto, lowerCondition)) {
        return true
    }
    if (auto.type === 'land_resistance' && auto.conditionImmunity) {
        if (immunityStringMatches(String(auto.conditionImmunity || '').toLowerCase(), lowerCondition)) {
            return true
        }
    }
    if (auto.type === 'condition_immunity_while_active') {
        if (conditionalImmunityMatches(auto, lowerCondition, playerStats, getRuntimeValue, campaignName)) {
            return true
        }
    }
    return false
}

// Check active buffs for temporary condition immunity (e.g., Feign Death)
function activeBuffGrantsImmunity(playerStats, lowerCondition, getRuntimeValue, campaignName) {
    if (!getRuntimeValue || !campaignName) return false
    const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || []
    if (!Array.isArray(activeBuffs)) return false
    return activeBuffs.some(buff =>
        buff.conditionImmunity && Array.isArray(buff.conditionImmunity) &&
        buff.conditionImmunity.some(c => String(c).toLowerCase() === lowerCondition)
    )
}

export function playerIsImmuneToCondition({
    conditionKey,
    playerStats,
    getRuntimeValue,
    campaignName,
    sourceCreatureType,
}) {
    if (!conditionKey || !playerStats) return false

    const lowerCondition = String(conditionKey).toLowerCase()

    if (isWardedConditionImmunity(lowerCondition, playerStats, campaignName, sourceCreatureType)) {
        return true
    }

    // Check playerStats.immunities array (race immunities like "Magical Sleep")
    if (playerStats.immunities && Array.isArray(playerStats.immunities)) {
        if (playerStats.immunities.some(imm => String(imm).toLowerCase() === lowerCondition)) {
            return true
        }
    }

    const allFeatures = playerStats.allFeatures || []

    for (const feature of allFeatures) {
        if (!feature?.automation) continue
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (automationGrantsImmunity(auto, lowerCondition, playerStats, getRuntimeValue, campaignName)) {
                return true
            }
        }
    }

    if (activeBuffGrantsImmunity(playerStats, lowerCondition, getRuntimeValue, campaignName)) {
        return true
    }

    return false
}

export function hasSelfRestoration(playerStats) {
    if (!playerStats) return false
    const allFeatures = playerStats.allFeatures || []
    for (const feature of allFeatures) {
        if (!feature?.automation) continue
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'passive_rule' && auto.effect === 'end_of_turn_condition_removal') {
                return true
            }
        }
    }
    return false
}
