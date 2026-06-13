import { getSaveDc, resolveUses, resolveDiceExpression, resolveScaling } from '../automationExpressions.js'

export const saveHandlers = {
    'save_attack': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const scaling = resolveScaling(playerStats, auto.scaling)
        const rawDamage = scaling?.damage || auto.damage || ''
        const damage = resolveDiceExpression(rawDamage, playerStats)
        let uses = resolveUses(playerStats, auto.uses)
        if (auto.resourceCost === 'wild_shape') {
            uses = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0
        }
        const saveDc = auto.saveDc === 'ability'
            ? getSaveDc(playerStats, auto.saveAbility || 'CON', prof)
            : auto.saveDc || 10
        let healExpression = auto.healExpression || ''
        if (auto.healScaling) {
            const healScaling = resolveScaling(playerStats, auto.healScaling)
            if (healScaling?.healExpression) {
                healExpression = healScaling.healExpression
            }
        }
        if (healExpression) {
            healExpression = resolveDiceExpression(healExpression, playerStats)
        }
        return {
            type: 'save_attack',
            name: feature.name,
            action: auto.action || 'action',
            damage,
            damageType: auto.damageType || '',
            saveType: auto.saveType || 'DEX',
            saveDc,
            saveAbility: auto.saveAbility || 'CON',
            shape: auto.shape || '',
            range: auto.range || '',
            conditionInflicted: auto.conditionInflicted || null,
            duration: auto.duration || '',
            uses,
            usesMax: uses,
            recharge: auto.recharge || 'long_rest',
            resourceCost: auto.resourceCost || '',
            hasOptions: !!auto.hasOptions,
            options: auto.options || [],
            optionDetails: auto.optionDetails || {},
            healExpression,
            dcSuccess: auto.dcSuccess || null,
            hasAutomation: true
        }
    },

    'save_only': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'save_only',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, 'CON', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: auto.conditionInflicted || null,
            duration: auto.duration || '',
            successEffect: auto.successEffect || null,
            hasAutomation: true,
        }
    }
}
