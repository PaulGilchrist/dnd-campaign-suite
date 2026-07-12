// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

const ps = makePlayerStats()

// ── collectAutomationFromFeatures – null/undefined safety (consolidated) ──

describe('collectAutomationFromFeatures – null/undefined safety', () => {
    it('returns empty result structure when features is null', () => {
        const result = collectAutomationFromFeatures(null, ps)
        expect(result).toEqual({
            actions: [], bonusActions: [], reactions: [], specialActions: [],
            passives: [], autoEffects: [], saveModifiers: [], primalKnowledge: [], ritualSpells: []
        })
    })

    it('returns empty arrays when features is undefined', () => {
        const result = collectAutomationFromFeatures(undefined, ps)
        expect(result.actions).toHaveLength(0)
    })

    it('skips features with null, undefined, or missing automation', () => {
        const features = [
            { name: 'No Auto' },
            { name: 'Null Auto', automation: null },
            { name: 'Undefined Auto', automation: undefined }
        ]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.passives).toHaveLength(0)
    })
})

// ── collectAutomationFromFeatures – handler dispatch correctness ──

describe('collectAutomationFromFeatures – handler dispatch', () => {
    it('routes dispatch-only types to specialActions', () => {
        const result = collectAutomationFromFeatures([
            makeFeature({ type: 'damage_modifier' }),
            makeFeature({ type: 'wild_magic_surge' }),
            makeFeature({ type: 'wild_magic_tamed' }),
            makeFeature({ type: 'reaction_counterspell' }),
        ], ps)
        expect(result.specialActions).toHaveLength(4)
    })

    it('routes handler-transformed types to their correct buckets', () => {
        const checks = [
            { type: 'great_weapon_fighting', bucket: 'passives', check: (item) => expect(item.effect).toBe('great_weapon_fighting') },
            { type: 'two_weapon_fighting', bucket: 'passives', check: (item) => expect(item.effect).toBe('two_weapon_fighting') },
            { type: 'reroll_damage_once_per_turn', bucket: 'passives', check: (item) => expect(item.effect).toBe('reroll_damage_once_per_turn') },
            { type: 'ignore_resistance', bucket: 'passives', check: (item) => expect(item.effect).toBe('ignore_resistance') },
            { type: 'feats_of_chaos', bucket: 'passives', check: (item) => expect(item.type).toBe('conditional_advantage') },
            { type: 'heroic_inspiration_buff', bucket: 'actions', check: (item) => expect(item.type).toBe('buff_ally') },
            { type: 'warping_implosion', bucket: 'actions', check: (item) => expect(item.type).toBe('save_attack') },
            { type: 'sacred_weapon', bucket: 'specialActions', check: (item) => { expect(item.type).toBe('temp_buff'); expect(item.effect).toBe('sacred_weapon') } },
            { type: 'third_eye', bucket: 'bonusActions', check: (item) => expect(item.type).toBe('bonus_action_choice') },
        ]

        for (const { type, bucket, check } of checks) {
            const result = collectAutomationFromFeatures([makeFeature({ type })], ps)
            expect(result[bucket]).toHaveLength(1)
            check(result[bucket][0])
        }
    })

    it('routes casting_time-conditional types correctly', () => {
        const mistyResult = collectAutomationFromFeatures([
            makeFeature({ type: 'misty_wanderer', casting_time: 'bonus_action' }),
            makeFeature({ type: 'misty_wanderer', casting_time: '1 action' }),
        ], ps)
        expect(mistyResult.bonusActions).toHaveLength(1)
        expect(mistyResult.actions).toHaveLength(1)

        const cosmicResult = collectAutomationFromFeatures([
            makeFeature({ type: 'cosmic_omen', casting_time: '1 bonus_action' }),
            makeFeature({ type: 'cosmic_omen', casting_time: '1 reaction' }),
            makeFeature({ type: 'cosmic_omen', casting_time: '1 action' }),
        ], ps)
        expect(cosmicResult.bonusActions).toHaveLength(1)
        expect(cosmicResult.reactions).toHaveLength(1)
        expect(cosmicResult.actions).toHaveLength(1)
    })

    it('routes conditional trigger types correctly', () => {
        const critResult = collectAutomationFromFeatures([
            makeFeature({ type: 'damage_bonus', trigger: 'on_critical' }),
        ], ps)
        expect(critResult.passives).toHaveLength(1)
        expect(critResult.actions).toHaveLength(0)

        const psychicResult = collectAutomationFromFeatures([
            makeFeature({ type: 'reaction_damage', trigger: 'psychic_damage_received' }),
        ], ps)
        expect(psychicResult.passives).toHaveLength(1)
        expect(psychicResult.reactions).toHaveLength(0)
    })

    it('routes passive_rule sub-types to correct buckets', () => {
        const result = collectAutomationFromFeatures([
            makeFeature({ type: 'passive_rule', effect: 'superior_defense' }),
            makeFeature({ type: 'passive_rule', effect: 'grapple_damage' }),
            makeFeature({ type: 'passive_rule', effect: 'ritual_spells' }),
            makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'arcana' }] }),
            makeFeature({ type: 'passive_rule', effect: 'tavern_brawler_push' }),
        ], ps)
        expect(result.specialActions).toHaveLength(2)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.primalKnowledge).toHaveLength(1)
        expect(result.passives).toHaveLength(2)
    })

    it('routes auto_effect based on effect property', () => {
        const psychicResult = collectAutomationFromFeatures([makeFeature({ type: 'auto_effect', effect: 'psychic_teleportation' })], ps)
        expect(psychicResult.bonusActions).toHaveLength(1)
        expect(psychicResult.passives).toHaveLength(0)

        const otherResult = collectAutomationFromFeatures([makeFeature({ type: 'auto_effect', effect: 'something_else' })], ps)
        expect(otherResult.passives).toHaveLength(1)
    })

    it('routes attack_rider based on options', () => {
        const passiveResult = collectAutomationFromFeatures([makeFeature({ type: 'attack_rider', chooseOne: true })], ps)
        expect(passiveResult.passives).toHaveLength(1)

        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'attack_rider' })], ps)
        expect(actionResult.actions).toHaveLength(1)
    })

    it('routes combat_superiority based on oncePerTurn', () => {
        const actionResult = collectAutomationFromFeatures([makeFeature({ type: 'combat_superiority', oncePerTurn: true })], ps)
        expect(actionResult.actions).toHaveLength(1)
        expect(actionResult.specialActions).toHaveLength(0)

        const specialResult = collectAutomationFromFeatures([makeFeature({ type: 'combat_superiority' })], ps)
        expect(specialResult.specialActions).toHaveLength(1)
    })

    it('handles features with matching type and source conditions', () => {
        const feature = { name: 'GWF', type: 'damage', source: 'feat', automation: { type: 'great_weapon_fighting' } }
        const result = collectAutomationFromFeatures([feature], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('great_weapon_fighting')
    })

    it('handles array automations on a single feature', () => {
        const features = [{
            name: 'Dual',
            automation: [
                { type: 'warding_bond' },
                { type: 'bulwark_of_force' },
            ]
        }]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(1)
    })

    it('routes arcane_charge and telekinetic_movement as duplicate actions', () => {
        const arcaneResult = collectAutomationFromFeatures([makeFeature({ type: 'arcane_charge' })], ps)
        expect(arcaneResult.actions).toHaveLength(2)

        const teleResult = collectAutomationFromFeatures([makeFeature({ type: 'telekinetic_movement' })], ps)
        expect(teleResult.actions).toHaveLength(2)
    })
})

// ── collectTurnStartEffects – null/undefined safety ──

describe('collectTurnStartEffects – null/undefined safety', () => {
    it('returns empty array for null, undefined, or empty input', () => {
        expect(collectTurnStartEffects(null)).toEqual([])
        expect(collectTurnStartEffects(undefined)).toEqual([])
        expect(collectTurnStartEffects([])).toEqual([])
    })

    it('skips features with null, undefined, or missing automation', () => {
        const result = collectTurnStartEffects([
            { name: 'No Auto' },
            { name: 'Null Auto', automation: null },
        ])
        expect(result).toEqual([])
    })

    it('handles array automation with null/undefined entries', () => {
        const features = [{
            name: 'Mixed',
            automation: [null, { type: 'holy_nimbus' }, undefined]
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('holy_nimbus_radiant_damage')
    })
})

// ── collectTurnStartEffects – key behavioral routing ──

describe('collectTurnStartEffects – behavioral routing', () => {
    it('routes passive_rule effects with defaults', () => {
        const effects = [
            'supreme_sneak', 'umbral_sight', 'naturally_stealthy',
            'mage_hand_legerdemain', 'divination_savant', 'evocation_savant',
            'illusion_savant', 'improved_illusions', 'tavern_brawler_push', 'grapple_damage',
        ]
        for (const effect of effects) {
            const result = collectTurnStartEffects([{ name: effect, automation: { type: 'passive_rule', effect } }])
            expect(result).toHaveLength(1)
            expect(result[0].type).toBe(effect)
            expect(result[0].name).toBe(effect)
        }
    })

    it('routes passive_rule effects with custom overrides', () => {
        const overrides = [
            { effect: 'superior_defense', field: 'cost', value: 5, default: 3 },
            { effect: 'flurry_healing_harm', field: 'usesExpression', value: 'CHA modifier', default: 'WIS modifier minimum 1' },
            { effect: 'dread_ambush_speed', field: 'bonusExpression', value: '15', default: '10' },
            { effect: 'create_thrall_temp_hp', field: 'tempHpExpression', value: 'warlock level', default: 'warlock level + CHA modifier' },
            { effect: 'projected_ward', field: 'range', value: 60, default: 30 },
        ]

        for (const { effect, field, value, default: defaultValue } of overrides) {
            const customResult = collectTurnStartEffects([{ name: effect, automation: { type: 'passive_rule', effect, [field]: value } }])
            expect(customResult[0][field]).toBe(value)

            const defaultResult = collectTurnStartEffects([{ name: effect, automation: { type: 'passive_rule', effect } }])
            expect(defaultResult[0][field]).toBe(defaultValue)
        }
    })

    it('routes type-based effects correctly', () => {
        const typeTests = [
            { type: 'precise_hunter', expectedType: 'precise_hunter' },
            { type: 'hunter_lore', expectedType: 'hunter_lore' },
            { type: 'living_legend', expectedType: 'living_legend_turn_start' },
            { type: 'radiant_soul', expectedType: 'radiant_soul_turn_start' },
            { type: 'elder_champion', expectedType: 'elder_champion_regeneration' },
        ]

        for (const { type, expectedType } of typeTests) {
            const result = collectTurnStartEffects([{ name: type, automation: { type } }])
            expect(result).toHaveLength(1)
            expect(result[0].type).toBe(expectedType)
        }
    })

    it('routes damage_aura only for Inner Radiance feature name', () => {
        const innerResult = collectTurnStartEffects([{ name: 'Inner Radiance', automation: { type: 'damage_aura' } }])
        expect(innerResult).toHaveLength(1)
        expect(innerResult[0].type).toBe('inner_radiance_turn_start')

        const otherResult = collectTurnStartEffects([{ name: 'Fire Aura', automation: { type: 'damage_aura' } }])
        expect(otherResult).toHaveLength(0)
    })

    it('routes healing_start_of_turn with defaults', () => {
        const result = collectTurnStartEffects([{ name: 'Regen', automation: { type: 'healing_start_of_turn' } }])
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('regenerate_turn_start_heal')
        expect(result[0].healExpression).toBe('1')
        expect(result[0].bodyPartRegrowMinutes).toBe(2)
    })

    it('routes use_magic_device with default attunementLimit', () => {
        const result = collectTurnStartEffects([{ name: 'UMD', automation: { type: 'use_magic_device' } }])
        expect(result[0].attunementLimit).toBe(4)
    })

    it('routes steady_aim and roving_aim to steady_aim_clear', () => {
        const steadyResult = collectTurnStartEffects([{ name: 'Steady', automation: { type: 'steady_aim' } }])
        expect(steadyResult[0].type).toBe('steady_aim_clear')

        const rovingResult = collectTurnStartEffects([{ name: 'Roving', automation: { type: 'passive_rule', effect: 'roving_aim' } }])
        expect(rovingResult[0].type).toBe('steady_aim_clear')
    })

    it('routes heroic_inspiration_turn_start to heroic_inspiration', () => {
        const result = collectTurnStartEffects([{ name: 'Heroic', automation: { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' } }])
        expect(result[0].type).toBe('heroic_inspiration')
    })

    it('routes end_of_turn_condition_removal with conditions', () => {
        const result = collectTurnStartEffects([{
            name: 'Cleanse',
            automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['Frightened', 'Stunned'] }
        }])
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('condition_removal')
        expect(result[0].conditions).toEqual(['frightened', 'stunned'])
    })

    it('skips end_of_turn_condition_removal when conditions is empty or missing', () => {
        expect(collectTurnStartEffects([{ name: 'Empty', automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: [] } }])).toEqual([])
        expect(collectTurnStartEffects([{ name: 'Missing', automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal' } }])).toEqual([])
    })

    it('routes arcane_ward and spell_breaker with full shapes', () => {
        const arcaneResult = collectTurnStartEffects([{ name: 'Ward', automation: { type: 'passive_rule', effect: 'arcane_ward' } }])
        expect(arcaneResult[0]).toMatchObject({
            type: 'arcane_ward', name: 'Ward',
            wardHpExpression: '', wardRestoreExpression: '', bonusActionRestore: false,
        })

        const spellResult = collectTurnStartEffects([{ name: 'Breaker', automation: { type: 'passive_rule', effect: 'spell_breaker' } }])
        expect(spellResult[0]).toMatchObject({
            type: 'spell_breaker', name: 'Breaker',
            alwaysPreparedSpells: [], bonusActionSpells: [], dispelAbilityCheckBonus: '', slotRetentionSpells: [],
        })
    })

    it('routes phantasmal_creatures with defaults', () => {
        const result = collectTurnStartEffects([{ name: 'Phantasmal', automation: { type: 'phantasmal_creatures' } }])
        expect(result[0]).toMatchObject({
            type: 'phantasmal_creatures', name: 'Phantasmal',
            alwaysPreparedSpells: [], freeCastSpells: [], usesMax: 1, halvesHp: false,
        })
    })

    it('handles unknown automation types gracefully', () => {
        const result = collectTurnStartEffects([{ name: 'Unknown', automation: { type: 'completely_unknown_type' } }])
        expect(result).toEqual([])
    })

    it('handles features with non-object automation values', () => {
        const result = collectTurnStartEffects([
            { name: 'String', automation: 'invalid' },
            { name: 'Number', automation: 42 },
            { name: 'Boolean', automation: true },
        ])
        expect(result).toEqual([])
    })

    it('merges effects from multiple features and array automations', () => {
        const result = collectTurnStartEffects([{
            name: 'Multi',
            automation: [
                { type: 'passive_rule', effect: 'superior_defense' },
                { type: 'passive_rule', effect: 'naturally_stealthy' },
                { type: 'holy_nimbus' },
            ]
        }])
        expect(result).toHaveLength(3)
        expect(result.map(r => r.type)).toEqual(['superior_defense', 'naturally_stealthy', 'holy_nimbus_radiant_damage'])
    })
})

// ── processFeatureAutomation – wrapper injection and edge cases ──

describe('processFeatureAutomation – wrapper injection and edge cases', () => {
    it('wraps actions-categorized features from allReactions', () => {
        const actions = [], bonusActions = [], reactions = [{ name: 'React Feature', automation: { type: 'attack_rider' } }], specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
        expect(actions[0].name).toBe('React Feature')
    })

    it('wraps specialActions-categorized features from allSpecialActions', () => {
        const actions = [], bonusActions = [], reactions = [], specialActions = [{ name: 'Special', automation: { type: 'attack_rider' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(specialActions).toHaveLength(1)
    })

    it('does not duplicate when a feature with the same name already exists', () => {
        const actions = [{ name: 'Existing', automation: { type: 'auto_effect', effect: 'x' } }]
        const bonusActions = [], reactions = [{ name: 'Existing', automation: { type: 'attack_rider' } }], specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
    })

    it('preserves original arrays unmodified except for injected wrappers', () => {
        const actions = [], bonusActions = [{ name: 'BA', automation: { type: 'save_attack', action: 'action' } }],
              reactions = [{ name: 'React', automation: { type: 'save_attack', action: 'action' } }],
              specialActions = [{ name: 'Special', automation: { type: 'attack_rider' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(bonusActions).toHaveLength(1)
        expect(reactions).toHaveLength(1)
        expect(specialActions).toHaveLength(1)
    })

    it('extracts ritualSpells and primalKnowledge from passive_rule automation', () => {
        const actions = [], bonusActions = [], reactions = [], specialActions = [
            { name: 'Ritual Caster', automation: { type: 'passive_rule', effect: 'ritual_spells' } },
            { name: 'Primal Knowledge', automation: { type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'athletics' }, { skill: 'survival' }] } },
        ]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.primalKnowledge).toHaveLength(2)
    })

    it('handles null/undefined arrays and empty arrays gracefully', () => {
        expect(processFeatureAutomation(null, null, null, null, ps).actions).toEqual([])
        const result = processFeatureAutomation([], [], [], [], ps)
        expect(result.actions).toEqual([])
    })
})
