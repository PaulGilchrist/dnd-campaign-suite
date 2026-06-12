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
            case 'passive_buff':
            case 'passive_immunity':
            case 'condition_immunity_while_active':
            case 'passive_rule':
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
                result.reactions.push(info)
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
