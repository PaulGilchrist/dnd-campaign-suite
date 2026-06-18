import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

const ps = makePlayerStats()

// ── Types in DISPATCH but not matched by any switch case (→ default → specialActions) ──
describe('collectAutomationFromFeatures – dispatch-only types (default → specialActions)', () => {
    const specialDefaultTypes = [
        'damage_modifier',
        'wild_magic_surge',
        'wild_magic_tamed',
        'reaction_counterspell',
    ]
    specialDefaultTypes.forEach(type => {
        it(`categorizes ${type} as specialAction (default)`, () => {
            const features = [makeFeature({ type })]
            const result = collectAutomationFromFeatures(features, ps)
            expect(result.specialActions).toHaveLength(1)
            expect(result.specialActions[0].type).toBe(type)
        })
    })
})

// ── Types in DISPATCH that are handler-transformed and NOT in switch (→ default → specialActions) ──
// (These handlers change their type to a switch-matched type, so they go to the right bucket)
describe('collectAutomationFromFeatures – handler-transformed types to matched switch cases', () => {
    it('categorizes great_weapon_fighting → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'great_weapon_fighting' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('great_weapon_fighting')
    })

    it('categorizes two_weapon_fighting → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'two_weapon_fighting' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('two_weapon_fighting')
    })

    it('categorizes reroll_damage_once_per_turn → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'reroll_damage_once_per_turn' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('reroll_damage_once_per_turn')
    })

    it('categorizes ignore_resistance → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'ignore_resistance' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('ignore_resistance')
    })

    it('categorizes concentration_disadvantage_on_damage_dealt → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'concentration_disadvantage_on_damage_dealt' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('concentration_disadvantage_on_damage_dealt')
    })

    it('categorizes otherworldly_glamour → passive_buff → passive', () => {
        const features = [makeFeature({ type: 'otherworldly_glamour' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('otherworldly_glamour')
    })

    it('categorizes feats_of_chaos → conditional_advantage → passive', () => {
        const features = [makeFeature({ type: 'feats_of_chaos' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('conditional_advantage')
    })

    it('categorizes heroic_inspiration_buff → buff_ally → action', () => {
        const features = [makeFeature({ type: 'heroic_inspiration_buff' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('buff_ally')
    })

    it('categorizes warping_implosion → save_attack → action', () => {
        const features = [makeFeature({ type: 'warping_implosion' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('save_attack')
    })

    it('categorizes sacred_weapon → temp_buff → specialAction', () => {
        const features = [makeFeature({ type: 'sacred_weapon' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
        expect(result.specialActions[0].type).toBe('temp_buff')
        expect(result.specialActions[0].effect).toBe('sacred_weapon')
    })

    it('categorizes spell_breaker → passive_rule → passive', () => {
        const features = [makeFeature({ type: 'spell_breaker' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('spell_breaker')
    })

    it('categorizes third_eye → bonus_action_choice → bonus action', () => {
        const features = [makeFeature({ type: 'third_eye' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.bonusActions[0].type).toBe('bonus_action_choice')
    })
})

// ── Types in switch but NOT in DISPATCH (buildAttackInfo returns null → skipped) ──
describe('collectAutomationFromFeatures – switch types not in DISPATCH (skipped)', () => {
    const switchOnlyTypes = [
        'hypnotic_pattern',
        'mass_suggestion',
        'suggestion',
        'slow',
        'magical_cunning',
        'abjuration_savant',
        'divination_savant',
        'evocation_savant',
        'illusion_savant',
        'arcane_ward',
        'projected_ward',
        'magic_initiate',
        'expert_divination',
        'magical_ambush',
        'versatile_trickster',
        'web_area_save',
    ]
    switchOnlyTypes.forEach(type => {
        it(`skips ${type} (not in DISPATCH, buildAttackInfo returns null)`, () => {
            const features = [makeFeature({ type })]
            const result = collectAutomationFromFeatures(features, ps)
            expect(result.specialActions).toHaveLength(0)
            expect(result.actions).toHaveLength(0)
            expect(result.bonusActions).toHaveLength(0)
            expect(result.reactions).toHaveLength(0)
            expect(result.passives).toHaveLength(0)
        })
    })

    it('skips damage type without special source/feat conditions', () => {
        const features = [makeFeature({ type: 'damage' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(0)
        expect(result.actions).toHaveLength(0)
    })
})

// ── Types in both DISPATCH and switch but not yet tested ──
describe('collectAutomationFromFeatures – untested switch-matched types', () => {
    it('categorizes bewitching_magic as passive', () => {
        const features = [makeFeature({ type: 'bewitching_magic' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('bewitching_magic')
    })
})

// ── Crit trigger routing (only for types whose handler preserves trigger) ──
describe('collectAutomationFromFeatures – crit trigger routing', () => {
    it('categorizes damage_bonus with crit trigger as passive', () => {
        const features = [makeFeature({ type: 'damage_bonus', trigger: 'on_critical' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('damage_bonus')
    })



    it('categorizes save_attack with bonus_action action as bonus action', () => {
        const features = [makeFeature({ type: 'save_attack', action: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })
})

// ── processFeatureAutomation edge cases ──
describe('processFeatureAutomation – additional edge cases', () => {
    it('adds wrappers for actions-categorized features from allReactions', () => {
        const actions = []
        const bonusActions = []
        const reactions = [{ name: 'React Feature', automation: { type: 'attack_rider' } }]
        const specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
        expect(actions[0].name).toBe('React Feature')
    })

    it('does not add wrapper when different-named feature already exists', () => {
        const actions = [{ name: 'Existing', automation: { type: 'auto_effect', effect: 'x' } }]
        const bonusActions = [{ name: 'New Feature', automation: { type: 'save_attack', action: 'action' } }]
        processFeatureAutomation(actions, bonusActions, [], [], ps)
        expect(actions).toHaveLength(2)
    })

    it('preserves original arrays unmodified except allActions', () => {
        const actions = []
        const bonusActions = [{ name: 'BA', automation: { type: 'save_attack', action: 'action' } }]
        const reactions = [{ name: 'React', automation: { type: 'save_attack', action: 'action' } }]
        const specialActions = [{ name: 'Special', automation: { type: 'attack_rider' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(bonusActions).toHaveLength(1)
        expect(reactions).toHaveLength(1)
        expect(specialActions).toHaveLength(1)
    })

    it('processFeatureAutomation ritualSpells from combined features', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = [{
            name: 'Ritual Caster',
            automation: { type: 'passive_rule', effect: 'ritual_spells' }
        }]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.ritualSpells[0].effect).toBe('ritual_spells')
    })

    it('processFeatureAutomation primalKnowledge from passive_rule primal_knowledge effect', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = [{
            name: 'Primal Knowledge',
            automation: {
                type: 'passive_rule',
                effect: 'primal_knowledge',
                skills: [{ skill: 'athletics' }, { skill: 'survival' }]
            }
        }]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result.primalKnowledge).toHaveLength(2)
        expect(result.primalKnowledge[0].skill).toBe('athletics')
        expect(result.primalKnowledge[1].skill).toBe('survival')
    })
})

// ── collectAutomationFromFeatures – passive_rule sub-type routing ──
describe('collectAutomationFromFeatures – passive_rule sub-type routing', () => {
    it('categorizes passive_rule with superior_defense as specialAction', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'superior_defense' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
        expect(result.specialActions[0].effect).toBe('superior_defense')
    })

    it('categorizes passive_rule with grapple_damage as specialAction', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'grapple_damage' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.specialActions).toHaveLength(1)
        expect(result.specialActions[0].effect).toBe('grapple_damage')
    })

    it('categorizes passive_rule with tavern_brawler_push as passive', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'tavern_brawler_push' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('tavern_brawler_push')
    })

    it('categorizes passive_rule with no_melee_disadvantage_crossbows as passive', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('no_melee_disadvantage_crossbows')
    })

    it('categorizes passive_rule with ritual_spells effect in ritualSpells', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'ritual_spells' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.ritualSpells[0].effect).toBe('ritual_spells')
        expect(result.passives).toHaveLength(0)
        expect(result.specialActions).toHaveLength(0)
    })

    it('categorizes passive_rule with primal_knowledge effect in passives + primalKnowledge', () => {
        const features = [makeFeature({
            type: 'passive_rule',
            effect: 'primal_knowledge',
            skills: [{ skill: 'arcana' }]
        })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.primalKnowledge).toHaveLength(1)
        expect(result.primalKnowledge[0].skill).toBe('arcana')
    })

    it('categorizes passive_rule with other effect as passive', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'some_other_effect' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('some_other_effect')
    })

    it('categorizes passive_rule with tavern_brawler_reroll_ones as passive', () => {
        const features = [makeFeature({ type: 'passive_rule', effect: 'tavern_brawler_reroll_ones' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('tavern_brawler_reroll_ones')
    })
})

// ── collectTurnStartEffects – remaining edge cases ──
describe('collectTurnStartEffects – remaining edge cases', () => {
    it('handles feature with array automation containing null entries', () => {
        const features = [{
            name: 'Mixed',
            automation: [
                null,
                { type: 'holy_nimbus' },
                undefined,
            ]
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('holy_nimbus_radiant_damage')
    })

    it('handles feature with automation that has non-passive_rule type', () => {
        const features = [{
            name: 'Steady Aim',
            automation: { type: 'steady_aim' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('steady_aim_clear')
    })

    it('collects nothing when conditions are missing for condition_removal', () => {
        const features = [{
            name: 'No Conditions',
            automation: {
                type: 'passive_rule',
                effect: 'end_of_turn_condition_removal',
            }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(0)
    })

    it('collects nothing for unknown automation type', () => {
        const features = [{
            name: 'Unknown',
            automation: { type: 'completely_unknown_type', effect: 'xyz' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(0)
    })

    it('handles features where automation is a non-array object with non-passive_rule types', () => {
        const features = [{
            name: 'Precise Hunter',
            automation: { type: 'precise_hunter' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('precise_hunter')
    })
})

// ── collectAutomationFromFeatures – cosmic_omen alternative casting_time formats ──
describe('collectAutomationFromFeatures – cosmic_omen alternative casting_time formats', () => {
    it('categorizes cosmic_omen with casting_time bonus_action as bonus action', () => {
        const features = [makeFeature({ type: 'cosmic_omen', casting_time: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes cosmic_omen with 1 action casting_time as action', () => {
        const features = [makeFeature({ type: 'cosmic_omen', casting_time: '1 action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

// ── collectAutomationFromFeatures – misty_wanderer alternative casting_time ──
describe('collectAutomationFromFeatures – misty_wanderer alternative casting_time', () => {
    it('categorizes misty_wanderer with bonus_action as bonus action', () => {
        const features = [makeFeature({ type: 'misty_wanderer', casting_time: 'bonus_action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('categorizes misty_wanderer with 1 action as action', () => {
        const features = [makeFeature({ type: 'misty_wanderer', casting_time: '1 action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
    })
})

// ── collectAutomationFromFeatures – illusory_reality 1 bonus action variant ──
describe('collectAutomationFromFeatures – illusory_reality 1 bonus action variant', () => {
    it('categorizes illusory_reality with casting_time "1 bonus action" as bonus action', () => {
        const features = [makeFeature({ type: 'illusory_reality', casting_time: '1 bonus action' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.bonusActions).toHaveLength(1)
    })
})

// ── collectAutomationFromFeatures – auto_effect effect-based routing ──
describe('collectAutomationFromFeatures – auto_effect effect-based routing', () => {
    it('categorizes auto_effect with non-psychic_teleportation effect as passive', () => {
        const features = [makeFeature({ type: 'auto_effect', effect: 'something_else' })]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(0)
    })
})

// ── collectAutomationFromFeatures – damage type variations ──
describe('collectAutomationFromFeatures – damage type with special conditions', () => {
    it('categorizes damage type with great_weapon_fighting conditions as passive', () => {
        const features = [{
            name: 'GWF',
            type: 'damage',
            source: 'feat',
            automation: { type: 'great_weapon_fighting' }
        }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('great_weapon_fighting')
    })

    it('categorizes damage type with two_weapon_fighting conditions as passive', () => {
        const features = [{
            name: 'TWF',
            type: 'two_weapon_fighting',
            source: 'feat',
            automation: { type: 'two_weapon_fighting' }
        }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('two_weapon_fighting')
    })
})
