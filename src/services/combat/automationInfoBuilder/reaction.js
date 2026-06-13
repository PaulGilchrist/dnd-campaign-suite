import { evaluateAutoExpression, getSaveDc } from '../automationExpressions.js'

export const reactionHandlers = {
    'reaction_bonus': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'reaction_bonus',
            name: feature.name,
            trigger: auto.trigger || '',
            bonusExpression: auto.bonusExpression || '',
            condition: auto.condition || '',
            selfMovement: auto.selfMovement || '',
            allyMovement: auto.allyMovement || '',
            allyRange: auto.allyRange || '30 ft',
            noOAs: !!auto.noOAs,
            resourceCost: auto.resourceCost || '',
            effect: auto.effect || '',
            saveType: auto.saveType || '',
            saveDc: auto.saveDc || '',
            duration: auto.duration || '',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'reaction_damage': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        let resolvedExpr = auto.damageExpression || ''
        if (auto.scaling) {
            const entries = Object.entries(auto.scaling)
                .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
                .filter(e => !isNaN(e.level))
                .sort((a, b) => a.level - b.level)
            for (const entry of entries) {
                if (playerStats.level >= entry.level) {
                    resolvedExpr = entry.expr
                }
            }
        }
        return {
            type: 'reaction_damage',
            name: feature.name,
            trigger: auto.trigger || '',
            damageExpression: resolvedExpr,
            damageType: auto.damageType || '',
            saveType: auto.saveType || null,
            saveDc: auto.saveDc === 'ability'
                ? getSaveDc(playerStats, auto.saveAbility || 'WIS', prof)
                : auto.saveDc || null,
            saveAbility: auto.saveAbility || 'WIS',
            alsoInflicts: auto.alsoInflicts || null,
            resourceCost: auto.resourceCost || null,
            range: auto.range || '5_ft',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'reaction_debuff': (feature, playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses_expression
            ? evaluateAutoExpression(auto.uses_expression, playerStats)
            : 0
        return {
            type: 'reaction_debuff',
            name: feature.name,
            trigger: auto.trigger || '',
            debuffExpression: auto.debuffExpression || '',
            subtractive: !!auto.subtractive,
            effect: auto.effect || '',
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            range: auto.range || '60_ft',
            casting_time: auto.casting_time || '1 reaction',
            triggerTypes: ['attack_roll', 'damage_roll', 'ability_check'],
            hasAutomation: true
        }
    },

    'reaction_save': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'reaction_save',
            name: feature.name,
            trigger: auto.trigger || '',
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            condition: auto.condition || '',
            duration: auto.duration || '',
            range: auto.range || '120_ft',
            casting_time: auto.casting_time || '1 reaction',
            target: auto.target || 'different_creature',
            hasAutomation: true
        }
    },

    'shadowy_dodge': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'shadowy_dodge',
            name: feature.name,
            range: auto.range || '30_ft',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'glorious_defense': (feature, playerStats) => {
        const auto = feature.automation
        const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
        const acBonus = Math.max(1, chaBonus);
        const usesMax = Math.max(1, chaBonus);
        return {
            type: 'glorious_defense',
            name: feature.name,
            acBonusExpression: `Math.max(1, CHA modifier)`,
            acBonus: acBonus,
            usesMax: usesMax,
            range: auto.range || '10_ft',
            trigger: auto.trigger || '',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'beguiling_defenses': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        return {
            type: 'beguiling_defenses',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc === 'ability'
                ? getSaveDc(playerStats, auto.saveAbility || 'CHA', prof)
                : auto.saveDc || null,
            saveAbility: auto.saveAbility || 'CHA',
            damageType: auto.damageType || 'Psychic',
            uses: auto.uses || 1,
            recharge: auto.recharge || 'long_rest',
            pactMagicRecharge: auto.pactMagicRecharge || false,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    }
}
