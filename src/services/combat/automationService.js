import { getAbilityModifier } from '../shared/abilityLookup.js'
import { parseMagicItemName } from '../rules/attackCalc.js'

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
                damageExpression: auto.damageExpression || '',
                damageType: auto.damageType || '',
                trigger: auto.trigger || '',
                oncePerTurn: !!auto.oncePerTurn,
                chooseOne: !!auto.chooseOne,
                maxEffects: auto.maxEffects || 1,
                hasAutomation: true
            }
        }

        case 'mastery_rider': {
            return {
                type: 'mastery_rider',
                name: feature.name,
                masteries: auto.masteries || [],
                extraMastery: auto.extraMastery || [],
                trigger: auto.trigger || 'hit',
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
                trigger: auto.trigger || '',
                bonus: auto.bonus ?? null,
                range: auto.range || '',
                resourceCost: auto.resourceCost || '',
                casting_time: auto.casting_time || '',
                bonusExpression: auto.bonusExpression || '',
                oncePerRage: !!auto.oncePerRage,
                hasAutomation: true
            }
        }

        case 'bonus_action_attack': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            return {
                type: 'bonus_action_attack',
                name: feature.name,
                trigger: auto.trigger || '',
                action: auto.action || 'bonus_action',
                weaponAttack: !!auto.weaponAttack,
                extraDamageExpression: auto.extraDamageExpression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                resourceKey: 'warPriestUses',
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

        case 'bardic_inspiration': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const dieSize = classLevel?.bardic_die || 6;
            return {
                type: 'bardic_inspiration',
                name: feature.name,
                range: auto.range || '60_ft',
                action: auto.action || 'bonus_action',
                usesMax,
                usesRecharge: auto.recharge || 'long_rest',
                dieSize,
                hasAutomation: true
            }
        }

        case 'bardic_inspiration_defense':
            return {
                type: 'bardic_inspiration_defense',
                name: feature.name,
                hasAutomation: true,
            }

        case 'bardic_inspiration_offense':
            return {
                type: 'bardic_inspiration_offense',
                name: feature.name,
                hasAutomation: true,
            }

        case 'combat_stance': {
            return {
                type: 'combat_stance',
                name: feature.name,
                effect: auto.effect || '',
                damageBonusExpression: auto.damageBonusExpression || '',
                resistanceTypes: auto.resistanceTypes || [],
                advantages: auto.advantages || [],
                options: auto.options || [],
                duration: auto.duration || '',
                resourceKey: auto.resourceKey || 'ragePoints',
                uses: auto.uses || 0,
                flySpeed: auto.flySpeed || null,
                reactionSave: auto.reactionSave || null,
                blocksSpellcasting: auto.blocksSpellcasting || false,
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

        case 'evasion': {
            return {
                type: 'evasion',
                name: feature.name,
                saveType: auto.saveType || 'DEX',
                shareable: !!auto.shareable,
                shareRange: auto.shareRange || 0,
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
                oncePerTurn: !!auto.oncePerTurn,
                options: auto.options || [],
                tempHpExpression: auto.tempHpExpression || '',
                upgrades: auto.upgrades || '',
                rangeBonusCantrip: auto.rangeBonusCantrip || '',
                hasAutomation: true
            }
        }

        case 'damage_modifier': {
            return {
                type: 'damage_modifier',
                name: feature.name,
                trigger: auto.trigger || '',
                modifierExpression: auto.modifierExpression || '',
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
                oncePerTurn: !!auto.oncePerTurn,
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

        case 'divine_intervention': {
            return {
                type: 'divine_intervention',
                name: feature.name,
                recharge: auto.recharge || 'long_rest',
                upgradeTo: auto.upgradeTo || '',
                casting_time: auto.casting_time || '1 action',
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
                action: auto.action || 'action',
                duration: auto.duration || '',
                concentration: !!auto.concentration,
                noConcentration: !!auto.noConcentration,
                resourceCost: auto.resourceCost || '',
                freeCasts: auto.freeCasts || '',
                casting_time: auto.casting_time || '',
                perSpellTracking: !!auto.perSpellTracking,
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
            const baseExpression = auto.poolExpression || ''
            const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats)
            const diceMatch = resolvedExpression.match(/^(\d+)d(\d+)$/i)
            const isDicePool = !!diceMatch
            const pool = isDicePool
                ? parseInt(diceMatch[1], 10)
                : (resolvedExpression ? evaluateAutoExpression(resolvedExpression, playerStats, prof, level) : 0)
            return {
                type: 'healing_pool',
                name: feature.name,
                pool,
                poolExpression: resolvedExpression,
                isDicePool,
                dieType: isDicePool ? parseInt(diceMatch[2], 10) : null,
                action: auto.action || 'action',
                recharge: auto.recharge || 'long_rest',
                alsoCures: auto.alsoCures || [],
                cureCost: auto.cureCost || 5,
                range: auto.range || '',
                resourceCost: auto.resourceCost || '',
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
                resourceCost: auto.resourceCost || '',
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
                bonusExpression: auto.bonusExpression || auto.bonus || '',
                condition: auto.condition || '',
                conditionImmunity: auto.conditionImmunity || '',
                resistances: auto.resistances || [],
                options: auto.options || [],
                extraMastery: auto.extraMastery || [],
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

        case 'condition_immunity_while_active': {
            return {
                type: 'condition_immunity_while_active',
                name: feature.name,
                target: auto.target || 'self',
                immunities: auto.immunities || [],
                requiresActive: auto.requiresActive || '',
                hasAutomation: true
            }
        }

        case 'passive_rule': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: auto.effect || '',
                bonusExpression: auto.bonusExpression || '',
                criticalRange: auto.criticalRange || '',
                spells: auto.spells || [],
                riderSave: auto.riderSave || null,
                hasAutomation: true
            }
        }

        case 'post_cast_rider': {
            return {
                type: 'post_cast_rider',
                name: feature.name,
                saveType: auto.saveType || 'WIS',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'CHA',
                condition: auto.condition || '',
                duration: auto.duration || '1_minute',
                range: auto.range || '60 ft',
                spellSchools: auto.spellSchools || [],
                recharge: auto.recharge || 'long_rest',
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
                  selfMovement: auto.selfMovement || '',
                  allyMovement: auto.allyMovement || '',
                  allyRange: auto.allyRange || '30 ft',
                  noOAs: !!auto.noOAs,
                  resourceCost: auto.resourceCost || '',
                  effect: auto.effect || '',
                  saveType: auto.saveType || '',
                  saveDc: auto.saveDc || '',
                  duration: auto.duration || '',
                  hasAutomation: true
              }
          }

        case 'reaction_damage': {
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
        }

        case 'reaction_debuff': {
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
                conversion: auto.conversion || '',
                reverseConversion: auto.reverseConversion || '',
                reverseRecharge: auto.reverseRecharge || '',
                conversionRate: auto.conversionRate || '',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
             }
         }

        case 'save_attack': {
            const scaling = resolveScaling(playerStats, auto.scaling)
            const rawDamage = scaling?.damage || auto.damage || ''
            const damage = resolveDiceExpression(rawDamage, playerStats)
            const uses = resolveUses(playerStats, auto.uses)
            const saveDc = auto.saveDc === 'ability'
                ? getSaveDc(playerStats, auto.saveAbility || 'CON', prof)
                : auto.saveDc || 10
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

        case 'divine_spark': {
            return {
                type: 'divine_spark',
                name: feature.name,
                range: auto.range || '30 ft',
                healExpression: auto.healExpression || '',
                damageExpression: auto.damageExpression || '',
                damageTypes: auto.damageTypes || [],
                saveType: auto.saveType || 'CON',
                resourceCost: auto.resourceCost || '',
                hasAutomation: true
            }
        }

        case 'set_condition': {
            return {
                type: 'set_condition',
                name: feature.name,
                target: auto.target,
                condition: auto.condition,
                additionalCondition: auto.additionalCondition || null,
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
                distance: auto.distance || '',
                extendedDistance: auto.extendedDistance || '',
                oncePerRage: !!auto.oncePerRage,
                bringAllies: !!auto.bringAllies,
                allyCount: auto.allyCount || 0,
                teleportRange: auto.teleportRange || '',
                enemiesDisadvantageSaves: auto.enemies_disadvantage_saves || [],
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
                targetsExpression: auto.targetsExpression || '',
                bonusMovement: !!auto.bonusMovement,
                extraEffect: auto.extraEffect || null,
                tempHpExpression: auto.tempHpExpression || '',
                triggerOnRage: !!auto.trigger_on_rage,
                ongoingHealingExpression: auto.ongoingHealingExpression || '',
                healingStartOfTurn: !!auto.healingStartOfTurn,
                healingRange: auto.healingRange || '',
                casting_time: auto.casting_time || '1 bonus action',
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

        case 'post_cast_self_heal': {
            return {
                type: 'post_cast_self_heal',
                name: feature.name,
                healExpression: auto.healExpression || '0',
                othersOnly: auto.othersOnly ?? true,
                hasAutomation: true
            }
        }

        default:
            return null
       }
   }

function resolveHealingPoolExpression(baseExpression, scaling, playerStats) {
    if (!scaling) return baseExpression
    const entries = Object.entries(scaling)
        .map(([k, v]) => ({ level: parseInt(k, 10), expression: String(v) }))
        .filter(e => !isNaN(e.level))
        .sort((a, b) => a.level - b.level)
    let resolved = baseExpression
    for (const entry of entries) {
        if (playerStats.level >= entry.level) {
            resolved = entry.expression
        }
    }
    return resolved
}

function resolveDiceExpression(expression, playerStats, slotLevel) {
    if (!expression) return expression
    const prof = playerStats?.proficiency || 0
    const level = playerStats?.level || 1
    slotLevel = slotLevel || 1
    const rageDamage = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2
    const bardicDie = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_die || 6
    let expr = expression
           .replace(/bardic_inspiration_die/g, bardicDie)
           .replace(/proficiency_bonus_d4/g, `${Math.max(1, prof)}d4`)
           .replace(/proficiency_bonus/g, prof)
           .replace(/monk level/gi, level)
           .replace(/fighter_level/gi, level)
           .replace(/fighter level/gi, level)
           .replace(/paladin level/gi, level)
           .replace(/barbarian_level/gi, level)
           .replace(/barbarian level/gi, level)
           .replace(/bard level/gi, level)
           .replace(/rage_damage_d6/g, `${rageDamage}d6`)
           .replace(/rage_damage/g, rageDamage)
           .replace(/cleric_level/gi, level)
           .replace(/cleric level/gi, level)
           .replace(/druid_level/gi, level)
           .replace(/level/gi, level)
           .replace(/spell_slot_level/g, slotLevel)
    const abilities = playerStats?.abilities || {}
    const abilityModifiers = {
        strength: getAbilityModifier(abilities, 'strength'),
        dexterity: getAbilityModifier(abilities, 'dexterity'),
        constitution: getAbilityModifier(abilities, 'constitution'),
        intelligence: getAbilityModifier(abilities, 'intelligence'),
        wisdom: getAbilityModifier(abilities, 'wisdom'),
        charisma: getAbilityModifier(abilities, 'charisma'),
    }
    expr = expr
        .replace(/STR modifier/gi, abilityModifiers.strength)
        .replace(/DEX modifier/gi, abilityModifiers.dexterity)
        .replace(/CON modifier/gi, abilityModifiers.constitution)
        .replace(/INT modifier/gi, abilityModifiers.intelligence)
        .replace(/WIS modifier/gi, abilityModifiers.wisdom)
        .replace(/CHA modifier/gi, abilityModifiers.charisma)
    return expr
}

export function evaluateAutoExpression(expression, playerStats, prof, level, slotLevel) {
    if (!expression) return expression
    prof = prof || 0
    level = level || 1
    let expr = resolveDiceExpression(expression, playerStats, slotLevel)

    const minMatch = expr.match(/^(.+?)_min_(\d+)$/)
    if (minMatch) {
        expr = `Math.max(${minMatch[2]}, (${minMatch[1]}))`
    }

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
            case 'bardic_inspiration':
            case 'bonus_attacks':
            case 'bonus_action_attack':
            case 'reaction_bonus':
            case 'free_spell':
            case 'divine_intervention':
            case 'bardic_inspiration_offense':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'resource_pool':
            case 'attack_rider':
            case 'initiative_action':
            case 'spell_modifier':
            case 'font_of_magic':
            case 'divine_spark':
            case 'set_condition':
            case 'sorcery_aura':
            case 'sorcery_incarnate':
                result.actions.push(info)
                break
            case 'reaction_damage':
            case 'damage_reduction':
            case 'reaction_debuff':
            case 'bardic_inspiration_defense':
                result.reactions.push(info)
                break
            case 'auto_reroll':
                if (info.casting_time === '1 action') {
                    result.actions.push(info)
                } else {
                    result.reactions.push(info)
                }
                break
            case 'temp_buff':
            case 'temp_hp_buff':
            case 'damage_aura':
            case 'combat_stance':
                result.specialActions.push(info)
                break
            case 'passive_buff':
            case 'passive_immunity':
            case 'condition_immunity_while_active':
            case 'passive_rule':
            case 'resistance':
            case 'auto_effect':
            case 'resource_restoration':
            case 'conditional_advantage':
            case 'evasion':
            case 'conditional_disadvantage':
            case 'mastery_rider':
            case 'post_cast_rider':
            case 'post_cast_self_heal':
                result.passives.push(info)
                break
            default:
                result.specialActions.push(info)
                break;
        }

        if (info && info.type === 'damage_bonus' && info.rangeBonusCantrip) {
            const bonusMatch = String(info.rangeBonusCantrip).match(/(\d+)/);
            if (bonusMatch) {
                result.passives.push({
                    type: 'cantrip_range_bonus',
                    name: info.name,
                    effect: 'cantrip_range_bonus',
                    bonusExpression: bonusMatch[1],
                    hasAutomation: true,
                });
            }
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
            const abilities = auto.abilities || (auto.saveType ? [auto.saveType.toUpperCase()] : []);
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: auto.effect,
                abilities
            })
        }
        if (auto.type === 'combat_stance' && auto.advantages) {
            for (const adv of auto.advantages) {
                const isSave = adv.toLowerCase().includes('saves');
                const abilityMatch = adv.match(/^(\w{3})\s+(?:checks|saves)/);
                if (isSave && abilityMatch) {
                    modifiers.push({
                        source: feature.name,
                        target: 'saving_throw',
                        condition: 'stance_active',
                        effect: 'advantage',
                        abilities: [abilityMatch[1].toUpperCase()]
                    })
                }
            }
        }
        if (auto.type === 'auto_reroll') {
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: 'reroll',
                bonusExpression: auto.bonusExpression || '',
                oncePerRage: !!auto.oncePerRage,
            })
        }
    })

    return modifiers
}

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

export function getConditionalImmunities(features) {
    const result = []
    if (!features) return result

    features.forEach(feature => {
        if (!feature?.automation) return
        const auto = feature.automation
        if (auto.type === 'condition_immunity_while_active') {
            result.push({
                name: feature.name,
                immunities: auto.immunities || [],
                requiresActive: auto.requiresActive || '',
            })
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
        const auto = feature.automation

        if (auto.type === 'passive_immunity') {
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

    return false
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

/**
 * Collect available weapon mastery properties for a given weapon.
 * Combines the weapon's base mastery with any extra mastery from features
 * (e.g., Battering Roots grants Push/Topple in addition to the weapon's own mastery).
 * @param {string} weaponName - Name of the weapon (may include magic prefix)
 * @param {Object} playerStats - PlayerStats object with equipment + automation.passives
 * @returns {{ baseMastery: string|null, extraMasteries: string[] }}
 */
export function collectWeaponMastery(weaponName, playerStats) {
    const { baseName } = parseMagicItemName(weaponName);
    const weapon = playerStats.equipment?.find(item => item.name === baseName);
    const baseMastery = weapon?.mastery || null;

    const extraMasteries = [];
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.extraMastery && Array.isArray(passive.extraMastery)) {
            extraMasteries.push(...passive.extraMastery);
        }
    }

    return {
        baseMastery,
        extraMasteries: [...new Set(extraMasteries)],
    };
}

export function resolveHealingBonuses(playerStats, prof, level, slotLevel) {
    const passives = playerStats.automation?.passives || [];
    let totalBonus = 0;
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'bonus_healing' && passive.bonusExpression) {
            const bonus = evaluateAutoExpression(passive.bonusExpression, playerStats, prof, level, slotLevel);
            if (typeof bonus === 'number' && !isNaN(bonus)) {
                totalBonus += bonus;
            }
        }
    }
    return totalBonus;
}

export function hasHealingMaximization(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'maximize_healing_dice');
}


