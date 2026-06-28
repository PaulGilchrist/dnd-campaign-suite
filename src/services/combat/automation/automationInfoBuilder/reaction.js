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
        let saveDc = auto.saveDc
        if (auto.saveDcExpression && !saveDc) {
            saveDc = evaluateAutoExpression(auto.saveDcExpression, playerStats)
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
                : saveDc || null,
            saveAbility: auto.saveAbility || 'WIS',
            alsoInflicts: auto.alsoInflicts || null,
            resourceCost: auto.resourceCost || null,
            range: auto.range || '5_ft',
            casting_time: auto.casting_time || '1 reaction',
            effect: auto.effect || null,
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
    },

    'searing_vengeance': (feature, _playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses ?? 1
        return {
            type: 'searing_vengeance',
            name: feature.name,
            healExpression: auto.healExpression || '',
            damageExpression: auto.damageExpression || '',
            damageType: auto.damageType || 'Radiant',
            range: auto.range || '30_ft',
            condition: auto.condition || 'blinded',
            conditionDuration: auto.conditionDuration || 'until_end_of_current_turn',
            trigger: auto.trigger || 'death_save_by_ally_or_self',
            allyRange: auto.allyRange || '60_ft',
            uses: auto.uses ?? 1,
            usesMax,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'illusory_self': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'illusory_self',
            name: feature.name,
            trigger: auto.trigger || 'attack_hit',
            uses: auto.uses || 1,
            recharge: auto.recharge || 'short_or_long_rest',
            spellSlotRestore: auto.spellSlotRestore || null,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'reaction_counterspell': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0
        return {
            type: 'reaction_counterspell',
            name: feature.name,
            trigger: auto.trigger || 'creature_casting_spell',
            saveType: auto.saveType || 'CON',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            saveBonus: 8 + chaBonus + prof,
            range: auto.range || '60 ft',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'lucky_point': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'lucky_point',
            name: feature.name,
            effect: auto.effect || 'advantage',
            target: auto.target || 'd20',
            cost: auto.cost || 1,
            casting_time: auto.casting_time || 'reaction',
            hasAutomation: true
        }
    },

    'reaction_spell': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'reaction_spell',
            name: feature.name,
            trigger: auto.trigger || '',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'sentinel_guardian': (feature, playerStats) => {
        const auto = feature.automation
        const meleeAttacks = (playerStats.attacks || []).filter(
            a => a.type === 'Action' && a.range === 'melee'
        )
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0]
        return {
            type: 'sentinel_guardian',
            name: feature.name,
            trigger: auto.trigger || 'creature_disengages_or_hits_other_within_5ft',
            range: auto.range || '5_ft',
            oaType: auto.oaType || 'any_attack_miss_or_disengage',
            casting_time: auto.casting_time || '1 reaction',
            attack: attack || null,
            hasAutomation: true
        }
    },

    'interception': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        return {
            type: 'interception',
            name: feature.name,
            trigger: auto.trigger || 'ally_within_5ft_attacked',
            range: auto.range || '5_ft',
            damageExpression: auto.damageExpression || '1d10',
            damageType: auto.damageType || '',
            damageBonusExpression: auto.damageBonusExpression || 'proficiency_bonus',
            damageBonus: prof,
            requiresShield: !!auto.requiresShield,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'protection': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'protection',
            name: feature.name,
            trigger: auto.trigger || 'ally_within_5ft_attacked',
            range: auto.range || '5_ft',
            requiresShield: true,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    }
}
