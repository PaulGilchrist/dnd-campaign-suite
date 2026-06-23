// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

const ps = makePlayerStats()

// ── Null safety ──────────────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – null safety', () => {
    it('returns empty result structure when features is null', () => {
        const result = collectAutomationFromFeatures(null, ps)
        expect(result).toEqual({
            actions: [],
            bonusActions: [],
            reactions: [],
            specialActions: [],
            passives: [],
            autoEffects: [],
            saveModifiers: [],
            primalKnowledge: [],
            ritualSpells: [],
        })
    })

    it('returns empty result structure when features is undefined', () => {
        const result = collectAutomationFromFeatures(undefined, ps)
        expect(result.actions).toEqual([])
        expect(result.bonusActions).toEqual([])
        expect(result.reactions).toEqual([])
        expect(result.specialActions).toEqual([])
        expect(result.passives).toEqual([])
    })

    it('skips features with no automation property', () => {
        const features = [{ name: 'No Automation' }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toEqual([])
        expect(result.passives).toEqual([])
    })

    it('skips features with null automation', () => {
        const features = [{ name: 'Null Automation', automation: null }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toEqual([])
    })

    it('skips features with undefined automation', () => {
        const features = [{ name: 'Undefined Automation', automation: undefined }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toEqual([])
    })
})

// ── Automation object structure ──────────────────────────────────────────────

describe('collectAutomationFromFeatures – automation object structure', () => {
    it('returns automation objects with type and name properties', () => {
        const features = [makeFeature({ type: 'warding_bond' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        const automation = result.actions[0]
        expect(automation).toHaveProperty('type', 'warding_bond')
        expect(automation).toHaveProperty('name')
    })

    it('preserves the feature name in the automation object', () => {
        const features = [makeFeature({ type: 'warding_bond' }, 'Shield Bond')]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions[0].name).toBe('Shield Bond')
    })
})

// ── Actions group 1 – spells / save types ───────────────────────────────────

describe('collectAutomationFromFeatures – actions group 1 (spells/save types)', () => {
    const spellTypes = [
        'flesh_to_stone', 'hold_monster', 'resilient_sphere',
        'ottos_dance', 'power_word_stun', 'sleep',
        'stinking_cloud', 'tashas_laughter',
    ]

    it.each(spellTypes)('categorizes %s as an action', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe(type)
    })

    it('categorizes damage_bonus with crit trigger as passive instead of action', () => {
        const features = [makeFeature({ type: 'damage_bonus', trigger: 'on_critical' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })
})

// ── Actions group 2 – extra_action family ────────────────────────────────────

describe('collectAutomationFromFeatures – actions group 2 (extra_action family)', () => {
    it('categorizes heroes_feast as an action', () => {
        const features = [makeFeature({ type: 'heroes_feast' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('heroes_feast')
    })

    it('categorizes fey_reinforcements as an action', () => {
        const features = [makeFeature({ type: 'fey_reinforcements' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })

    it('categorizes buff_ally as bonus action when action is bonus_action', () => {
        const features = [makeFeature({ type: 'buff_ally', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('categorizes extra_action and free_spell as actions', () => {
        const features = [
            makeFeature({ type: 'extra_action' }),
            makeFeature({ type: 'free_spell' }),
        ]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
    })
})

// ── Direct action types ─────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – direct action types', () => {
    const actionTypes = [
        'warding_bond', 'war_magic_cantrip', 'war_magic_spell',
        'bastion_of_law', 'contact_patron', 'dragon_companion',
        'create_thrall', 'remove_curse', 'stealth_attack',
        'primal_companion_command', 'primal_companion_restore',
    ]

    it.each(actionTypes)('categorizes %s as an action', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe(type)
    })

    it('categorizes signature_spells as a special action', () => {
        const features = [makeFeature({ type: 'signature_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
        expect(result.specialActions[0].type).toBe('signature_spells')
    })
})

// ── Push-twice types (arcane_charge / telekinetic_movement) ─────────────────

describe('collectAutomationFromFeatures – push-twice types', () => {
    it('categorizes arcane_charge as two actions', () => {
        const features = [makeFeature({ type: 'arcane_charge' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
        expect(result.actions.every(a => a.type === 'arcane_charge')).toBe(true)
    })

    it('categorizes telekinetic_movement as two actions', () => {
        const features = [makeFeature({ type: 'telekinetic_movement' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
    })
})

// ── Conditional action / bonus action types ──────────────────────────────────

describe('collectAutomationFromFeatures – conditional action/bonus action types', () => {
    const conditionalTypes = [
        { type: 'guarded_mind', defaultCat: 'actions', override: 'bonusActions', overrideVal: 'bonus_action' },
        { type: 'concentration_bonus_attack', defaultCat: 'bonusActions', override: null, overrideVal: null },
        { type: 'telekinetic_leap', defaultCat: 'bonusActions', override: 'actions', overrideVal: 'action' },
        { type: 'primal_companion_summon', defaultCat: 'bonusActions', override: 'actions', overrideVal: 'action' },
        { type: 'clockwork_cavalcade', defaultCat: 'actions', override: 'bonusActions', overrideVal: 'bonus_action' },
        { type: 'telekinetic_shove', defaultCat: 'bonusActions', override: 'actions', overrideVal: 'action' },
    ]

    it.each(conditionalTypes)('categorizes $type: default → $defaultCat, override → $overrideCat', ({ type, defaultCat, override: overrideCat, overrideVal }) => {
        // Default categorization
        const defaultResult = collectAutomationFromFeatures([makeFeature({ type })], ps)
        expect(defaultResult[defaultCat]).toHaveLength(1)
        if (overrideCat) {
            const overrideResult = collectAutomationFromFeatures([makeFeature({ type, action: overrideVal })], ps)
            expect(overrideResult[overrideCat]).toHaveLength(1)
            expect(defaultResult[overrideCat]).toHaveLength(0)
        }
    })
})

// ── Bonus action types ──────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – bonus action types', () => {
    const bonusActionTypes = [
        'bulwark_of_force', 'know_enemy', 'war_bond_summon',
        'bonus_action_choice', 'steady_aim', 'mage_hand_control',
        'fast_hands', 'steps_of_the_fey', 'primal_companion_bonus_action_command',
    ]

    it.each(bonusActionTypes)('categorizes %s as a bonus action', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.bonusActions[0].type).toBe(type)
    })
})

// ── Reaction types ──────────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – reaction types', () => {
    const reactionTypes = [
        'psionic_strike', 'telekinetic_thrust', 'glorious_defense',
        'relentless_avenger', 'soul_of_vengeance', 'sentinel_guardian',
        'reaction_save', 'reaction_spell', 'shadowy_dodge', 'misty_escape',
        'beguiling_defenses', 'searing_vengeance', 'illusory_self',
        'superior_hunter_defense', 'lucky_point', 'spell_thief', 'restore_balance',
    ]

    it.each(reactionTypes)('categorizes %s as a reaction', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.reactions).toHaveLength(1)
        expect(result.reactions[0].type).toBe(type)
    })

    it('categorizes reaction_damage with psychic_damage_received trigger as passive', () => {
        const features = [makeFeature({ type: 'reaction_damage', trigger: 'psychic_damage_received' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.reactions).toHaveLength(0)
    })
})

// ── Special action types ────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – special action types', () => {
    const specialActionTypes = [
        'starry_form', 'twinkling_constellations', 'tactical_mind',
        'living_legend', 'cloak_of_shadows', 'holy_nimbus', 'holy_aura',
        'avenging_angel', 'elder_champion', 'large_form',
        'celestial_resilience', 'revelation_in_flesh', 'peerless_athlete',
        'transe_of_order', 'dragon_wings', 'clairvoyant_combatant',
        'celestial_revelation', 'elfish_lineage', 'gnomish_lineage',
        'fiendish_legacy', 'portent',
    ]

    it.each(specialActionTypes)('categorizes %s as a special action', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
    })
})

// ── Passive types ───────────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – passive types', () => {
    const passiveTypes = [
        'land_resistance', 'psionic_sorcery', 'psionic_spells_list', 'psychic_spells',
        'healing_bonus', 'survive_and_heal', 'post_cast_ally_heal',
        'post_cast_smite_cover', 'post_cast_inspiring_smite',
        'moonlight_step_rider', 'damage_type_modifier', 'weapon_mastery_choice',
        'shadow_step_rider', 'holy_nimbus_radiant_damage', 'umbral_sight',
        'naturally_stealthy', 'cantrip_spellcasting_ability',
        'dark_ones_blessing', 'dark_ones_look', 'hunter_prey',
        'defensive_tactics', 'superior_hunter_prey', 'stroke_of_luck',
        'modify_d20_roll', 'supreme_sneak', 'save_proficiency',
        'damage_type_choice', 'radiant_soul', 'hurl_through_hell',
        'create_thrall_temp_hp', 'sentinel', 'potent_cantrip',
        'soulstitch_spells', 'empowered_evocation', 'improved_illusions',
        'overchannel', 'pass_without_trace', 'phantasmal_creatures',
        'primal_companion_double_strike', 'primal_companion_spell_share',
        'primal_companion_dodge',
    ]

    it.each(passiveTypes)('categorizes %s as a passive', (type) => {
        const features = [makeFeature({ type })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })
})

// ── Passive rule sub-types ──────────────────────────────────────────────────

describe('collectAutomationFromFeatures – passive_rule sub-types', () => {
    it('categorizes passive_rule with superior_defense effect as special action', () => {
        const features = [makeFeature({ type: 'supreme_sneak', effect: 'supreme_sneak' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })

    it('categorizes passive_rule with ritual_spells effect in ritualSpells', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'ritual_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.ritualSpells).toHaveLength(1)
    })

    it('categorizes passive_rule with tavern_brawler_reroll_ones as passive', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'tavern_brawler_reroll_ones' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
    })
})

// ── Multi-category types ────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – multi-category types', () => {
    it('categorizes use_magic_device as both passive and special action', () => {
        const features = [makeFeature({ type: 'use_magic_device' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.specialActions).toHaveLength(1)
    })
})

// ── Auto effect with effect property ────────────────────────────────────────

describe('collectAutomationFromFeatures – auto_effect with effect property', () => {
    it('categorizes auto_effect with psychic_teleportation as bonus action', () => {
        const features = [makeFeature({ type: 'auto_effect', effect: 'psychic_teleportation' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.passives).toHaveLength(0)
    })
})

// ── Conditional flags (combat_superiority) ──────────────────────────────────

describe('collectAutomationFromFeatures – combat_superiority conditional', () => {
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

// ── Casting time conditional types ──────────────────────────────────────────

describe('collectAutomationFromFeatures – casting_time conditional types', () => {
    it('categorizes misty_wanderer by casting_time', () => {
        const bonusResult = collectAutomationFromFeatures([makeFeature({ type: 'misty_wanderer', casting_time: '1 bonus action' })], ps)
        expect(bonusResult.bonusActions).toHaveLength(1)
        expect(bonusResult.actions).toHaveLength(0)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'misty_wanderer', casting_time: '1 action' })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.bonusActions).toHaveLength(0)
    })

    it('categorizes cosmic_omen by casting_time', () => {
        const bonusResult = collectAutomationFromFeatures([makeFeature({ type: 'cosmic_omen', casting_time: '1 bonus_action' })], ps)
        expect(bonusResult.bonusActions).toHaveLength(1)
        expect(bonusResult.actions).toHaveLength(0)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'cosmic_omen' })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.bonusActions).toHaveLength(0)
    })

    it('categorizes illusory_reality by casting_time', () => {
        const bonusResult = collectAutomationFromFeatures([makeFeature({ type: 'illusory_reality', casting_time: '1 bonus_action' })], ps)
        expect(bonusResult.bonusActions).toHaveLength(1)
        expect(bonusResult.actions).toHaveLength(0)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'illusory_reality', casting_time: '1 action' })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.bonusActions).toHaveLength(0)
    })

    it('categorizes lesser_restoration by casting_time', () => {
        const bonusResult = collectAutomationFromFeatures([makeFeature({ type: 'lesser_restoration', casting_time: '1 bonus_action' })], ps)
        expect(bonusResult.bonusActions).toHaveLength(1)
        expect(bonusResult.actions).toHaveLength(0)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'lesser_restoration', casting_time: '1 action' })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.bonusActions).toHaveLength(0)
    })

    it('categorizes protection_from_poison by casting_time', () => {
        const bonusResult = collectAutomationFromFeatures([makeFeature({ type: 'protection_from_poison', casting_time: '1 bonus_action' })], ps)
        expect(bonusResult.bonusActions).toHaveLength(1)
        expect(bonusResult.actions).toHaveLength(0)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'protection_from_poison' })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.bonusActions).toHaveLength(0)
    })
})

// ── Attack rider conditional types ──────────────────────────────────────────

describe('collectAutomationFromFeatures – attack_rider conditional types', () => {
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

// ── Array automations ───────────────────────────────────────────────────────

describe('collectAutomationFromFeatures – array automations', () => {
    it('handles array of automations on a single feature', () => {
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

    it('handles multiple features each with array automations', () => {
        const features = [
            { name: 'F1', automation: [{ type: 'warding_bond' }, { type: 'sleep' }] },
            { name: 'F2', automation: [{ type: 'psionic_strike' }] },
        ]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
        expect(result.reactions).toHaveLength(1)
    })

    it('handles mixed single and array automations', () => {
        const features = [
            { name: 'Single', automation: { type: 'warding_bond' } },
            { name: 'Array', automation: [{ type: 'sleep' }, { type: 'psionic_strike' }] },
        ]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(2)
        expect(result.reactions).toHaveLength(1)
    })
})

// ── processFeatureAutomation edge cases ─────────────────────────────────────

describe('processFeatureAutomation – edge cases', () => {
    let processFeatureAutomation

    beforeAll(async () => {
        const mod = await import('./automationCollector.js')
        processFeatureAutomation = mod.processFeatureAutomation
    })

    it('handles all empty arrays', () => {
        const result = processFeatureAutomation([], [], [], [], ps)
        expect(result.actions).toEqual([])
        expect(result.bonusActions).toEqual([])
        expect(result.reactions).toEqual([])
        expect(result.specialActions).toEqual([])
        expect(result.passives).toEqual([])
    })

    it('does not add duplicate wrappers for same-named features', () => {
        const actions = [{ name: 'Test', automation: { type: 'warding_bond' } }]
        const bonusActions = []
        const reactions = []
        const specialActions = [{ name: 'Test', automation: { type: 'warding_bond' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
    })
})
