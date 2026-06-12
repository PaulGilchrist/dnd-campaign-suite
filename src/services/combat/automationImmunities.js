export function getConditionImmunities(features) {
    const immunities = []
    if (!features) return immunities

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'passive_immunity') {
                immunities.push(auto.conditionImmunity)
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
}) {
    if (!conditionKey || !playerStats) return false

    const allFeatures = playerStats.allFeatures || []
    const lowerCondition = String(conditionKey).toLowerCase()

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

    return false
}
