import { isProtectionFromEvilAndGoodActive, isCreatureWarded } from '../automation/handlers/protectionFromEvilAndGoodHandler.js';

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

export function playerIsImmuneToCondition({
    conditionKey,
    playerStats,
    getRuntimeValue,
    campaignName,
    sourceCreatureType,
}) {
    if (!conditionKey || !playerStats) return false

    const lowerCondition = String(conditionKey).toLowerCase()

    // Protection from Evil and Good: if target has the spell active, they are immune
    // to Charmed and Frightened conditions from warded creature types
    if (isProtectionFromEvilAndGoodActive(playerStats.name, campaignName)) {
        if ((lowerCondition === 'charmed' || lowerCondition === 'frightened') && sourceCreatureType) {
            if (isCreatureWarded(sourceCreatureType, playerStats.name, campaignName)) {
                return true
            }
        }
        // Also prevent possession from warded creature types
        // Possession is tracked as a special state, not a condition — handled separately
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
            if (auto.type === 'passive_immunity') {
                const immunityStr = String(auto.conditionImmunity || '').toLowerCase()
                const tokens = immunityStr.split(/[\s,]+/).filter(Boolean)
                if (tokens.some(t => t === lowerCondition || immunityStr.includes(lowerCondition))) {
                    return true
                }

                if (auto.damageResistance && auto.damageResistance.length > 0) {
                    const lowerDamage = lowerCondition.replace(/^damage:/, '')
                    if (lowerDamage && auto.damageResistance.some(d => d.toLowerCase() === lowerDamage)) {
                        return true
                    }
                }
            }

            if (auto.type === 'land_resistance' && auto.conditionImmunity) {
                const immunityStr = String(auto.conditionImmunity || '').toLowerCase()
                const tokens = immunityStr.split(/[\s,]+/).filter(Boolean)
                if (tokens.some(t => t === lowerCondition || immunityStr.includes(lowerCondition))) {
                    return true
                }
            }

            if (auto.type === 'condition_immunity_while_active') {
                const immunities = (auto.immunities || []).map(i => String(i).toLowerCase())
                if (!immunities.includes(lowerCondition)) continue

                const requiresActive = auto.requiresActive || ''
                if (!requiresActive) return true

                const activeBuffs = (getRuntimeValue && campaignName)
                    ? (getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [])
                    : []
                const isActive = Array.isArray(activeBuffs) && activeBuffs.some(
                    b => String(b.name).toLowerCase() === requiresActive.toLowerCase()
                )
                if (isActive) return true
            }
        }
    }

    // Check active buffs for temporary condition immunity (e.g., Feign Death)
    if (getRuntimeValue && campaignName) {
        const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
        if (Array.isArray(activeBuffs)) {
            for (const buff of activeBuffs) {
                if (buff.conditionImmunity && Array.isArray(buff.conditionImmunity)) {
                    if (buff.conditionImmunity.some(c => String(c).toLowerCase() === lowerCondition)) {
                        return true;
                    }
                }
            }
        }
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
