import { getAbilityModifier } from './shared/abilityLookup.js'

function resolveUses(playerStats, usesSpec) {
    if (typeof usesSpec === 'number') return usesSpec
    if (usesSpec === 'proficiency_bonus') return playerStats.proficiency || 0
    if (typeof usesSpec === 'string' && usesSpec.endsWith('_level')) {
        const className = usesSpec.replace('_level', '')
        if (playerStats.class?.name?.toLowerCase() === className) return playerStats.level
        return playerStats.class?.levels || playerStats.level || 0
    }
    return playerStats.level || 1
}

function resolveScaling(playerStats, scaling) {
    if (!scaling) return null
    let result = null
    for (const entry of scaling) {
        if (playerStats.level >= entry.level) {
            result = entry
        }
    }
    return result
}

function getSaveDc(playerStats, ability, proficiency) {
    return 8 + getAbilityModifier(playerStats.abilities, ability) + (proficiency || 0)
}

function buildAttackInfo(feature, playerStats) {
    const auto = feature.automation
    if (!auto) return null

    const prof = playerStats.proficiency || 0
    const level = playerStats.level || 1

    switch (auto.type) {
        case 'attack_rider': {
            return {
                type: 'attack_rider',
                name: feature.name,
                options: auto.options || [],
                cost: auto.cost || null,
                hasAutomation: true
            }
        }

        case 'auto_effect': {
            return {
                type: 'auto_effect',
                name: feature.name,
                trigger: auto.trigger || '',
                effect: auto.effect || '',
                value: auto.value || null,
                uses: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'auto_reroll': {
            return {
                type: 'auto_reroll',
                name: feature.name,
                target: auto.target || 'd20',
                condition: auto.condition || '',
                effect: auto.effect || 'reroll',
                hasAutomation: true
            }
        }

        case 'bonus_action_attack': {
            return {
                type: 'bonus_action_attack',
                name: feature.name,
                extraDamageExpression: auto.extraDamageExpression || '',
                resourceKey: auto.resourceKey || '',
                hasAutomation: true
            }
        }

        case 'bonus_attacks': {
            return {
                type: 'bonus_attacks',
                name: feature.name,
                attacks: auto.attacks || 2,
                attackType: auto.attackType || 'unarmed_strike',
                cost: auto.cost || null,
                trigger: auto.trigger || 'after_attack_action',
                hasAutomation: true
            }
        }

        case 'buff_ally': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            return {
                type: 'buff_ally',
                name: feature.name,
                buffExpression: auto.buffExpression || '',
                range: auto.range || '60_ft',
                action: auto.action || 'bonus_action',
                usesMax,
                usesRecharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'combat_stance': {
            return {
                type: 'combat_stance',
                name: feature.name,
                damageBonusExpression: auto.damageBonusExpression || '',
                resistanceTypes: auto.resistanceTypes || [],
                advantages: auto.advantages || [],
                duration: auto.duration || '',
                resourceKey: 'ragePoints',
                hasAutomation: true
            }
        }

        case 'conditional_advantage': {
            return {
                type: 'conditional_advantage',
                name: feature.name,
                target: auto.target || 'saving_throw',
                condition: auto.condition || '',
                effect: auto.effect || 'advantage',
                abilities: auto.abilities || [],
                hasAutomation: true
            }
        }

        case 'conditional_disadvantage': {
            return {
                type: 'conditional_disadvantage',
                name: feature.name,
                target: auto.target || 'attack_roll',
                condition: auto.condition || '',
                effect: auto.effect || 'disadvantage',
                hasAutomation: true
            }
        }

        case 'damage_aura': {
            return {
                type: 'damage_aura',
                name: feature.name,
                damageType: auto.damageType || '',
                damageExpression: auto.damageExpression || '',
                range: auto.range || '10_ft',
                duration: auto.duration || '1_minute',
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'damage_bonus': {
            return {
                type: 'damage_bonus',
                name: feature.name,
                trigger: auto.trigger || '',
                damageExpression: auto.damageExpression || '',
                damageType: auto.damageType || '',
                maxDamage: auto.maxDamage || '',
                extraVs: auto.extraVs || null,
                extraDamage: auto.extraDamage || '',
                resourceType: auto.resourceType || 'spell_slot',
                hasAutomation: true
            }
        }

        case 'damage_reduction': {
            return {
                type: 'damage_reduction',
                name: feature.name,
                reductionExpression: auto.reductionExpression || '',
                trigger: auto.trigger || '',
                reaction: auto.reaction || false,
                redirect: auto.redirect || false,
                redirectCost: auto.redirectCost || null,
                redirectDamage: auto.redirectDamage || '',
                redirectSave: auto.redirectSave || 'DEX',
                hasAutomation: true
            }
        }

        case 'extra_action': {
            return {
                type: 'extra_action',
                name: feature.name,
                uses: auto.uses || 1,
                recharge: auto.recharge || 'short_rest',
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
                hasAutomation: true
            }
        }

        case 'flurry_effect': {
            return {
                type: 'flurry_effect',
                name: feature.name,
                options: auto.options || [],
                saveType: auto.saveType || 'varies',
                saveDc: auto.saveDc || 'ability',
                trigger: auto.trigger || 'flurry_of_blows_hit',
                hasAutomation: true
            }
        }

        case 'font_of_magic': {
            return {
                type: 'font_of_magic',
                name: feature.name,
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            }
        }

        case 'free_spell': {
            return {
                type: 'free_spell',
                name: feature.name,
                spell: auto.spell || '',
                uses: auto.uses || 1,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'healing': {
            const healAmount = auto.healExpression
                ? evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
                : 0
            return {
                type: 'healing',
                name: feature.name,
                healAmount,
                healExpression: auto.healExpression || '',
                action: auto.action || 'action',
                uses: auto.uses || null,
                usesMax: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'healing_pool': {
            const pool = auto.poolExpression
                ? evaluateAutoExpression(auto.poolExpression, playerStats, prof, level)
                : 0
            return {
                type: 'healing_pool',
                name: feature.name,
                pool,
                poolExpression: auto.poolExpression || '',
                action: auto.action || 'action',
                recharge: auto.recharge || 'long_rest',
                alsoCures: auto.alsoCures || [],
                cureCost: auto.cureCost || 5,
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Pool',
                hasAutomation: true
            }
        }

        case 'initiative_action': {
            return {
                type: 'initiative_action',
                name: feature.name,
                effect: auto.effect || '',
                healExpression: auto.healExpression || '',
                trigger: auto.trigger || 'roll_initiative',
                uses: auto.uses ?? 1,
                usesMax: auto.uses ?? 1,
                recharge: auto.recharge || 'long_rest',
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
                hasAutomation: true
            }
        }

        case 'meta': {
            return {
                type: 'meta',
                name: feature.name,
                effect: auto.effect || '',
                hasAutomation: true
            }
        }

        case 'passive_buff': {
            return {
                type: 'passive_buff',
                name: feature.name,
                target: auto.target || 'allies_in_range',
                range_expression: auto.range_expression || '10_ft',
                effect: auto.effect || '',
                bonusExpression: auto.bonusExpression || '',
                conditionImmunity: auto.conditionImmunity || '',
                resistances: auto.resistances || [],
                hasAutomation: true
            }
        }

        case 'passive_immunity': {
            return {
                type: 'passive_immunity',
                name: feature.name,
                target: auto.target || 'self',
                conditionImmunity: auto.conditionImmunity || '',
                hasAutomation: true
            }
        }

        case 'passive_rule': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: auto.effect || '',
                criticalRange: auto.criticalRange || '',
                hasAutomation: true
            }
        }

        case 'reaction_bonus': {
            return {
                type: 'reaction_bonus',
                name: feature.name,
                trigger: auto.trigger || '',
                bonusExpression: auto.bonusExpression || '',
                condition: auto.condition || '',
                hasAutomation: true
            }
        }

        case 'reaction_damage': {
            return {
                type: 'reaction_damage',
                name: feature.name,
                trigger: auto.trigger || '',
                damageExpression: auto.damageExpression || '',
                range: auto.range || '5_ft',
                hasAutomation: true
            }
        }

        case 'reaction_debuff': {
            return {
                type: 'reaction_debuff',
                name: feature.name,
                trigger: auto.trigger || '',
                debuffExpression: auto.debuffExpression || '',
                range: auto.range || '60_ft',
                hasAutomation: true
            }
        }

        case 'resistance': {
            return {
                type: 'resistance',
                name: feature.name,
                damageTypes: auto.damageTypes || [],
                hasAutomation: true
            }
        }

        case 'resource_pool': {
            return {
                type: 'resource_pool',
                name: feature.name,
                resource: auto.resource || '',
                uses_expression: auto.uses_expression || '',
                recharge_short_rest: auto.recharge_short_rest || '',
                recharge_long_rest: auto.recharge_long_rest || '',
                hasAutomation: true
            }
        }

        case 'save_attack': {
            const scaling = resolveScaling(playerStats, auto.scaling)
            const damage = scaling?.damage || auto.damage || ''
            const uses = resolveUses(playerStats, auto.uses)
            const saveDc = auto.saveDc === 'ability'
                ? getSaveDc(playerStats, 'CON', prof)
                : auto.saveDc || 10
            return {
                type: 'save_attack',
                name: feature.name,
                damage,
                damageType: auto.damageType || '',
                saveType: auto.saveType || 'DEX',
                saveDc,
                shape: auto.shape || '',
                conditionInflicted: auto.conditionInflicted || null,
                duration: auto.duration || '',
                uses,
                usesMax: uses,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'save_only': {
            return {
                type: 'save_only',
                name: feature.name,
                saveType: auto.saveType || 'DEX',
                saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, 'CON', playerStats.proficiency) : auto.saveDc || 10,
                conditionInflicted: auto.conditionInflicted || null,
                duration: auto.duration || '',
                successEffect: auto.successEffect || null,
                hasAutomation: true,
            };
        }

        case 'self_healing': {
            const healAmount = auto.healExpression
                ? evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
                : 0
            return {
                type: 'self_healing',
                name: feature.name,
                healAmount,
                healExpression: auto.healExpression || '',
                action: auto.action || 'action',
                uses: auto.uses ?? 1,
                usesMax: auto.uses ?? 1,
                recharge: auto.recharge || 'short_rest',
                hasAutomation: true
            }
        }

        case 'set_condition': {
            return {
                type: 'set_condition',
                name: feature.name,
                target: auto.target,
                condition: auto.condition,
                cost: auto.cost || '',
                range: auto.range || '60 ft',
                saveType: auto.saveType || 'STR',
                effect: auto.effect || '',
                hasAutomation: true
            }
        }

        case 'spell_modifier': {
            return {
                type: 'spell_modifier',
                name: feature.name,
                options: auto.options || [],
                resource: auto.resource || 'sorcery_points',
                hasAutomation: true
            }
        }

        case 'temp_buff': {
            return {
                type: 'temp_buff',
                name: feature.name,
                effect: auto.effect || '',
                duration: auto.duration || '1_minute',
                action: auto.action || 'bonus_action',
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'temp_hp_buff': {
            return {
                type: 'temp_hp_buff',
                name: feature.name,
                buffExpression: auto.buffExpression || '',
                range: auto.range || '60_ft',
                targets: auto.targets || 1,
                extraEffect: auto.extraEffect || null,
                hasAutomation: true
            }
        }


        case 'sorcery_aura': {
            return {
                type: 'sorcery_aura',
                name: feature.name,
                uses_max: 2,
                recharge: auto.recharge || 'long_rest',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
             }
        }

        case 'resource_restoration': {
            const restoreAmount = auto.restore_expression
                  ? evaluateAutoExpression(auto.restore_expression, playerStats)
                  : 0
            return {
                type: 'resource_restoration',
                name: feature.name,
                trigger: auto.trigger || 'short_rest',
                casting_time: auto.casting_time || 'passive',
                restore_amount: restoreAmount,
                restore_expression: auto.restore_expression || '',
                resourceKey: auto.resourceKey || '',
                uses_max: auto.uses_max ?? 1,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
              }
          }

        case 'sorcery_incarnate': {
            return {
                type: 'sorcery_incarnate',
                name: feature.name,
                casting_time: auto.casting_time || '1 bonus action',
                cost: auto.cost || 2,
                hasAutomation: true
              }
          }

        default:
            return null
       }
   }

export function evaluateAutoExpression(expression, playerStats, prof, level) {
    if (!expression) return expression
    prof = prof || 0
    level = level || 1
    let expr = expression
           .replace(/proficiency_bonus_d4/g, `${Math.max(1, prof)}d4`)
           .replace(/proficiency_bonus/g, prof)
           .replace(/monk level/gi, level)
           .replace(/fighter level/gi, level)
           .replace(/paladin level/gi, level)
           .replace(/barbarian level/gi, level)
           .replace(/bard level/gi, level)
           .replace(/level/gi, level)
    try {
        const result = new Function(`"use strict"; return (${expr})`)()
        if (typeof result === 'number' && !isNaN(result)) return result
      } catch (e) { /* not a simple expression, return as string */ }
    return expr
}

export function collectAutomationFromFeatures(features, playerStats) {
    const result = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        passives: [],
        autoEffects: [],
        saveModifiers: []
    }

    if (!features) return result

    features.forEach(feature => {
        if (!feature?.automation) return
        const info = buildAttackInfo(feature, playerStats)
        if (!info) return

        switch (info.type) {
            case 'save_attack':
            case 'save_only':
            case 'healing':
            case 'healing_pool':
            case 'self_healing':
            case 'damage_bonus':
            case 'extra_action':
            case 'buff_ally':
            case 'bonus_attacks':
            case 'bonus_action_attack':
            case 'reaction_damage':
            case 'reaction_debuff':
            case 'reaction_bonus':
            case 'free_spell':
            case 'resource_pool':
            case 'attack_rider':
            case 'initiative_action':
            case 'spell_modifier':
            case 'font_of_magic':
            case 'set_condition':
            case 'sorcery_aura':
            case 'sorcery_incarnate':
                result.actions.push(info)
                break
            case 'damage_reduction':
            case 'conditional_advantage':
            case 'conditional_disadvantage':
            case 'auto_reroll':
                result.reactions.push(info)
                break
            case 'temp_buff':
            case 'temp_hp_buff':
            case 'damage_aura':
            case 'combat_stance':
                result.specialActions.push(info)
                break
            case 'passive_buff':
            case 'passive_immunity':
            case 'passive_rule':
            case 'resistance':
            case 'auto_effect':
            case 'resource_restoration':
                result.passives.push(info)
                break
            default:
                result.specialActions.push(info)
                break
        }
    })

    return result
}

export function processFeatureAutomation(allActions, allBonusActions, allReactions, allSpecialActions, playerStats) {
    const combined = [
        ...(allActions || []),
        ...(allBonusActions || []),
        ...(allReactions || []),
        ...(allSpecialActions || [])
    ]

    const automation = collectAutomationFromFeatures(combined, playerStats)

    automation.actions.forEach(a => {
        if (!allActions.find(f => f.name === a.name)) {
            allActions.push({ name: a.name, description: '', automation: a, hasAutomation: true })
        }
    })

    return automation
}

export function getAutomationInfo(feature, playerStats) {
    if (!feature?.automation) return null
    return buildAttackInfo(feature, playerStats)
}

export function collectSaveModifiers(features) {
    const modifiers = []
    if (!features) return modifiers

    features.forEach(feature => {
        if (!feature?.automation) return
        const auto = feature.automation
        if (auto.type === 'conditional_advantage') {
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: auto.effect,
                abilities: auto.abilities || []
            })
        }
        if (auto.type === 'auto_reroll') {
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: 'reroll'
            })
        }
    })

    return modifiers
}

export function hasAutomation(feature) {
    return !!(feature?.automation)
}

export function getConditionImmunities(features) {
    const immunities = []
    if (!features) return immunities

    features.forEach(feature => {
        if (!feature?.automation) return
        const auto = feature.automation
        if (auto.type === 'passive_immunity') {
            immunities.push(auto.conditionImmunity)
        }
        if (auto.type === 'condition_immunity_while_active') {
            immunities.push(...auto.immunities)
        }
    })

    return immunities
}

export function getPassiveBuffs(features, playerStats) {
    const buffs = []
    if (!features) return buffs

    features.forEach(feature => {
        if (!feature?.automation) return
        const info = buildAttackInfo(feature, playerStats)
        if (info && (info.type === 'passive_buff' || info.type === 'passive_rule' || info.type === 'passive_immunity')) {
            buffs.push(info)
        }
    })

    return buffs
}
