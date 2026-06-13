import { buildAttackInfo } from './automationInfoBuilder.js'

export function collectTurnStartEffects(features) {
    const effects = []
    if (!features) return effects

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto?.type === 'passive_rule' && auto?.effect === 'heroic_inspiration_turn_start') {
                effects.push({
                    type: 'heroic_inspiration',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'end_of_turn_condition_removal') {
                const conditions = (auto.conditions || []).map(c => c.toLowerCase())
                if (conditions.length > 0) {
                    effects.push({
                        type: 'condition_removal',
                        name: feature.name,
                        conditions,
                    })
                }
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'superior_defense') {
                effects.push({
                    type: 'superior_defense',
                    name: feature.name,
                    cost: auto.cost || 3,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'flurry_healing_harm') {
                effects.push({
                    type: 'flurry_healing_harm',
                    name: feature.name,
                    usesExpression: auto.usesExpression || 'WIS modifier minimum 1',
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'dread_ambush_speed') {
                effects.push({
                    type: 'dread_ambush_speed',
                    name: feature.name,
                    bonusExpression: auto.bonusExpression || '10',
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'umbral_sight') {
                effects.push({
                    type: 'umbral_sight',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'roving_aim') {
                effects.push({
                    type: 'steady_aim_clear',
                    name: feature.name,
                })
            }
            if (auto?.type === 'steady_aim') {
                effects.push({
                    type: 'steady_aim_clear',
                    name: feature.name,
                })
            }
            if (auto?.type === 'holy_nimbus') {
                effects.push({
                    type: 'holy_nimbus_radiant_damage',
                    name: feature.name,
                    damageExpression: 'CHA modifier + proficiency_bonus',
                    range: '10_ft',
                })
            }
            if (auto?.type === 'living_legend') {
                effects.push({
                    type: 'living_legend_turn_start',
                    name: feature.name,
                })
            }
            if (auto?.type === 'elder_champion') {
                effects.push({
                    type: 'elder_champion_regeneration',
                    name: feature.name,
                    healExpression: '10',
                })
            }
            if (auto?.type === 'precise_hunter') {
                effects.push({
                    type: 'precise_hunter',
                    name: feature.name,
                })
            }
            if (auto?.type === 'hunter_lore') {
                effects.push({
                    type: 'hunter_lore',
                    name: feature.name,
                })
            }
        }
    })

    return effects
}

export function collectAutomationFromFeatures(features, playerStats) {
    const result = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        passives: [],
        autoEffects: [],
        saveModifiers: [],
        primalKnowledge: []
    }

    if (!features) return result

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            const info = buildAttackInfo({ ...feature, automation: auto }, playerStats)
            if (!info) continue

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
            case 'fey_reinforcements':
            case 'divine_intervention':
            case 'bardic_inspiration_offense':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'resource_pool':
            case 'open_hand_technique':
            case 'initiative_action':
            case 'spell_modifier':
            case 'font_of_magic':
            case 'divine_spark':
            case 'set_condition':
            case 'sorcery_aura':
            case 'sorcery_incarnate':
            case 'nature_sanctuary':
                result.actions.push(info)
                break
            case 'reaction_damage':
            case 'countercharm':
            case 'damage_reduction':
            case 'psionic_strike':
            case 'reaction_debuff':
            case 'bardic_inspiration_defense':
            case 'reaction_save_heal':
                result.reactions.push(info)
                break
            case 'nature_sanctuary_move':
                result.bonusActions.push(info)
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
            case 'attack_rider':
                // attack_rider with options (chooseOne) is a passive that triggers on hit
                if (info.chooseOne || info.maxEffects > 1) {
                    result.passives.push(info)
                } else {
                    // Single-option attack_rider is an action
                    result.actions.push(info)
                }
                break
            case 'passive_buff':
            case 'passive_immunity':
            case 'condition_immunity_while_active':
            case 'resistance':
            case 'land_resistance':
            case 'auto_effect':
            case 'resource_restoration':
            case 'font_of_inspiration':
            case 'conditional_advantage':
            case 'conditional_replacement':
            case 'evasion':
            case 'conditional_disadvantage':
            case 'mastery_rider':
            case 'post_cast_rider':
            case 'post_cast_self_heal':
            case 'post_cast_ally_heal':
            case 'post_cast_smite_cover':
            case 'post_cast_inspiring_smite':
            case 'multi_target_spread':
            case 'jack_of_all_trades':
            case 'divine_order':
            case 'moonlight_step_rider':
            case 'damage_type_modifier':
                result.passives.push(info)
                if (info.type === 'passive_rule' && info.effect === 'primal_knowledge' && info.primalKnowledge.length > 0) {
                    result.primalKnowledge.push(...info.primalKnowledge)
                }
                break
            case 'passive_rule':
                if (info.effect === 'superior_defense') {
                    result.specialActions.push(info)
                } else {
                    result.passives.push(info)
                    if (info.effect === 'primal_knowledge' && info.primalKnowledge.length > 0) {
                        result.primalKnowledge.push(...info.primalKnowledge)
                    }
                }
                break
            case 'starry_form':
                result.specialActions.push(info)
                break
            case 'cosmic_omen':
                if (info.casting_time === '1 bonus_action' || info.casting_time === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'twinkling_constellations':
                result.specialActions.push(info)
                break
            case 'tactical_mind':
                result.specialActions.push(info)
                break
            case 'combat_superiority':
                if (info.oncePerTurn) {
                    result.actions.push(info)
                } else {
                    result.specialActions.push(info)
                }
                break
            case 'know_enemy':
                result.bonusActions.push(info)
                break
            case 'war_bond_summon':
                result.bonusActions.push(info)
                break
            case 'war_magic_cantrip':
                result.actions.push(info)
                break
            case 'war_magic_spell':
                result.actions.push(info)
                break
            case 'arcane_charge':
            case 'telekinetic_movement':
                result.actions.push(info)
                result.actions.push(info)
                break
            case 'guarded_mind':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'bulwark_of_force':
                result.bonusActions.push(info)
                break
            case 'concentration_bonus_attack':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'telekinetic_leap':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'telekinetic_thrust':
            case 'glorious_defense':
            case 'relentless_avenger':
            case 'soul_of_vengeance':
                result.reactions.push(info)
                break
            case 'living_legend':
                result.specialActions.push(info)
                break
            case 'shadow_step_rider':
                result.passives.push(info)
                break
            case 'cloak_of_shadows':
                result.specialActions.push(info)
                break
            case 'holy_nimbus':
                result.specialActions.push(info)
                break
            case 'avenging_angel':
                result.specialActions.push(info)
                break
            case 'primal_companion_summon':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'primal_companion_command':
                result.actions.push(info)
                break
            case 'primal_companion_restore':
                result.actions.push(info)
                break
            case 'primal_companion_bonus_action_command':
                result.bonusActions.push(info)
                break
            case 'primal_companion_double_strike':
                result.passives.push(info)
                break
            case 'primal_companion_double_strike_damage':
                result.passives.push(info)
                break
            case 'primal_companion_spell_share':
                result.passives.push(info)
                break
            case 'primal_companion_dodge':
                result.passives.push(info)
                break
            case 'holy_nimbus_radiant_damage':
                result.passives.push(info)
                break
            case 'elder_champion':
                result.specialActions.push(info)
                break
            case 'umbral_sight':
                result.passives.push(info)
                break
            case 'reaction_save':
                result.reactions.push(info)
                break
            case 'misty_wanderer':
                if (info.casting_time === '1 bonus action' || info.casting_time === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'shadowy_dodge':
                result.reactions.push(info)
                break
            case 'hunter_prey':
                result.passives.push(info)
                break
            case 'defensive_tactics':
                result.passives.push(info)
                break
            case 'superior_hunter_prey':
                result.passives.push(info)
                break
            case 'superior_hunter_defense':
                result.reactions.push(info)
                break
            case 'bonus_action_choice':
                result.bonusActions.push(info)
                break
            case 'steady_aim':
                result.bonusActions.push(info)
                break
            case 'peerless_athlete':
                result.specialActions.push(info)
                break
            case 'save_proficiency':
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
