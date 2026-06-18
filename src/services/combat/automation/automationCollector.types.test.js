import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

const ps = makePlayerStats()

describe('collectAutomationFromFeatures – spells/save types (group 1: actions)', () => {
    const testTypes = [
        'flesh_to_stone', 'hold_monster', 'resilient_sphere',
        'ottos_dance', 'power_word_stun', 'sleep',
        'stinking_cloud', 'tashas_laughter',
    ]
    testTypes.forEach(type => {
        it(`categorizes ${type} as action`, () => {
            const features = [makeFeature({ type }, `${type} Feature`)]
            const result = collectAutomationFromFeatures(features, ps)
            expect(result.actions).toHaveLength(1)
            expect(result.actions[0].type).toBe(type)
        })
    })

    it('categorizes damage_bonus with crit trigger as passive', () => {
        const features = [makeFeature({ type: 'damage_bonus', trigger: 'on_critical' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – extra_action group (group 2)', () => {
    it('categorizes heroes_feast as action', () => {
        const features = [makeFeature({ type: 'heroes_feast' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('heroes_feast')
    })

    it('categorizes fey_reinforcements as action', () => {
        const features = [makeFeature({ type: 'fey_reinforcements' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes buff_ally with bonus_action action as bonus action', () => {
        const features = [makeFeature({ type: 'buff_ally', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('categorizes extra_action as action', () => {
        const features = [makeFeature({ type: 'extra_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes free_spell as action', () => {
        const features = [makeFeature({ type: 'free_spell' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – direct action types', () => {
    it('categorizes warding_bond as action', () => {
        const features = [makeFeature({ type: 'warding_bond' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('warding_bond')
    })

    it('categorizes war_magic_cantrip as action', () => {
        const features = [makeFeature({ type: 'war_magic_cantrip' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes war_magic_spell as action', () => {
        const features = [makeFeature({ type: 'war_magic_spell' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes bastion_of_law as action', () => {
        const features = [makeFeature({ type: 'bastion_of_law' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes contact_patron as action', () => {
        const features = [makeFeature({ type: 'contact_patron' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes dragon_companion as action', () => {
        const features = [makeFeature({ type: 'dragon_companion' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes create_thrall as action', () => {
        const features = [makeFeature({ type: 'create_thrall' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes remove_curse as action', () => {
        const features = [makeFeature({ type: 'remove_curse' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes signature_spells as action', () => {
        const features = [makeFeature({ type: 'signature_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes stealth_attack as action', () => {
        const features = [makeFeature({ type: 'stealth_attack' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes primal_companion_command as action', () => {
        const features = [makeFeature({ type: 'primal_companion_command' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes primal_companion_restore as action', () => {
        const features = [makeFeature({ type: 'primal_companion_restore' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – arcane_charge / telekinetic_movement (push twice)', () => {
    it('categorizes arcane_charge as action (pushed twice)', () => {
        const features = [makeFeature({ type: 'arcane_charge' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
    })

    it('categorizes telekinetic_movement as action (pushed twice)', () => {
        const features = [makeFeature({ type: 'telekinetic_movement' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
    })
})

describe('collectAutomationFromFeatures – conditional action/bonus action types', () => {
    it('categorizes guarded_mind as action by default', () => {
        const features = [makeFeature({ type: 'guarded_mind' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(0)
    })

    it('categorizes guarded_mind as bonus action when action is bonus_action', () => {
        const features = [makeFeature({ type: 'guarded_mind', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('categorizes concentration_bonus_attack as bonus action by default', () => {
        const features = [makeFeature({ type: 'concentration_bonus_attack' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes concentration_bonus_attack as bonus action when specified', () => {
        const features = [makeFeature({ type: 'concentration_bonus_attack', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes telekinetic_leap as bonus action by default', () => {
        const features = [makeFeature({ type: 'telekinetic_leap' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes telekinetic_leap as action when not bonus_action', () => {
        const features = [makeFeature({ type: 'telekinetic_leap', action: 'action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes primal_companion_summon as bonus action by default', () => {
        const features = [makeFeature({ type: 'primal_companion_summon' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes primal_companion_summon as action when not bonus_action', () => {
        const features = [makeFeature({ type: 'primal_companion_summon', action: 'action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes clockwork_cavalcade as action by default', () => {
        const features = [makeFeature({ type: 'clockwork_cavalcade' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes clockwork_cavalcade as bonus action when specified', () => {
        const features = [makeFeature({ type: 'clockwork_cavalcade', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes telekinetic_shove as bonus action by default', () => {
        const features = [makeFeature({ type: 'telekinetic_shove' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes telekinetic_shove as action when specified', () => {
        const features = [makeFeature({ type: 'telekinetic_shove', action: 'action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – bonus action types', () => {
    it('categorizes bulwark_of_force as bonus action', () => {
        const features = [makeFeature({ type: 'bulwark_of_force' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes know_enemy as bonus action', () => {
        const features = [makeFeature({ type: 'know_enemy' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes war_bond_summon as bonus action', () => {
        const features = [makeFeature({ type: 'war_bond_summon' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes bonus_action_choice as bonus action', () => {
        const features = [makeFeature({ type: 'bonus_action_choice' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes steady_aim as bonus action', () => {
        const features = [makeFeature({ type: 'steady_aim' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes mage_hand_control as bonus action', () => {
        const features = [makeFeature({ type: 'mage_hand_control' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes fast_hands as bonus action', () => {
        const features = [makeFeature({ type: 'fast_hands' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes steps_of_the_fey as bonus action', () => {
        const features = [makeFeature({ type: 'steps_of_the_fey' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes primal_companion_bonus_action_command as bonus action', () => {
        const features = [makeFeature({ type: 'primal_companion_bonus_action_command' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – reaction types', () => {
    it('categorizes psionic_strike as reaction', () => {
        const features = [makeFeature({ type: 'psionic_strike' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes telekinetic_thrust as reaction', () => {
        const features = [makeFeature({ type: 'telekinetic_thrust' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes glorious_defense as reaction', () => {
        const features = [makeFeature({ type: 'glorious_defense' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes relentless_avenger as reaction', () => {
        const features = [makeFeature({ type: 'relentless_avenger' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes soul_of_vengeance as reaction', () => {
        const features = [makeFeature({ type: 'soul_of_vengeance' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes sentinel_guardian as reaction', () => {
        const features = [makeFeature({ type: 'sentinel_guardian' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes reaction_save as reaction', () => {
        const features = [makeFeature({ type: 'reaction_save' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes reaction_spell as reaction', () => {
        const features = [makeFeature({ type: 'reaction_spell' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes shadowy_dodge as reaction', () => {
        const features = [makeFeature({ type: 'shadowy_dodge' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes misty_escape as reaction', () => {
        const features = [makeFeature({ type: 'misty_escape' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes beguiling_defenses as reaction', () => {
        const features = [makeFeature({ type: 'beguiling_defenses' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes searing_vengeance as reaction', () => {
        const features = [makeFeature({ type: 'searing_vengeance' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes illusory_self as reaction', () => {
        const features = [makeFeature({ type: 'illusory_self' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes superior_hunter_defense as reaction', () => {
        const features = [makeFeature({ type: 'superior_hunter_defense' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes lucky_point as reaction', () => {
        const features = [makeFeature({ type: 'lucky_point' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes spell_thief as reaction', () => {
        const features = [makeFeature({ type: 'spell_thief' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes restore_balance as reaction', () => {
        const features = [makeFeature({ type: 'restore_balance' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
    })

    it('categorizes reaction_damage with psychic_damage_received trigger as passive', () => {
        const features = [makeFeature({ type: 'reaction_damage', trigger: 'psychic_damage_received' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.reactions).toHaveLength(0)
    })
})

describe('collectAutomationFromFeatures – special action types', () => {
    it('categorizes starry_form as special action', () => {
        const features = [makeFeature({ type: 'starry_form' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes twinkling_constellations as special action', () => {
        const features = [makeFeature({ type: 'twinkling_constellations' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes tactical_mind as special action', () => {
        const features = [makeFeature({ type: 'tactical_mind' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes living_legend as special action', () => {
        const features = [makeFeature({ type: 'living_legend' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes cloak_of_shadows as special action', () => {
        const features = [makeFeature({ type: 'cloak_of_shadows' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes holy_nimbus as special action', () => {
        const features = [makeFeature({ type: 'holy_nimbus' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes holy_aura as special action', () => {
        const features = [makeFeature({ type: 'holy_aura' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes avenging_angel as special action', () => {
        const features = [makeFeature({ type: 'avenging_angel' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes elder_champion as special action', () => {
        const features = [makeFeature({ type: 'elder_champion' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes large_form as special action', () => {
        const features = [makeFeature({ type: 'large_form' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes celestial_resilience as special action', () => {
        const features = [makeFeature({ type: 'celestial_resilience' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes revelation_in_flesh as special action', () => {
        const features = [makeFeature({ type: 'revelation_in_flesh' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes peerless_athlete as special action', () => {
        const features = [makeFeature({ type: 'peerless_athlete' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes transe_of_order as special action', () => {
        const features = [makeFeature({ type: 'transe_of_order' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes dragon_wings as special action', () => {
        const features = [makeFeature({ type: 'dragon_wings' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes clairvoyant_combatant as special action', () => {
        const features = [makeFeature({ type: 'clairvoyant_combatant' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes celestial_revelation as special action', () => {
        const features = [makeFeature({ type: 'celestial_revelation' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes elfish_lineage as special action', () => {
        const features = [makeFeature({ type: 'elfish_lineage' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes gnomish_lineage as special action', () => {
        const features = [makeFeature({ type: 'gnomish_lineage' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes fiendish_legacy as special action', () => {
        const features = [makeFeature({ type: 'fiendish_legacy' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

    it('categorizes portent as special action', () => {
        const features = [makeFeature({ type: 'portent' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })

})

describe('collectAutomationFromFeatures – passive types', () => {
    it('categorizes land_resistance as passive', () => {
        const features = [makeFeature({ type: 'land_resistance' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes psionic_sorcery as passive', () => {
        const features = [makeFeature({ type: 'psionic_sorcery' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes psionic_spells_list as passive', () => {
        const features = [makeFeature({ type: 'psionic_spells_list' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes psychic_spells as passive', () => {
        const features = [makeFeature({ type: 'psychic_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes healing_bonus as passive', () => {
        const features = [makeFeature({ type: 'healing_bonus' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes survive_and_heal as passive', () => {
        const features = [makeFeature({ type: 'survive_and_heal' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes post_cast_ally_heal as passive', () => {
        const features = [makeFeature({ type: 'post_cast_ally_heal' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes post_cast_smite_cover as passive', () => {
        const features = [makeFeature({ type: 'post_cast_smite_cover' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes post_cast_inspiring_smite as passive', () => {
        const features = [makeFeature({ type: 'post_cast_inspiring_smite' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes moonlight_step_rider as passive', () => {
        const features = [makeFeature({ type: 'moonlight_step_rider' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes damage_type_modifier as passive', () => {
        const features = [makeFeature({ type: 'damage_type_modifier' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes weapon_mastery_choice as passive', () => {
        const features = [makeFeature({ type: 'weapon_mastery_choice' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes shadow_step_rider as passive', () => {
        const features = [makeFeature({ type: 'shadow_step_rider' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes holy_nimbus_radiant_damage as passive', () => {
        const features = [makeFeature({ type: 'holy_nimbus_radiant_damage' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes umbral_sight as passive', () => {
        const features = [makeFeature({ type: 'umbral_sight' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes naturally_stealthy as passive', () => {
        const features = [makeFeature({ type: 'naturally_stealthy' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes cantrip_spellcasting_ability as passive', () => {
        const features = [makeFeature({ type: 'cantrip_spellcasting_ability' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes dark_ones_blessing as passive', () => {
        const features = [makeFeature({ type: 'dark_ones_blessing' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes dark_ones_look as passive', () => {
        const features = [makeFeature({ type: 'dark_ones_look' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes hunter_prey as passive', () => {
        const features = [makeFeature({ type: 'hunter_prey' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes defensive_tactics as passive', () => {
        const features = [makeFeature({ type: 'defensive_tactics' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes superior_hunter_prey as passive', () => {
        const features = [makeFeature({ type: 'superior_hunter_prey' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes stroke_of_luck as passive', () => {
        const features = [makeFeature({ type: 'stroke_of_luck' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes modify_d20_roll as passive', () => {
        const features = [makeFeature({ type: 'modify_d20_roll' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes supreme_sneak as passive', () => {
        const features = [makeFeature({ type: 'supreme_sneak' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes save_proficiency as passive', () => {
        const features = [makeFeature({ type: 'save_proficiency' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes damage_type_choice as passive', () => {
        const features = [makeFeature({ type: 'damage_type_choice' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes radiant_soul as passive', () => {
        const features = [makeFeature({ type: 'radiant_soul' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes hurl_through_hell as passive', () => {
        const features = [makeFeature({ type: 'hurl_through_hell' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes create_thrall_temp_hp as passive', () => {
        const features = [makeFeature({ type: 'create_thrall_temp_hp' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes sentinel as passive', () => {
        const features = [makeFeature({ type: 'sentinel' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes potent_cantrip as passive', () => {
        const features = [makeFeature({ type: 'potent_cantrip' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes soulstitch_spells as passive', () => {
        const features = [makeFeature({ type: 'soulstitch_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes empowered_evocation as passive', () => {
        const features = [makeFeature({ type: 'empowered_evocation' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes improved_illusions as passive', () => {
        const features = [makeFeature({ type: 'improved_illusions' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes overchannel as passive', () => {
        const features = [makeFeature({ type: 'overchannel' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes pass_without_trace as passive', () => {
        const features = [makeFeature({ type: 'pass_without_trace' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes phantasmal_creatures as passive', () => {
        const features = [makeFeature({ type: 'phantasmal_creatures' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes primal_companion_double_strike as passive', () => {
        const features = [makeFeature({ type: 'primal_companion_double_strike' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes primal_companion_spell_share as passive', () => {
        const features = [makeFeature({ type: 'primal_companion_spell_share' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes primal_companion_dodge as passive', () => {
        const features = [makeFeature({ type: 'primal_companion_dodge' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – passive_rule sub-types', () => {
    it('categorizes passive_rule with superior_defense effect as special action', () => {
        const features = [makeFeature({ type: 'supreme_sneak', effect: 'supreme_sneak' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes passive_rule with ritual_spells effect in ritualSpells', () => {
        const features = [makeFeature({ type: 'ritual_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.ritualSpells).toHaveLength(1)
    })

    it('categorizes passive_rule with tavern_brawler_reroll_ones as passive', () => {
        const features = [makeFeature({ type: 'tavern_brawler_reroll_ones' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – use_magic_device (passive + special)', () => {
    it('categorizes use_magic_device as both passive and special action', () => {
        const features = [makeFeature({ type: 'use_magic_device' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.specialActions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – psychic_teleportation (auto_effect with effect)', () => {
    it('categorizes auto_effect with psychic_teleportation as bonus action', () => {
        const features = [makeFeature({ type: 'auto_effect', effect: 'psychic_teleportation' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.passives).toHaveLength(0)
    })
})

describe('collectAutomationFromFeatures – combat_superiority', () => {
    it('categorizes combat_superiority with oncePerTurn as action', () => {
        const features = [makeFeature({ type: 'combat_superiority', oncePerTurn: true })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.specialActions).toHaveLength(0)
    })

    it('categorizes combat_superiority without oncePerTurn as special action', () => {
        const features = [makeFeature({ type: 'combat_superiority' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })
})

describe('collectAutomationFromFeatures – misty_wanderer', () => {
    it('categorizes misty_wanderer with bonus action casting_time as bonus action', () => {
        const features = [makeFeature({ type: 'misty_wanderer', casting_time: '1 bonus action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('categorizes misty_wanderer with action casting_time as action', () => {
        const features = [makeFeature({ type: 'misty_wanderer', casting_time: '1 action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(0)
    })
})

describe('collectAutomationFromFeatures – cosmic_omen', () => {
    it('categorizes cosmic_omen with bonus action casting_time as bonus action', () => {
        const features = [makeFeature({ type: 'cosmic_omen', casting_time: '1 bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes cosmic_omen with action casting_time as action', () => {
        const features = [makeFeature({ type: 'cosmic_omen' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – illusory_reality', () => {
    it('categorizes illusory_reality with bonus action casting_time as bonus action', () => {
        const features = [makeFeature({ type: 'illusory_reality', casting_time: '1 bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes illusory_reality with action casting_time as action', () => {
        const features = [makeFeature({ type: 'illusory_reality', casting_time: '1 action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – lesser_restoration', () => {
    it('categorizes lesser_restoration with bonus action casting_time as bonus action', () => {
        const features = [makeFeature({ type: 'lesser_restoration', casting_time: '1 bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes lesser_restoration with action casting_time as action', () => {
        const features = [makeFeature({ type: 'lesser_restoration', casting_time: '1 action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – protection_from_poison', () => {
    it('categorizes protection_from_poison with bonus action as bonus action', () => {
        const features = [makeFeature({ type: 'protection_from_poison', casting_time: '1 bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes protection_from_poison with action as action', () => {
        const features = [makeFeature({ type: 'protection_from_poison' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – attack_rider variants', () => {
    it('categorizes attack_rider with chooseOne as passive', () => {
        const features = [makeFeature({ type: 'attack_rider', chooseOne: true })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('categorizes attack_rider with maxEffects > 1 as passive', () => {
        const features = [makeFeature({ type: 'attack_rider', maxEffects: 2 })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes attack_rider with oncePerTurn and passive casting_time as passive', () => {
        const features = [makeFeature({ type: 'attack_rider', oncePerTurn: true, casting_time: 'passive' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes attack_rider with trigger as passive', () => {
        const features = [makeFeature({ type: 'attack_rider', trigger: 'after_hit' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes plain attack_rider without options as action', () => {
        const features = [makeFeature({ type: 'attack_rider' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

describe('collectAutomationFromFeatures – unknown type (default)', () => {
    it('categorizes unknown type as special action', () => {
        const features = [makeFeature({ type: 'unknown_type' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(0)
    })
})

describe('collectAutomationFromFeatures – edge cases with automation arrays', () => {
    it('handles array of automations on a feature', () => {
        const features = [{
            name: 'Dual Feature',
            automation: [
                { type: 'warding_bond' },
                { type: 'bulwark_of_force' },
            ]
        }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('warding_bond')
        expect(result.bonusActions).toHaveLength(1)
        expect(result.bonusActions[0].type).toBe('bulwark_of_force')
    })
})

describe('processFeatureAutomation – additional edge cases', () => {
    it('handles all empty arrays', () => {
        const { processFeatureAutomation } = require('./automationCollector.js')
        const result = processFeatureAutomation([], [], [], [], ps)
        expect(result.actions).toEqual([])
        expect(result.bonusActions).toEqual([])
        expect(result.reactions).toEqual([])
        expect(result.specialActions).toEqual([])
        expect(result.passives).toEqual([])
    })

    it('does not add duplicate wrappers for same-named features', () => {
        const { processFeatureAutomation } = require('./automationCollector.js')
        const actions = [{ name: 'Test', automation: { type: 'warding_bond' } }]
        const bonusActions = []
        const reactions = []
        const specialActions = [{ name: 'Test', automation: { type: 'warding_bond' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
    })
})
