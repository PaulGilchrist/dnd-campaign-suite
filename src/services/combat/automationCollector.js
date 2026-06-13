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
            if (auto?.type === 'passive_rule' && auto?.effect === 'supreme_sneak') {
                effects.push({
                    type: 'supreme_sneak',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'umbral_sight') {
                effects.push({
                    type: 'umbral_sight',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'create_thrall_temp_hp') {
                effects.push({
                    type: 'create_thrall_temp_hp',
                    name: feature.name,
                    tempHpExpression: auto.tempHpExpression || 'warlock level + CHA modifier',
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'mage_hand_legerdemain') {
                effects.push({
                    type: 'mage_hand_legerdemain',
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
            if (auto?.type === 'radiant_soul') {
                effects.push({
                    type: 'radiant_soul_turn_start',
                    name: feature.name,
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
            if (auto?.type === 'use_magic_device') {
                effects.push({
                    type: 'use_magic_device',
                    name: feature.name,
                    attunementLimit: auto.attunementLimit || 4,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'abjuration_savant') {
                effects.push({
                    type: 'abjuration_savant',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'divination_savant') {
                effects.push({
                    type: 'divination_savant',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'evocation_savant') {
                effects.push({
                    type: 'evocation_savant',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'illusion_savant') {
                effects.push({
                    type: 'illusion_savant',
                    name: feature.name,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'improved_illusions') {
                effects.push({
                    type: 'improved_illusions',
                    name: feature.name,
                })
            }
            if (auto?.type === 'third_eye') {
                effects.push({
                    type: 'third_eye',
                    name: feature.name,
                    duration: auto.duration || 'short_or_long_rest',
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'arcane_ward') {
                effects.push({
                    type: 'arcane_ward',
                    name: feature.name,
                    wardHpExpression: auto.wardHpExpression || '',
                    wardRestoreExpression: auto.wardRestoreExpression || '',
                    bonusActionRestore: !!auto.bonusActionRestore,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'projected_ward') {
                effects.push({
                    type: 'projected_ward',
                    name: feature.name,
                    range: auto.range || 30,
                    reaction: true,
                })
            }
            if (auto?.type === 'passive_rule' && auto?.effect === 'spell_breaker') {
                effects.push({
                    type: 'spell_breaker',
                    name: feature.name,
                    alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
                    bonusActionSpells: auto.bonusActionSpells || [],
                    dispelAbilityCheckBonus: auto.dispelAbilityCheckBonus || '',
                    slotRetentionSpells: auto.slotRetentionSpells || [],
                })
            }
            if (auto?.type === 'phantasmal_creatures') {
                effects.push({
                    type: 'phantasmal_creatures',
                    name: feature.name,
                    alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
                    freeCastSpells: auto.freeCastSpells || [],
                    usesMax: auto.usesMax || 1,
                    halvesHp: auto.halvesHp || false,
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
        primalKnowledge: [],
        ritualSpells: []
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
                if (auto.trigger === 'psychic_damage_received') {
                    result.passives.push(info)
                } else {
                    result.reactions.push(info)
                }
                break
            case 'countercharm':
            case 'damage_reduction':
            case 'psionic_strike':
            case 'reaction_debuff':
            case 'bardic_inspiration_defense':
            case 'reaction_save_heal':
            case 'reaction_bonus':
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
            case 'psionic_sorcery':
            case 'psionic_spells_list':
            case 'psychic_spells':
            case 'auto_effect': {
                if (auto.effect === 'psychic_teleportation') {
                    result.bonusActions.push(info)
                } else {
                    result.passives.push(info)
                }
                break
            }
            case 'resource_restoration':
            case 'font_of_inspiration':
            case 'conditional_advantage':
            case 'conditional_replacement':
            case 'evasion':
            case 'conditional_disadvantage':
            case 'mastery_rider':
            case 'bewitching_magic':
            case 'post_cast_rider':
            case 'post_cast_self_heal':
            case 'post_cast_ally_heal':
            case 'post_cast_smite_cover':
            case 'post_cast_inspiring_smite':
            case 'multi_target_spread':
            case 'jack_of_all_trades':
            case 'reliable_talent':
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
                } else if (info.effect === 'ritual_spells') {
                    result.ritualSpells.push(info)
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
            case 'magical_cunning':
                result.actions.push(info)
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
            case 'steps_of_the_fey':
                result.bonusActions.push(info)
                break
            case 'celestial_resilience':
                result.specialActions.push(info)
                break
            case 'shadowy_dodge':
                result.reactions.push(info)
                break
            case 'misty_escape':
                result.reactions.push(info)
                break
            case 'beguiling_defenses':
                result.reactions.push(info)
                break
            case 'searing_vengeance':
                result.reactions.push(info)
                break
            case 'illusory_self':
                result.reactions.push(info)
                break
            case 'illusory_reality':
                if (info.casting_time === '1 bonus_action' || info.casting_time === 'bonus_action' || info.casting_time === '1 bonus action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'dark_ones_blessing':
                result.passives.push(info)
                break
            case 'dark_ones_look':
                result.passives.push(info)
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
            case 'mage_hand_control':
                result.bonusActions.push(info)
                break
            case 'magical_ambush':
                result.passives.push(info)
                break
            case 'versatile_trickster':
                result.passives.push(info)
                break
            case 'stroke_of_luck':
                result.passives.push(info)
                break
            case 'spell_thief':
                result.reactions.push(info)
                break
            case 'fast_hands':
                result.bonusActions.push(info)
                break
            case 'stealth_attack':
                result.actions.push(info)
                break
            case 'revelation_in_flesh':
                result.specialActions.push(info)
                break
            case 'supreme_sneak':
                result.passives.push(info)
                break
            case 'use_magic_device':
                result.passives.push(info)
                result.specialActions.push(info)
                break
            case 'peerless_athlete':
                result.specialActions.push(info)
                break
            case 'save_proficiency':
                result.passives.push(info)
                break
            case 'restore_balance':
                result.reactions.push(info)
                break
            case 'bastion_of_law':
                result.actions.push(info)
                break
            case 'transe_of_order':
                result.specialActions.push(info)
                break
            case 'clockwork_cavalcade':
                if (info.action === 'bonus_action') {
                    result.bonusActions.push(info)
                } else {
                    result.actions.push(info)
                }
                break
            case 'contact_patron':
                result.actions.push(info)
                break
            case 'damage_type_choice':
                result.passives.push(info)
                break
            case 'radiant_soul':
                result.passives.push(info)
                break
            case 'dragon_wings':
                result.specialActions.push(info)
                break
            case 'dragon_companion':
                result.actions.push(info)
                break
            case 'hurl_through_hell':
                result.passives.push(info)
                break
            case 'clairvoyant_combatant':
                result.specialActions.push(info)
                break
            case 'create_thrall':
                result.actions.push(info)
                break
            case 'create_thrall_temp_hp':
                result.passives.push(info)
                break
            case 'memorize_spell':
                result.specialActions.push(info);
                break;
            case 'signature_spells':
                result.actions.push(info);
                break;
            case 'abjuration_savant':
                result.passives.push(info);
                break;
            case 'divination_savant':
                result.passives.push(info);
                break;
            case 'evocation_savant':
                result.passives.push(info);
                break;
            case 'illusion_savant':
                result.passives.push(info);
                break;
            case 'arcane_ward':
                result.passives.push(info);
                break;
            case 'projected_ward':
                result.reactions.push(info);
                break;
            case 'spell_breaker':
                result.passives.push(info);
                break;
            case 'portent':
                result.specialActions.push(info)
                break
            case 'expert_divination':
                result.passives.push(info)
                break
            case 'potent_cantrip':
                result.passives.push(info)
                break
            case 'soulstitch_spells':
                result.passives.push(info)
                break
            case 'empowered_evocation':
                result.passives.push(info)
                break
            case 'improved_illusions':
                result.passives.push(info)
                break
            case 'overchannel':
                result.passives.push(info)
                break
            case 'third_eye':
                result.bonusActions.push(info);
                break;
            case 'phantasmal_creatures':
                result.passives.push(info);
                break;
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
