// @maintained-by-ai
// Home of the automationRouter type→bucket breadth matrix — per the family map in
// automationCollector.coverage.test.js ("router bucket tables → automationCollector.types.test.js").
// Fixtures are synthetic shapes pinning dispatch machinery, not disk content from public/data.
//
// ATTACK_RIDER_OWNER-SPLIT-VERDICT (#2089): automationService.js:5 is a PURE re-export of
// './automationCollector.js', so automationService.collection.test.js:196-210 executes the exact
// same collectAutomationFromFeatures call chain as the attack_rider predicate table below — same
// function, same code path, and that batch (trigger/chooseOne/maxEffects → passives) is a strict
// subset of this matrix, which additionally pins oncePerTurn+passive → passives, plain → actions,
// and per-row bucket exclusivity. Canonical import: direct './automationCollector.js' (here).
// Removal of automationService.collection.test.js:196-210 is the reported rec for its queue turn.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

const ps = makePlayerStats()

const ROUTED_BUCKETS = ['actions', 'bonusActions', 'reactions', 'specialActions', 'passives', 'autoEffects', 'saveModifiers', 'primalKnowledge', 'ritualSpells']

// Full routing envelope: every bucket asserted at once — the row(s) appear in the expected
// bucket(s) and NOWHERE ELSE. Catches the ROUTES fallback (specialActions), a double-push,
// and a lost row, all in one assertion.
function expectRouted(automation, expected = {}) {
    const result = collectAutomationFromFeatures([makeFeature(automation)], ps)
    const allBuckets = Object.fromEntries(ROUTED_BUCKETS.map(b => [b, []]))
    expect(Object.fromEntries(ROUTED_BUCKETS.map(b => [b, result[b].map(r => r.type)])))
        .toEqual({ ...allBuckets, ...expected })
}

function expectRoutedAll(automationType) {
    expectRouted({ type: automationType }, { actions: [automationType] })
}

// ── pushTo('actions') direct types ──

describe('collectAutomationFromFeatures – direct action types', () => {
    const actionTypes = [
        'warding_bond', 'war_magic_cantrip', 'war_magic_spell',
        'bastion_of_law', 'contact_patron', 'dragon_companion',
        'remove_curse', 'stealth_attack',
        'primal_companion_command', 'primal_companion_restore',
    ]

    it.each(actionTypes)('routes %s to actions only', expectRoutedAll)
})

// ── routeSaveStyle: save-based spells (plus critical-trigger → passives) ──

describe('collectAutomationFromFeatures – save-style routing', () => {
    const spellTypes = [
        'flesh_to_stone', 'hold_monster', 'resilient_sphere',
        'ottos_dance', 'power_word_stun', 'sleep',
        'stinking_cloud', 'tashas_laughter',
    ]

    it.each(spellTypes)('routes %s to actions only', expectRoutedAll)

    it('routes damage_bonus with a critical trigger to passives, not actions', () => {
        expectRouted({ type: 'damage_bonus', trigger: 'on_critical' }, { passives: ['damage_bonus'] })
    })
})

// ── routeCtPassiveBonusOrAction: default branch → actions ──

describe('collectAutomationFromFeatures – casting_time bonus-or-action family', () => {
    const types = ['extra_action', 'free_spell', 'heroes_feast', 'fey_reinforcements']

    it.each(types)('routes %s (no casting_time) to actions only', expectRoutedAll)
})

// ── routeBonusByAction: action-field conditional ──

describe('collectAutomationFromFeatures – action-field conditional types', () => {
    it.each([
        { type: 'guarded_mind', defaultBucket: 'actions', overrideVal: 'bonus_action', overrideBucket: 'bonusActions' },
        { type: 'concentration_bonus_attack', defaultBucket: 'bonusActions', overrideVal: null, overrideBucket: null },
        { type: 'telekinetic_leap', defaultBucket: 'bonusActions', overrideVal: 'action', overrideBucket: 'actions' },
        { type: 'primal_companion_summon', defaultBucket: 'bonusActions', overrideVal: 'action', overrideBucket: 'actions' },
        { type: 'clockwork_cavalcade', defaultBucket: 'actions', overrideVal: 'bonus_action', overrideBucket: 'bonusActions' },
        { type: 'telekinetic_shove', defaultBucket: 'bonusActions', overrideVal: 'action', overrideBucket: 'actions' },
    ])('routes $type: default → $defaultBucket, action:$overrideVal → $overrideBucket', ({ type, defaultBucket, overrideVal, overrideBucket }) => {
        expectRouted({ type }, { [defaultBucket]: [type] })
        if (overrideBucket) {
            expectRouted({ type, action: overrideVal }, { [overrideBucket]: [type] })
        }
    })

    it('routes trance_of_order with action bonus_action to bonusActions only', () => {
        expectRouted({ type: 'trance_of_order', action: 'bonus_action' }, { bonusActions: ['trance_of_order'] })
    })
})

// ── pushTo('bonusActions') types ──

describe('collectAutomationFromFeatures – bonus action types', () => {
    const bonusActionTypes = [
        'bulwark_of_force', 'know_enemy', 'war_bond_summon',
        'bonus_action_choice', 'steady_aim', 'mage_hand_control',
        'fast_hands', 'steps_of_the_fey', 'primal_companion_bonus_action_command',
    ]

    it.each(bonusActionTypes)('routes %s to bonusActions only', (type) => {
        expectRouted({ type }, { bonusActions: [type] })
    })
})

// ── pushTo('reactions') types ──

describe('collectAutomationFromFeatures – reaction types', () => {
    const reactionTypes = [
        'psionic_strike', 'telekinetic_thrust', 'glorious_defense',
        'relentless_avenger', 'soul_of_vengeance', 'sentinel_guardian',
        'reaction_save', 'reaction_spell', 'reaction_damage', 'shadowy_dodge',
        'beguiling_defenses', 'searing_vengeance', 'illusory_self',
        'superior_hunter_defense', 'lucky_point', 'spell_thief', 'restore_balance',
    ]

    it.each(reactionTypes)('routes %s to reactions only', (type) => {
        expectRouted({ type }, { reactions: [type] })
    })
})

// ── pushTo('specialActions') types ──

describe('collectAutomationFromFeatures – special action types', () => {
    const specialActionTypes = [
        // avenging_angel's info builder normalizes the row type to temp_buff —
        // pin the routed row's actual builder fingerprint, not the authoring type.
        { type: 'starry_form', rowType: 'starry_form' }, { type: 'twinkling_constellations', rowType: 'twinkling_constellations' }, { type: 'tactical_mind', rowType: 'tactical_mind' },
        { type: 'living_legend', rowType: 'living_legend' }, { type: 'cloak_of_shadows', rowType: 'cloak_of_shadows' }, { type: 'holy_nimbus', rowType: 'holy_nimbus' }, { type: 'holy_aura', rowType: 'holy_aura' },
        { type: 'avenging_angel', rowType: 'temp_buff' }, { type: 'elder_champion', rowType: 'elder_champion' }, { type: 'large_form', rowType: 'large_form' },
        { type: 'celestial_resilience', rowType: 'celestial_resilience' }, { type: 'revelation_in_flesh', rowType: 'revelation_in_flesh' }, { type: 'peerless_athlete', rowType: 'peerless_athlete' },
        { type: 'dragon_wings', rowType: 'dragon_wings' }, { type: 'clairvoyant_combatant', rowType: 'clairvoyant_combatant' }, { type: 'create_thrall', rowType: 'create_thrall' },
        { type: 'celestial_revelation', rowType: 'celestial_revelation' }, { type: 'elfish_lineage', rowType: 'elfish_lineage' }, { type: 'gnomish_lineage', rowType: 'gnomish_lineage' },
        { type: 'fiendish_legacy', rowType: 'fiendish_legacy' }, { type: 'portent', rowType: 'portent' }, { type: 'signature_spells', rowType: 'signature_spells' },
    ]

    it.each(specialActionTypes)('routes %s to specialActions only', ({ type, rowType }) => {
        expectRouted({ type }, { specialActions: [rowType] })
    })
})

// ── passive routes: exclusive, dual-bucket, and effect-conditional ──

describe('collectAutomationFromFeatures – passive types', () => {
    const passiveTypes = [
        'land_resistance', 'psionic_sorcery', 'psionic_spells_list', 'psychic_spells',
        'survive_and_heal',
        'shadow_step_rider',
        'cantrip_spellcasting_ability',
        'dark_ones_blessing', 'dark_ones_luck',
        'superior_hunter_prey', 'stroke_of_luck',
        'save_proficiency',
        'damage_type_choice', 'radiant_soul', 'hurl_through_hell',
        'create_thrall_temp_hp', 'sentinel', 'potent_cantrip',
        'soulstitch_spells', 'empowered_evocation', 'improved_illusions',
        'overchannel', 'pass_without_trace', 'phantasmal_creatures',
        'primal_companion_double_strike', 'primal_companion_spell_share',
        'primal_companion_dodge', 'auto_effect',
    ]

    it.each(passiveTypes)('routes %s to passives only', (type) => {
        expectRouted({ type }, { passives: [type] })
    })

    // These builders normalize the info row type to 'passive_rule' — the author
    // type→bucket dispatch is still pinned (removing the route would fall through
    // to the specialActions default and change the buckets).
    it.each([
        ['umbral_sight', { passives: ['passive_rule'] }],
        ['naturally_stealthy', { passives: ['passive_rule'] }],
        ['supreme_sneak', { passives: ['passive_rule'] }],
        // builder emits effect 'bonus_healing' → routePassiveRule double-pushes
        ['healing_bonus', { passives: ['passive_rule'], specialActions: ['passive_rule'] }],
    ])('routes %s (builder-normalized row) to $expected', (type, expected) => {
        expectRouted({ type }, expected)
    })

    // routePassiveSpecial members land in BOTH buckets — pinned per row.
    it.each([
        'post_cast_ally_heal', 'post_cast_smite_cover', 'post_cast_inspiring_smite',
        'moonlight_step_rider', 'damage_type_modifier', 'weapon_mastery_choice',
        'use_magic_device',
    ])('routes %s to passives AND specialActions', (type) => {
        expectRouted({ type }, { passives: [type], specialActions: [type] })
    })

    it('routes auto_effect psychic_teleportation to bonusActions instead of passives', () => {
        expectRouted({ type: 'auto_effect', effect: 'psychic_teleportation' }, { bonusActions: ['auto_effect'] })
    })
})

// ── passive_rule effect-conditional routing (routePassiveRule branches) ──

describe('collectAutomationFromFeatures – passive_rule effect routing', () => {
    it.each([
        { effect: 'ritual_spells', expected: { ritualSpells: ['passive_rule'] } },
        { effect: 'superior_defense', expected: { specialActions: ['passive_rule'] } },
        { effect: 'bonus_healing', expected: { specialActions: ['passive_rule'], passives: ['passive_rule'] } },
    ])('routes passive_rule effect $effect', ({ effect, expected }) => {
        expectRouted({ type: 'passive_rule', effect }, expected)
    })

    it('pre-router SPECIAL_AUTOMATIONS: arcane_apotheosis emits its exact passive row and nothing else', () => {
        const result = collectAutomationFromFeatures([{
            name: 'Arcane Apotheosis',
            automation: { type: 'passive_rule', effect: 'arcane_apotheosis', condition: 'innate_sorcery_active', casting_time: 'passive' },
        }], ps)
        expect(result.passives).toEqual([{
            type: 'passive_rule',
            name: 'Arcane Apotheosis',
            effect: 'arcane_apotheosis',
            hasAutomation: true,
        }])
        expect(result.actions).toEqual([])
        expect(result.specialActions).toEqual([])
    })
})

// ── casting_time-conditional routes: full branch coverage per helper ──

describe('collectAutomationFromFeatures – casting_time conditional routing', () => {
    it.each([
        // routeModifyD20Roll: reaction / bonus / passive / builder default is '1 reaction'
        { automation: { type: 'modify_d20_roll', casting_time: '1 reaction' }, expected: { reactions: ['modify_d20_roll'] } },
        { automation: { type: 'modify_d20_roll', casting_time: '1 bonus action' }, expected: { bonusActions: ['modify_d20_roll'] } },
        { automation: { type: 'modify_d20_roll', casting_time: 'passive' }, expected: { passives: ['modify_d20_roll'] } },
        { automation: { type: 'modify_d20_roll' }, expected: { reactions: ['modify_d20_roll'] } },
        // routeMistyWanderer: passive / bonus / action
        { automation: { type: 'misty_wanderer', casting_time: 'passive' }, expected: { specialActions: ['misty_wanderer'] } },
        { automation: { type: 'misty_wanderer', casting_time: '1 bonus action' }, expected: { bonusActions: ['misty_wanderer'] } },
        { automation: { type: 'misty_wanderer', casting_time: '1 action' }, expected: { actions: ['misty_wanderer'] } },
        // routeCosmicOmen: bonus / reaction / action (raw authoring strings, un-sanitized)
        { automation: { type: 'cosmic_omen', casting_time: '1 bonus_action' }, expected: { bonusActions: ['cosmic_omen'] } },
        { automation: { type: 'cosmic_omen', casting_time: '1 reaction' }, expected: { reactions: ['cosmic_omen'] } },
        { automation: { type: 'cosmic_omen', casting_time: '1 action' }, expected: { actions: ['cosmic_omen'] } },
        // routeBonusByCt family: bonus vs action/default
        { automation: { type: 'illusory_reality', casting_time: '1 bonus_action' }, expected: { bonusActions: ['illusory_reality'] } },
        { automation: { type: 'illusory_reality', casting_time: '1 action' }, expected: { actions: ['illusory_reality'] } },
        { automation: { type: 'lesser_restoration', casting_time: '1 bonus_action' }, expected: { bonusActions: ['lesser_restoration'] } },
        { automation: { type: 'lesser_restoration', casting_time: '1 action' }, expected: { actions: ['lesser_restoration'] } },
        { automation: { type: 'protection_from_poison', casting_time: '1 bonus_action' }, expected: { bonusActions: ['protection_from_poison'] } },
        { automation: { type: 'protection_from_poison' }, expected: { actions: ['protection_from_poison'] } },
    ])('$automation.type $automation.casting_time → $expected', ({ automation, expected }) => {
        expectRouted(automation, expected)
    })
})

// ── routeAttackRider predicate: one row per disjunct, distinct fingerprints ──

describe('collectAutomationFromFeatures – attack_rider predicate routing', () => {
    it.each([
        { automation: { type: 'attack_rider', chooseOne: true } },
        { automation: { type: 'attack_rider', maxEffects: 2 } },
        { automation: { type: 'attack_rider', oncePerTurn: true, casting_time: 'passive' } },
        { automation: { type: 'attack_rider', trigger: 'after_hit' } },
    ])('routes attack_rider $automation to passives only', ({ automation }) => {
        expectRouted(automation, { passives: ['attack_rider'] })
    })

    it('routes plain attack_rider (no predicate hit) to actions only', () => {
        expectRouted({ type: 'attack_rider' }, { actions: ['attack_rider'] })
    })
})

// ── routeCombatSuperiority: oncePerTurn seam ──

describe('collectAutomationFromFeatures – combat_superiority oncePerTurn routing', () => {
    it('routes oncePerTurn combat_superiority to actions only', () => {
        expectRouted({ type: 'combat_superiority', oncePerTurn: true }, { actions: ['combat_superiority'] })
    })

    it('routes combat_superiority without oncePerTurn to specialActions only', () => {
        expectRouted({ type: 'combat_superiority' }, { specialActions: ['combat_superiority'] })
    })
})

// ── CLA-357 regression: the router used to push these rows TWICE (sheet
// name-dedupe hid the dupe) — one action per feature is truth. ──

describe('collectAutomationFromFeatures – CLA-357 single-row regression', () => {
    it.each(['arcane_charge', 'telekinetic_movement'])('routes exactly one %s action row', expectRoutedAll)
})

// ── Contact Patron (CLA-061) regression ──

describe('collectAutomationFromFeatures – Contact Patron (CLA-061)', () => {
    it('collects both free_spell action and contact_patron_auto_save passive from array automation', () => {
        const contactPatronFeature = {
            name: 'Contact Patron',
            description: 'You always have the Contact Other Plane spell prepared. With this feature, you can cast the spell without expending a spell slot to contact your patron, and you automatically succeed on the spell\'s saving throw. Once you cast the spell with this feature, you can\'t do so in this way again until you finish a Long Rest.',
            level: 9,
            type: 'class_feature',
            automation: [
                {
                    type: 'free_spell',
                    spell: 'Contact Other Plane',
                    uses_expression: '1',
                    recharge: 'long_rest',
                    action: 'action',
                    casting_time: '1 minute or Ritual',
                },
                {
                    type: 'passive_rule',
                    effect: 'contact_patron_auto_save',
                    casting_time: 'passive',
                },
            ],
        }

        const result = collectAutomationFromFeatures([contactPatronFeature], ps)

        // free_spell should be in actions
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('free_spell')
        expect(result.actions[0].spell).toBe('Contact Other Plane')
        expect(result.actions[0].uses).toBe(1)
        expect(result.actions[0].usesMax).toBe(1)
        expect(result.actions[0].uses_expression).toBe('1')

        // contact_patron_auto_save should be in passives
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('passive_rule')
        expect(result.passives[0].effect).toBe('contact_patron_auto_save')
        expect(result.passives[0].name).toBe('Contact Patron')
        expect(result.passives[0].hasAutomation).toBe(true)
    })
})
