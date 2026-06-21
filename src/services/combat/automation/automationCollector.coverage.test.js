// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

const ps = makePlayerStats()

// ── collectAutomationFromFeatures – null/undefined safety ──
describe('collectAutomationFromFeatures – null/undefined safety', () => {
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
            ritualSpells: []
        })
    })

    it('returns empty result structure when features is undefined', () => {
        const result = collectAutomationFromFeatures(undefined, ps)
        expect(result.actions).toHaveLength(0)
    })

    it('skips features with null automation', () => {
        const features = [{ name: 'No Auto', automation: null }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(0)
    })

    it('skips features with undefined automation', () => {
        const features = [{ name: 'No Auto', automation: undefined }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(0)
    })

    it('skips features with no automation property', () => {
        const features = [{ name: 'No Auto' }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(0)
    })
})

// ── collectAutomationFromFeatures – dispatch-only types (default → specialActions) ──
describe('collectAutomationFromFeatures – dispatch-only types route to specialActions', () => {
    const dispatchOnlyTypes = [
        'damage_modifier',
        'wild_magic_surge',
        'wild_magic_tamed',
        'reaction_counterspell',
    ]

    dispatchOnlyTypes.forEach(type => {
        it(`routes ${type} to specialActions`, () => {
            const result = collectAutomationFromFeatures([makeFeature({ type })], ps)
            expect(result.specialActions).toHaveLength(1)
            expect(result.specialActions[0].type).toBe(type)
        })
    })
})

// ── collectAutomationFromFeatures – handler-transformed types ──
describe('collectAutomationFromFeatures – handler-transformed types route correctly', () => {
    const handlerTests = [
        { type: 'great_weapon_fighting', bucket: 'passives', check: (item) => expect(item.effect).toBe('great_weapon_fighting') },
        { type: 'two_weapon_fighting', bucket: 'passives', check: (item) => expect(item.effect).toBe('two_weapon_fighting') },
        { type: 'reroll_damage_once_per_turn', bucket: 'passives', check: (item) => expect(item.effect).toBe('reroll_damage_once_per_turn') },
        { type: 'ignore_resistance', bucket: 'passives', check: (item) => expect(item.effect).toBe('ignore_resistance') },
        { type: 'concentration_disadvantage_on_damage_dealt', bucket: 'passives', check: (item) => expect(item.effect).toBe('concentration_disadvantage_on_damage_dealt') },
        { type: 'otherworldly_glamour', bucket: 'passives', check: (item) => expect(item.effect).toBe('otherworldly_glamour') },
        { type: 'feats_of_chaos', bucket: 'passives', check: (item) => expect(item.type).toBe('conditional_advantage') },
        { type: 'heroic_inspiration_buff', bucket: 'actions', check: (item) => expect(item.type).toBe('buff_ally') },
        { type: 'warping_implosion', bucket: 'actions', check: (item) => expect(item.type).toBe('save_attack') },
        { type: 'sacred_weapon', bucket: 'specialActions', check: (item) => { expect(item.type).toBe('temp_buff'); expect(item.effect).toBe('sacred_weapon') } },
        { type: 'spell_breaker', bucket: 'passives', check: (item) => expect(item.effect).toBe('spell_breaker') },
        { type: 'third_eye', bucket: 'bonusActions', check: (item) => expect(item.type).toBe('bonus_action_choice') },
    ]

    handlerTests.forEach(({ type, bucket, check }) => {
        it(`routes ${type} to ${bucket}`, () => {
            const result = collectAutomationFromFeatures([makeFeature({ type })], ps)
            expect(result[bucket]).toHaveLength(1)
            check(result[bucket][0])
        })
    })
})

// ── collectAutomationFromFeatures – switch-matched types not in DISPATCH are skipped ──
describe('collectAutomationFromFeatures – switch-matched types not in DISPATCH are skipped', () => {
    const skippedTypes = [
        'hypnotic_pattern',
        'mass_suggestion',
        'suggestion',
        'slow',
        'magical_cunning',
        'abjuration_savant',
        'divination_savant',
        'evocation_savant',
        'illusion_savant',
        'magic_initiate',
        'magical_ambush',
        'versatile_trickster',
        'web_area_save',
    ]

    skippedTypes.forEach(type => {
        it(`skips ${type} (no handler in DISPATCH)`, () => {
            const result = collectAutomationFromFeatures([makeFeature({ type })], ps)
            expect(result.actions).toHaveLength(0)
            expect(result.bonusActions).toHaveLength(0)
            expect(result.reactions).toHaveLength(0)
            expect(result.specialActions).toHaveLength(0)
            expect(result.passives).toHaveLength(0)
        })
    })

    it('skips damage type without special source/feat conditions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'damage' })], ps)
        expect(result.specialActions).toHaveLength(0)
        expect(result.actions).toHaveLength(0)
    })
})

// ── collectAutomationFromFeatures – switch-matched types with coverage ──
describe('collectAutomationFromFeatures – switch-matched types with coverage', () => {
    it('routes bewitching_magic to passives', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'bewitching_magic' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('bewitching_magic')
    })

    it('routes damage_bonus with crit trigger to passives', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'damage_bonus', trigger: 'on_critical' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('damage_bonus')
    })

    it('routes save_attack with bonus_action to bonusActions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'save_attack', action: 'bonus_action' })], ps)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.actions).toHaveLength(0)
    })

    it('routes cosmic_omen with bonus_action casting_time to bonusActions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'cosmic_omen', casting_time: 'bonus_action' })], ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('routes cosmic_omen with "1 action" casting_time to actions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'cosmic_omen', casting_time: '1 action' })], ps)
        expect(result.actions).toHaveLength(1)
    })

    it('routes misty_wanderer with bonus_action casting_time to bonusActions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'misty_wanderer', casting_time: 'bonus_action' })], ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('routes misty_wanderer with "1 action" casting_time to actions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'misty_wanderer', casting_time: '1 action' })], ps)
        expect(result.actions).toHaveLength(1)
    })

    it('routes illusory_reality with "1 bonus action" casting_time to bonusActions', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'illusory_reality', casting_time: '1 bonus action' })], ps)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('routes auto_effect with non-psychic_teleportation effect to passives', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'auto_effect', effect: 'something_else' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(0)
    })

    it('routes damage with great_weapon_fighting conditions to passives', () => {
        const feature = { name: 'GWF', type: 'damage', source: 'feat', automation: { type: 'great_weapon_fighting' } }
        const result = collectAutomationFromFeatures([feature], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('great_weapon_fighting')
    })

    it('routes damage with two_weapon_fighting conditions to passives', () => {
        const feature = { name: 'TWF', type: 'two_weapon_fighting', source: 'feat', automation: { type: 'two_weapon_fighting' } }
        const result = collectAutomationFromFeatures([feature], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('two_weapon_fighting')
    })
})

// ── collectAutomationFromFeatures – passive_rule sub-type routing ──
describe('collectAutomationFromFeatures – passive_rule sub-type routing', () => {
    const passiveRuleTests = [
        { effect: 'superior_defense', bucket: 'specialActions', field: 'effect' },
        { effect: 'grapple_damage', bucket: 'specialActions', field: 'effect' },
        { effect: 'tavern_brawler_push', bucket: 'passives', field: 'effect' },
        { effect: 'no_melee_disadvantage_crossbows', bucket: 'passives', field: 'effect' },
        { effect: 'tavern_brawler_reroll_ones', bucket: 'passives', field: 'effect' },
        { effect: 'some_other_effect', bucket: 'passives', field: 'effect' },
    ]

    passiveRuleTests.forEach(({ effect, bucket, field }) => {
        it(`routes passive_rule ${effect} to ${bucket}`, () => {
            const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect })], ps)
            expect(result[bucket]).toHaveLength(1)
            expect(result[bucket][0][field]).toBe(effect)
        })
    })

    it('routes passive_rule ritual_spells to ritualSpells bucket', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect: 'ritual_spells' })], ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.passives).toHaveLength(0)
        expect(result.specialActions).toHaveLength(0)
    })

    it('routes passive_rule primal_knowledge to passives and primalKnowledge', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'arcana' }] })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.primalKnowledge).toHaveLength(1)
        expect(result.primalKnowledge[0].skill).toBe('arcana')
    })
})

// ── collectTurnStartEffects – null/undefined safety ──
describe('collectTurnStartEffects – null/undefined safety', () => {
    it('returns empty array when features is null', () => {
        expect(collectTurnStartEffects(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
        expect(collectTurnStartEffects(undefined)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        expect(collectTurnStartEffects([])).toEqual([])
    })

    it('skips features with no automation property', () => {
        const result = collectTurnStartEffects([{ name: 'No Auto' }])
        expect(result).toEqual([])
    })

    it('skips features with null automation', () => {
        const result = collectTurnStartEffects([{ name: 'No Auto', automation: null }])
        expect(result).toEqual([])
    })
})

// ── collectTurnStartEffects – feature automation types ──
describe('collectTurnStartEffects – feature automation types', () => {
    it('handles feature with array automation containing null/undefined entries', () => {
        const features = [{
            name: 'Mixed',
            automation: [null, { type: 'holy_nimbus' }, undefined]
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('holy_nimbus_radiant_damage')
    })

    it('handles feature with single object automation', () => {
        const features = [{ name: 'Single', automation: { type: 'steady_aim' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('steady_aim_clear')
    })

    it('routes passive_rule heroic_inspiration_turn_start to heroic_inspiration effect', () => {
        const features = [{ name: 'Heroic', automation: { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('heroic_inspiration')
    })

    it('routes passive_rule end_of_turn_condition_removal with conditions to condition_removal', () => {
        const features = [{
            name: 'Cleanse',
            automation: {
                type: 'passive_rule',
                effect: 'end_of_turn_condition_removal',
                conditions: ['Frightened', 'Stunned']
            }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('condition_removal')
        expect(result[0].conditions).toEqual(['frightened', 'stunned'])
    })

    it('skips end_of_turn_condition_removal when conditions array is empty', () => {
        const features = [{
            name: 'Empty Conditions',
            automation: {
                type: 'passive_rule',
                effect: 'end_of_turn_condition_removal',
            }
        }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('routes passive_rule superior_defense with default cost', () => {
        const features = [{ name: 'Superior', automation: { type: 'passive_rule', effect: 'superior_defense' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('superior_defense')
        expect(result[0].cost).toBe(3)
    })

    it('routes passive_rule superior_defense with custom cost', () => {
        const features = [{ name: 'Superior', automation: { type: 'passive_rule', effect: 'superior_defense', cost: 5 } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].cost).toBe(5)
    })

    it('routes passive_rule flurry_healing_harm with default usesExpression', () => {
        const features = [{ name: 'Flurry', automation: { type: 'passive_rule', effect: 'flurry_healing_harm' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].usesExpression).toBe('WIS modifier minimum 1')
    })

    it('routes passive_rule dread_ambush_speed with default bonusExpression', () => {
        const features = [{ name: 'Dread', automation: { type: 'passive_rule', effect: 'dread_ambush_speed' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].bonusExpression).toBe('10')
    })

    it('routes passive_rule create_thrall_temp_hp with default tempHpExpression', () => {
        const features = [{ name: 'Thrall', automation: { type: 'passive_rule', effect: 'create_thrall_temp_hp' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].tempHpExpression).toBe('warlock level + CHA modifier')
    })

    it('routes passive_rule ignore_loading_crossbows with default weapons', () => {
        const features = [{ name: 'Crossbow', automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].weapons).toEqual([])
    })

    it('routes passive_rule arcane_ward with defaults', () => {
        const features = [{ name: 'Ward', automation: { type: 'passive_rule', effect: 'arcane_ward' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].wardHpExpression).toBe('')
        expect(result[0].wardRestoreExpression).toBe('')
        expect(result[0].bonusActionRestore).toBe(false)
    })

    it('routes passive_rule arcane_ward with bonusActionRestore enabled', () => {
        const features = [{ name: 'Ward', automation: { type: 'passive_rule', effect: 'arcane_ward', bonusActionRestore: true } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].bonusActionRestore).toBe(true)
    })

    it('routes passive_rule projected_ward with default range', () => {
        const features = [{ name: 'Projected', automation: { type: 'passive_rule', effect: 'projected_ward' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].range).toBe(30)
        expect(result[0].reaction).toBe(true)
    })

    it('routes passive_rule spell_breaker with defaults', () => {
        const features = [{ name: 'Breaker', automation: { type: 'passive_rule', effect: 'spell_breaker' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].alwaysPreparedSpells).toEqual([])
        expect(result[0].bonusActionSpells).toEqual([])
        expect(result[0].dispelAbilityCheckBonus).toBe('')
        expect(result[0].slotRetentionSpells).toEqual([])
    })

    it('routes phantasmal_creatures type with defaults', () => {
        const features = [{ name: 'Phantasmal', automation: { type: 'phantasmal_creatures' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('phantasmal_creatures')
        expect(result[0].alwaysPreparedSpells).toEqual([])
        expect(result[0].freeCastSpells).toEqual([])
        expect(result[0].usesMax).toBe(1)
        expect(result[0].halvesHp).toBe(false)
    })

    it('routes healing_start_of_turn with defaults', () => {
        const features = [{ name: 'Heal', automation: { type: 'healing_start_of_turn' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].healExpression).toBe('1')
        expect(result[0].bodyPartRegrowMinutes).toBe(2)
    })

    it('routes third_eye with default duration', () => {
        const features = [{ name: 'Third Eye', automation: { type: 'third_eye' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].duration).toBe('short_or_long_rest')
    })

    it('routes damage_aura Inner Radiance with defaults', () => {
        const features = [{ name: 'Inner Radiance', automation: { type: 'damage_aura' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].damageExpression).toBe('proficiency_bonus')
        expect(result[0].damageType).toBe('Radiant')
        expect(result[0].range).toBe('10_ft')
    })

    it('routes use_magic_device with default attunementLimit', () => {
        const features = [{ name: 'UMD', automation: { type: 'use_magic_device' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].attunementLimit).toBe(4)
    })

    it('routes unknown automation type to empty result', () => {
        const features = [{ name: 'Unknown', automation: { type: 'completely_unknown_type', effect: 'xyz' } }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('routes precise_hunter to precise_hunter effect', () => {
        const features = [{ name: 'Precise Hunter', automation: { type: 'precise_hunter' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('precise_hunter')
    })

    it('routes elder_champion to elder_champion_regeneration with default heal', () => {
        const features = [{ name: 'Elder', automation: { type: 'elder_champion' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].healExpression).toBe('10')
    })

    it('routes living_legend to living_legend_turn_start', () => {
        const features = [{ name: 'Legend', automation: { type: 'living_legend' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].type).toBe('living_legend_turn_start')
    })

    it('routes radiant_soul to radiant_soul_turn_start', () => {
        const features = [{ name: 'Radiant', automation: { type: 'radiant_soul' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].type).toBe('radiant_soul_turn_start')
    })

    it('routes hunter_lore to hunter_lore', () => {
        const features = [{ name: 'Lore', automation: { type: 'hunter_lore' } }]
        const result = collectTurnStartEffects(features)
        expect(result[0].type).toBe('hunter_lore')
    })
})

// ── processFeatureAutomation – wrapper injection and idempotency ──
describe('processFeatureAutomation – wrapper injection and idempotency', () => {
    it('wraps actions-categorized features from allReactions', () => {
        const actions = []
        const bonusActions = []
        const reactions = [{ name: 'React Feature', automation: { type: 'attack_rider' } }]
        const specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
        expect(actions[0].name).toBe('React Feature')
    })

    it('wraps actions-categorized features from allSpecialActions', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = [{ name: 'Special Action', automation: { type: 'save_attack', action: 'action' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
        expect(actions[0].name).toBe('Special Action')
    })

    it('wraps specialActions-categorized features from allSpecialActions', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = [{ name: 'Special', automation: { type: 'attack_rider' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(specialActions).toHaveLength(1)
        expect(specialActions[0].name).toBe('Special')
    })

    it('does not duplicate when a feature with the same name already exists in actions', () => {
        const actions = [{ name: 'Existing', automation: { type: 'auto_effect', effect: 'x' } }]
        const bonusActions = []
        const reactions = [{ name: 'Existing', automation: { type: 'attack_rider' } }]
        const specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
    })

    it('preserves original arrays unmodified except for injected wrappers', () => {
        const actions = []
        const bonusActions = [{ name: 'BA', automation: { type: 'save_attack', action: 'action' } }]
        const reactions = [{ name: 'React', automation: { type: 'save_attack', action: 'action' } }]
        const specialActions = [{ name: 'Special', automation: { type: 'attack_rider' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(bonusActions).toHaveLength(1)
        expect(reactions).toHaveLength(1)
        expect(specialActions).toHaveLength(1)
    })

    it('extracts ritualSpells from passive_rule automation', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = [{ name: 'Ritual Caster', automation: { type: 'passive_rule', effect: 'ritual_spells' } }]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.ritualSpells[0].effect).toBe('ritual_spells')
    })

    it('extracts primalKnowledge from passive_rule primal_knowledge effect', () => {
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

    it('returns the automation object from collectAutomationFromFeatures', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = []
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result).toHaveProperty('actions')
        expect(result).toHaveProperty('bonusActions')
        expect(result).toHaveProperty('reactions')
        expect(result).toHaveProperty('specialActions')
        expect(result).toHaveProperty('passives')
    })

    it('handles null/undefined arrays gracefully', () => {
        const result = processFeatureAutomation(null, null, null, null, ps)
        expect(result).toBeDefined()
        expect(result.actions).toEqual([])
    })

    it('handles empty arrays without error', () => {
        const actions = []
        const bonusActions = []
        const reactions = []
        const specialActions = []
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result).toBeDefined()
        expect(result.actions).toEqual([])
    })
})
