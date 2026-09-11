import { normalizeCastingTime } from '../../shared/castingTimeUtils.js'

const CRITICAL_TRIGGER_RE = /_crit|critical_/

function pushTo(bucketName) {
    return (info, auto, result) => result[bucketName].push(info)
}

function pushToBoth(firstBucket, secondBucket) {
    return (info, auto, result) => {
        result[firstBucket].push(info)
        result[secondBucket].push(info)
    }
}

// Routing for save-based spells/features: critical triggers become passives,
// bonus-action casts go to bonusActions, everything else to actions.
function routeSaveStyle(info, auto, result) {
    if (info.trigger && (CRITICAL_TRIGGER_RE.test(info.trigger) || info.trigger === 'cunning_strike_poison_save_fail')) {
        result.passives.push(info)
    } else if (info.action === 'bonus_action') {
        result.bonusActions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeCtPassiveBonusOrAction(info, auto, result, ct) {
    if (ct === 'passive') {
        result.specialActions.push(info)
    } else if (info.action === 'bonus_action') {
        result.bonusActions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeBonusByCt(info, auto, result, ct) {
    if (ct === '1 bonus action') {
        result.bonusActions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeFireBurn(info, auto, result, ct) {
    if (ct === '1 action') {
        result.actions.push(info)
    } else {
        result.passives.push(info)
    }
}

function routeCtPassiveOrReaction(info, auto, result, ct) {
    if (ct === 'passive') {
        result.specialActions.push(info)
    } else {
        result.reactions.push(info)
    }
}

function routeAutoReroll(info, auto, result, ct) {
    if (ct === '1 action') {
        result.actions.push(info)
    } else if (ct === 'passive') {
        result.specialActions.push(info)
    } else {
        result.reactions.push(info)
    }
}

function routeAttackRider(info, auto, result, ct) {
    if (info.chooseOne || info.maxEffects > 1 || (info.oncePerTurn && ct === 'passive') || info.trigger) {
        result.passives.push(info)
    } else {
        result.actions.push(info)
    }
}

function routePassiveUnlessPsychicTeleport(info, auto, result) {
    if (auto.effect === 'psychic_teleportation') {
        result.bonusActions.push(info)
    } else {
        result.passives.push(info)
    }
}

function routePassiveSpecial(info, auto, result) {
    result.passives.push(info)
    result.specialActions.push(info)
}

const PASSIVE_RULE_SPECIAL_EFFECTS = {
    ritual_spells: 'ritualSpells',
    superior_defense: 'specialActions',
    grapple_damage: 'specialActions',
}

function routePassiveRule(info, auto, result) {
    const specialBucket = PASSIVE_RULE_SPECIAL_EFFECTS[info.effect]
    if (specialBucket) {
        result[specialBucket].push(info)
        return
    }
    if (info.effect === 'bonus_healing') {
        result.specialActions.push(info)
    }
    result.passives.push(info)
    if (info.effect === 'primal_knowledge' && info.primalKnowledge.length > 0) {
        result.primalKnowledge.push(...info.primalKnowledge)
    }
}

function routeCosmicOmen(info, auto, result, ct) {
    if (ct === '1 bonus action') {
        result.bonusActions.push(info)
    } else if (ct === '1 reaction') {
        result.reactions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeCombatSuperiority(info, auto, result) {
    if (info.oncePerTurn) {
        result.actions.push(info)
    } else {
        result.specialActions.push(info)
    }
    if (info.bonusActionManeuvers) {
        result.bonusActions.push(...info.bonusActionManeuvers)
    }
}

function routeBonusByAction(info, auto, result) {
    if (info.action === 'bonus_action') {
        result.bonusActions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeMistyWanderer(info, auto, result, ct) {
    if (ct === 'passive') {
        result.specialActions.push(info)
    } else if (ct === '1 bonus action') {
        result.bonusActions.push(info)
    } else {
        result.actions.push(info)
    }
}

function routeModifyD20Roll(info, auto, result, ct) {
    if (ct === '1 reaction') {
        result.reactions.push(info)
    } else if (ct === '1 bonus action') {
        result.bonusActions.push(info)
    } else {
        result.passives.push(info)
    }
}

function routeDamageTypeChoice(info, auto, result) {
    if (info.effect === 'elemental_affinity') {
        result.specialActions.push(info)
    } else {
        result.passives.push(info)
    }
}

function routeMeta(info, auto, result) {
    if (info.effect === 'heroic_inspiration_on_long_rest') {
        result.passives.push(info)
    } else {
        result.specialActions.push(info)
    }
}

function assign(map, handler, types) {
    for (const type of types) {
        map[type] = handler
    }
}

const ROUTES = {}

assign(ROUTES, routeSaveStyle, [
    'save_attack', 'save_only', 'charm_person', 'elemental_burst', 'wrath_of_the_sea',
    'oceanic_gift', 'flesh_to_stone', 'hold_monster', 'banishment', 'maze',
    'hypnotic_pattern', 'power_word_stun', 'sleep', 'resilient_sphere', 'mass_suggestion',
    'suggestion', 'ottos_dance', 'stinking_cloud', 'sleet_storm', 'confusion',
    'tashas_laughter', 'imprisonment', 'forcecage', 'prismatic_spray', 'slow',
    'healing', 'healing_pool', 'self_healing', 'damage_bonus',
])

assign(ROUTES, routeCtPassiveBonusOrAction, [
    'extra_action', 'heroes_feast', 'buff_ally', 'bardic_inspiration', 'bonus_attacks',
    'bonus_action_attack', 'free_spell', 'fey_reinforcements', 'divine_intervention',
])

assign(ROUTES, pushTo('actions'), [
    'resource_pool', 'open_hand_technique', 'spell_modifier', 'font_of_magic', 'divine_spark',
    'set_condition', 'sorcery_aura', 'sorcery_incarnate', 'nature_sanctuary',
    'warding_bond', 'war_magic_cantrip', 'war_magic_spell', 'arcane_charge',
    'telekinetic_movement', 'combat_superiority_grant_attack', 'primal_companion_command',
    'primal_companion_restore', 'remove_curse', 'spare_the_dying', 'bastion_of_law',
    'contact_patron', 'dragon_companion', 'stealth_attack',
])

assign(ROUTES, routeBonusByCt, [
    'clouds_jaunt', 'sanctuary', 'illusory_reality', 'lesser_restoration', 'protection_from_poison',
])

assign(ROUTES, routeFireBurn, ['fire_burn', 'frosts_chill', 'hills_tumble'])

assign(ROUTES, pushTo('reactions'), [
    'stones_endurance', 'storms_thunder', 'reaction_damage', 'reaction_bonus',
    'bardic_inspiration_offense', 'piercer_puncture', 'combat_superiority_reaction',
    'combat_superiority_commanding_presence_reaction', 'telekinetic_thrust', 'glorious_defense',
    'relentless_avenger', 'soul_of_vengeance', 'sentinel_guardian', 'reaction_save',
    'reaction_spell', 'shadowy_dodge', 'interception', 'protection', 'misty_escape',
    'beguiling_defenses', 'searing_vengeance', 'illusory_self', 'superior_hunter_defense',
    'lucky_point', 'spell_thief', 'shield', 'restore_balance', 'projected_ward',
])

assign(ROUTES, routeCtPassiveOrReaction, [
    'countercharm', 'damage_reduction', 'psionic_strike', 'reaction_debuff',
    'bardic_inspiration_defense', 'reaction_save_heal', 'animal_aspect',
])

assign(ROUTES, pushTo('bonusActions'), [
    'nature_sanctuary_move', 'combat_superiority_bonus_action', 'know_enemy', 'war_bond_summon',
    'bulwark_of_force', 'primal_companion_bonus_action_command', 'steps_of_the_fey',
    'bonus_action_choice', 'steady_aim', 'mage_hand_control', 'fast_hands',
    'arcane_ward_bonus_action', 'third_eye', 'apply_poison',
])

assign(ROUTES, pushTo('specialActions'), [
    'temp_buff', 'temp_hp_buff', 'damage_aura', 'combat_stance', 'initiative_action',
    'starry_form', 'twinkling_constellations', 'tactical_mind', 'quivering_palm',
    'combat_superiority_movement', 'combat_superiority_skill_check', 'living_legend',
    'cloak_of_shadows', 'holy_nimbus', 'holy_aura', 'avenging_angel', 'magical_cunning',
    'elder_champion', 'large_form', 'celestial_resilience', 'hunter_prey',
    'revelation_in_flesh', 'peerless_athlete', 'dragon_wings', 'clairvoyant_combatant',
    'create_thrall', 'celestial_revelation', 'elfish_lineage', 'gnomish_lineage',
    'fiendish_legacy', 'memorize_spell', 'signature_spells', 'spell_mastery', 'portent',
    'web_area_save', 'sleet_storm_area_save', 'faerie_fire', 'brew_poison',
    'minor_telekinesis_spell',
])

assign(ROUTES, pushTo('passives'), [
    'survive_and_heal', 'shadow_step_rider', 'primal_companion_double_strike',
    'primal_companion_double_strike_damage', 'primal_companion_spell_share',
    'primal_companion_dodge', 'holy_nimbus_radiant_damage', 'umbral_sight',
    'naturally_stealthy', 'cantrip_spellcasting_ability', 'dark_ones_blessing',
    'dark_ones_luck', 'superior_hunter_prey', 'magical_ambush', 'versatile_trickster',
    'stroke_of_luck', 'supreme_sneak', 'save_proficiency', 'expert_divination',
    'radiant_soul', 'hurl_through_hell', 'create_thrall_temp_hp', 'divination_savant',
    'evocation_savant', 'illusion_savant', 'arcane_ward', 'spell_breaker', 'sentinel',
    'potent_cantrip', 'soulstitch_spells', 'empowered_evocation', 'improved_illusions',
    'overchannel', 'pass_without_trace', 'wild_magic_surge', 'wild_magic_tamed',
    'feats_of_chaos', 'phantasmal_creatures', 'shadow_arts',
])

assign(ROUTES, routePassiveUnlessPsychicTeleport, [
    'passive_buff', 'passive_immunity', 'condition_immunity_while_active', 'resistance',
    'land_resistance', 'psionic_sorcery', 'psionic_spells_list', 'psychic_spells',
    'auto_effect', 'healing_bonus',
])

assign(ROUTES, routePassiveSpecial, [
    'resource_restoration', 'natural_recovery', 'circle_of_the_land_spells',
    'font_of_inspiration', 'conditional_advantage', 'conditional_replacement', 'evasion',
    'conditional_disadvantage', 'mastery_rider', 'weapon_kind_mastery', 'bewitching_magic',
    'post_cast_rider', 'post_cast_self_heal', 'post_cast_ally_heal', 'post_cast_smite_cover',
    'post_cast_inspiring_smite', 'multi_target_spread', 'jack_of_all_trades',
    'reliable_talent', 'divine_order', 'moonlight_step_rider', 'damage_type_modifier',
    'weapon_mastery_choice',
])

assign(ROUTES, routeBonusByAction, [
    'guarded_mind', 'concentration_bonus_attack', 'telekinetic_leap', 'primal_companion_summon',
    'trance_of_order', 'clockwork_cavalcade', 'telekinetic_shove',
])

ROUTES.auto_reroll = routeAutoReroll
ROUTES.attack_rider = routeAttackRider
ROUTES.passive_rule = routePassiveRule
ROUTES.cosmic_omen = routeCosmicOmen
ROUTES.combat_superiority = routeCombatSuperiority
ROUTES.misty_wanderer = routeMistyWanderer
ROUTES.modify_d20_roll = routeModifyD20Roll
ROUTES.damage_type_choice = routeDamageTypeChoice
ROUTES.meta = routeMeta
ROUTES.use_magic_device = pushToBoth('passives', 'specialActions')

export function routeAutomation(info, auto, result) {
    const ct = normalizeCastingTime(info.casting_time)
    const route = ROUTES[info.type] || pushTo('specialActions')
    route(info, auto, result, ct)
}
