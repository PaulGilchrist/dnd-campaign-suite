import { normalizeCastingTime } from '../../shared/castingTimeUtils.js'

export function routeAutomation(info, auto, result) {
    const ct = normalizeCastingTime(info.casting_time)
    switch (info.type) {
    case 'save_attack':
    case 'save_only':
    case 'charm_person':
    case 'elemental_burst':
    case 'wrath_of_the_sea':
    case 'oceanic_gift':
    case 'flesh_to_stone':
    case 'hold_monster':
    case 'banishment':
    case 'maze':
    case 'hypnotic_pattern':
    case 'power_word_stun':
    case 'sleep':
    case 'resilient_sphere':
    case 'mass_suggestion':
    case 'suggestion':
    case 'ottos_dance':
    case 'stinking_cloud':
    case 'sleet_storm':
    case 'confusion':
    case 'tashas_laughter':
    case 'imprisonment':
    case 'forcecage':
    case 'prismatic_spray':
    case 'slow':
    case 'healing':
    case 'healing_pool':
    case 'self_healing':
    case 'damage_bonus':
        if (info.trigger && (info.trigger.includes('_crit') || info.trigger.includes('_critical') || info.trigger.includes('critical_') || info.trigger === 'cunning_strike_poison_save_fail')) {
            result.passives.push(info)
        } else if (info.action === 'bonus_action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
        break
    case 'extra_action':
    case 'heroes_feast':
    case 'buff_ally':
    case 'bardic_inspiration':
    case 'bonus_attacks':
    case 'bonus_action_attack':
    case 'free_spell':
    case 'fey_reinforcements':
    case 'divine_intervention':
        if (ct === 'passive') {
            result.specialActions.push(info)
        } else if (info.action === 'bonus_action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
        break

    case 'resource_pool':
    case 'open_hand_technique':
    case 'spell_modifier':
    case 'font_of_magic':
    case 'divine_spark':
    case 'set_condition':
    case 'sorcery_aura':
    case 'sorcery_incarnate':
    case 'nature_sanctuary':
        result.actions.push(info)
        break
    case 'clouds_jaunt':
    case 'sanctuary':
        if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
        break
    case 'fire_burn':
    case 'frosts_chill':
    case 'hills_tumble':
        if (ct === '1 action') {
            result.actions.push(info)
        } else {
            result.passives.push(info)
        }
        break
    case 'stones_endurance':
    case 'storms_thunder':
        if (ct === '1 reaction') {
            result.reactions.push(info)
        } else {
            result.reactions.push(info)
        }
        break
    case 'reaction_damage':
        if (auto.trigger === 'psychic_damage_received') {
            result.reactions.push(info)
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
    case 'animal_aspect':
        if (ct === 'passive') {
            result.specialActions.push(info)
        } else {
            result.reactions.push(info)
        }
        break
    case 'reaction_bonus':
    case 'bardic_inspiration_offense':
    case 'piercer_puncture':
        result.reactions.push(info)
        break
    case 'nature_sanctuary_move':
        result.bonusActions.push(info)
        break
    case 'auto_reroll':
        if (ct === '1 action') {
            result.actions.push(info)
        } else if (ct === 'passive') {
            result.specialActions.push(info)
        } else {
            result.reactions.push(info)
        }
        break
    case 'temp_buff':
    case 'temp_hp_buff':
    case 'damage_aura':
    case 'combat_stance':
    case 'initiative_action':
        result.specialActions.push(info)
        break
    case 'attack_rider':
        if (info.chooseOne || info.maxEffects > 1 || (info.oncePerTurn && ct === 'passive') || info.trigger) {
            result.passives.push(info)
        } else {
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
    case 'auto_effect':
    case 'healing_bonus': {
        if (auto.effect === 'psychic_teleportation') {
            result.bonusActions.push(info)
        } else {
            result.passives.push(info)
        }
        break
    }
    case 'survive_and_heal': {
        result.passives.push(info)
        break
    }
    case 'resource_restoration':
    case 'natural_recovery':
    case 'circle_of_the_land_spells':
    case 'font_of_inspiration':
    case 'conditional_advantage':
    case 'conditional_replacement':
    case 'evasion':
    case 'conditional_disadvantage':
    case 'mastery_rider':
    case 'weapon_kind_mastery':
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
    case 'weapon_mastery_choice':
        result.passives.push(info)
        result.specialActions.push(info)
        if (info.type === 'passive_rule' && info.effect === 'primal_knowledge' && info.primalKnowledge.length > 0) {
            result.primalKnowledge.push(...info.primalKnowledge)
        }
        break
    case 'passive_rule':
        if (info.effect === 'superior_defense') {
            result.specialActions.push(info)
        } else if (info.effect === 'grapple_damage') {
            result.specialActions.push(info)
        } else if (info.effect === 'ritual_spells') {
            result.ritualSpells.push(info)
        } else if (info.effect === 'bonus_healing') {
            result.passives.push(info)
            result.specialActions.push(info)
        } else if (info.effect === 'tavern_brawler_push' || info.effect === 'tavern_brawler_reroll_ones' || info.effect === 'ignore_loading_crossbows' || info.effect === 'no_melee_disadvantage_crossbows') {
            result.passives.push(info)
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
    case 'warding_bond':
        result.actions.push(info)
        break
    case 'cosmic_omen':
        if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else if (ct === '1 reaction') {
            result.reactions.push(info)
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
    case 'quivering_palm':
        result.specialActions.push(info)
        break
    case 'combat_superiority':
        if (info.oncePerTurn) {
            result.actions.push(info)
        } else {
            result.specialActions.push(info)
        }
        if (info.bonusActionManeuvers) {
            result.bonusActions.push(...info.bonusActionManeuvers)
        }
        break
    case 'combat_superiority_bonus_action':
        result.bonusActions.push(info)
        break
    case 'combat_superiority_reaction':
        result.reactions.push(info)
        break
    case 'combat_superiority_grant_attack':
        result.actions.push(info)
        break
    case 'combat_superiority_movement':
        result.specialActions.push(info)
        break
    case 'combat_superiority_skill_check':
        result.specialActions.push(info)
        break
    case 'combat_superiority_commanding_presence_reaction':
        result.reactions.push(info)
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
    case 'sentinel_guardian':
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
    case 'holy_aura':
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
        result.specialActions.push(info)
        break
    case 'holy_nimbus_radiant_damage':
        result.passives.push(info)
        break
    case 'elder_champion':
        result.specialActions.push(info)
        break
    case 'large_form':
        result.specialActions.push(info)
        break
    case 'umbral_sight':
        result.passives.push(info)
        break
    case 'naturally_stealthy':
        result.passives.push(info)
        break
    case 'reaction_save':
        result.reactions.push(info)
        break
    case 'reaction_spell':
        result.reactions.push(info)
        break
    case 'misty_wanderer':
        if (ct === 'passive') {
            result.specialActions.push(info)
        } else if (ct === '1 bonus action') {
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
    case 'interception':
        result.reactions.push(info)
        break
    case 'protection':
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
        if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
        break
    case 'cantrip_spellcasting_ability':
        result.passives.push(info)
        break
    case 'dark_ones_blessing':
        result.passives.push(info)
        break
    case 'dark_ones_luck':
        result.passives.push(info)
        break
    case 'hunter_prey':
        result.specialActions.push(info)
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
    case 'lesser_restoration':
        if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
        break
    case 'remove_curse':
        result.actions.push(info)
        break
    case 'spare_the_dying':
        result.actions.push(info)
        break
    case 'protection_from_poison':
        if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
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
    case 'lucky_point':
        result.reactions.push(info)
        break
    case 'modify_d20_roll':
        if (ct === '1 reaction') {
            result.reactions.push(info)
        } else if (ct === '1 bonus action') {
            result.bonusActions.push(info)
        } else {
            result.passives.push(info)
        }
        break
    case 'spell_thief':
        result.reactions.push(info)
        break
    case 'shield':
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
    case 'expert_divination':
        result.passives.push(info)
        break
    case 'restore_balance':
        result.reactions.push(info)
        break
    case 'bastion_of_law':
        result.actions.push(info)
        break
    case 'trance_of_order':
        if (info.action === 'bonus_action') {
            result.bonusActions.push(info)
        } else {
            result.actions.push(info)
        }
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
        if (info.effect === 'elemental_affinity') {
            result.specialActions.push(info)
        } else {
            result.passives.push(info)
        }
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
        result.specialActions.push(info)
        break
    case 'create_thrall_temp_hp':
        result.passives.push(info)
        break
    case 'celestial_revelation':
        result.specialActions.push(info)
        break
    case 'elfish_lineage':
        result.specialActions.push(info)
        break
    case 'gnomish_lineage':
        result.specialActions.push(info)
        break
    case 'fiendish_legacy':
        result.specialActions.push(info)
        break
    case 'memorize_spell':
        result.specialActions.push(info);
        break;
    case 'signature_spells':
        result.specialActions.push(info);
        break;
    case 'spell_mastery':
        result.specialActions.push(info);
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
    case 'arcane_ward_bonus_action':
        result.bonusActions.push(info);
        break;
    case 'projected_ward':
        result.reactions.push(info);
        break;
    case 'spell_breaker':
        result.passives.push(info);
        break;
    case 'telekinetic_shove':
        if (info.action === 'bonus_action') {
            result.bonusActions.push(info);
        } else {
            result.actions.push(info);
        }
        break;
    case 'sentinel':
        result.passives.push(info);
        break;
    case 'portent':
        result.specialActions.push(info)
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
    case 'pass_without_trace':
        result.passives.push(info)
        break
    case 'third_eye':
        result.bonusActions.push(info);
        break;
    case 'wild_magic_surge':
        result.passives.push(info);
        break;
    case 'wild_magic_tamed':
        result.passives.push(info);
        break;
    case 'feats_of_chaos':
        result.passives.push(info);
        break;
    case 'phantasmal_creatures':
        result.passives.push(info)
        break;
    // CLA-308: Shadow Arts passive marker (passive row — consumption rides the
    // spell rows via spellPreparationService, never an interactive row click).
    case 'shadow_arts':
        result.passives.push(info)
        break;
    case 'meta':
        if (info.effect === 'heroic_inspiration_on_long_rest') {
            result.passives.push(info);
        } else {
            result.specialActions.push(info);
        }
        break;
    case 'web_area_save':
        result.specialActions.push(info)
        break;
    case 'sleet_storm_area_save':
        result.specialActions.push(info)
        break;
    case 'faerie_fire':
        result.specialActions.push(info)
        break;
    case 'brew_poison':
        result.specialActions.push(info)
        break
    case 'apply_poison':
        result.bonusActions.push(info)
        break
    case 'minor_telekinesis_spell':
        result.specialActions.push(info)
        break;
    default:
        result.specialActions.push(info)
        break;
    }
}
