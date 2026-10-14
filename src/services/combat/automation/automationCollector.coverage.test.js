import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

const ps = makePlayerStats()

// ── collectAutomationFromFeatures – playerStats null/undefined safety ──

describe('collectAutomationFromFeatures – playerStats safety', () => {
    it('still processes features when playerStats is null', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'warding_bond' })], null)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('warding_bond')
    })

    it('still processes features when playerStats is undefined', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'warding_bond' })], undefined)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('warding_bond')
    })
})

// ── collectAutomationFromFeatures – relentless effect ──

describe('collectAutomationFromFeatures – relentless effect', () => {
    it('creates passive with hasAutomation flag for relentless effect', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect: 'relentless' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0]).toEqual({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'relentless',
            hasAutomation: true,
        })
    })
})

// ── collectAutomationFromFeatures – projected_ward reaction ──

describe('collectAutomationFromFeatures – projected_ward reaction', () => {
    it('creates reaction with full automation object for projected_ward', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'projected_ward' })], ps)
        expect(result.reactions).toHaveLength(1)
        expect(result.reactions[0]).toEqual({
            type: 'projected_ward',
            name: 'Test Feature',
            range: 30,
            reaction: true,
            automation: {
                type: 'projected_ward',
                name: 'Test Feature',
                range: 30,
                reaction: true,
                wardTrigger: 'ally_damage_taken',
                casting_time: '1 reaction',
                hasAutomation: true,
            },
        })
    })

    it('respects custom projected_ward properties', () => {
        const result = collectAutomationFromFeatures([
            makeFeature({ type: 'projected_ward', range: 60, wardTrigger: 'self_healing', casting_time: '1 reaction; starts when dropped below 50% hp' })
        ], ps)
        expect(result.reactions[0]).toEqual({
            type: 'projected_ward',
            name: 'Test Feature',
            range: 60,
            reaction: true,
            automation: {
                type: 'projected_ward',
                name: 'Test Feature',
                range: 60,
                reaction: true,
                wardTrigger: 'self_healing',
                casting_time: '1 reaction; starts when dropped below 50% hp',
                hasAutomation: true,
            },
        })
    })
})

// ── collectAutomationFromFeatures – arcane_ward full shape ──

describe('collectAutomationFromFeatures – arcane_ward full shape', () => {
    it('creates passive with all defaults', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect: 'arcane_ward' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0]).toEqual({
            type: 'arcane_ward',
            name: 'Test Feature',
            wardHpExpression: '',
            wardRestoreExpression: '',
            bonusActionRestore: false,
        })
    })

    it('creates passive with custom values', () => {
        const result = collectAutomationFromFeatures([
            makeFeature({ type: 'passive_rule', effect: 'arcane_ward', wardHpExpression: 'INT modifier * 5', wardRestoreExpression: 'full', bonusActionRestore: true })
        ], ps)
        expect(result.passives[0]).toEqual({
            type: 'arcane_ward',
            name: 'Test Feature',
            wardHpExpression: 'INT modifier * 5',
            wardRestoreExpression: 'full',
            bonusActionRestore: true,
        })
    })
})

// ── collectAutomationFromFeatures – spell_breaker full shape ──

describe('collectAutomationFromFeatures – spell_breaker full shape', () => {
    it('creates passive with all defaults', () => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'passive_rule', effect: 'spell_breaker' })], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0]).toEqual({
            type: 'spell_breaker',
            name: 'Test Feature',
            spellLevel: 1,
            alwaysPreparedSpells: [],
            bonusActionSpells: [],
            dispelAbilityCheckBonus: '',
            slotRetentionSpells: [],
        })
    })

    it('creates passive with custom values', () => {
        const result = collectAutomationFromFeatures([
            makeFeature({ type: 'passive_rule', effect: 'spell_breaker', spellLevel: 3, alwaysPreparedSpells: ['dispel_magic'], bonusActionSpells: ['counterspell'], dispelAbilityCheckBonus: 'proficiency_bonus', slotRetentionSpells: ['counterspell', 'dispel_magic'] })
        ], ps)
        expect(result.passives[0]).toEqual({
            type: 'spell_breaker',
            name: 'Test Feature',
            spellLevel: 3,
            alwaysPreparedSpells: ['dispel_magic'],
            bonusActionSpells: ['counterspell'],
            dispelAbilityCheckBonus: 'proficiency_bonus',
            slotRetentionSpells: ['counterspell', 'dispel_magic'],
        })
    })
})

// ── collectTurnStartEffects – vitalityOfTheTree_turn_start ──

describe('collectTurnStartEffects – vitalityOfTheTree_turn_start', () => {
    it('maps temp_hp_buff with healingStartOfTurn to vitalityOfTheTree_turn_start', () => {
        const result = collectTurnStartEffects([{
            name: 'Vitality of the Tree',
            automation: { type: 'temp_hp_buff', healingStartOfTurn: true }
        }])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'vitalityOfTheTree_turn_start',
            name: 'Vitality of the Tree',
            ongoingHealingExpression: '',
            healingRange: '10 ft',
        })
    })

    it('respects custom values for vitalityOfTheTree_turn_start', () => {
        const result = collectTurnStartEffects([{
            name: 'Vitality of the Tree',
            automation: { type: 'temp_hp_buff', healingStartOfTurn: true, ongoingHealingExpression: '2d6', healingRange: '30 ft' }
        }])
        expect(result[0]).toEqual({
            type: 'vitalityOfTheTree_turn_start',
            name: 'Vitality of the Tree',
            ongoingHealingExpression: '2d6',
            healingRange: '30 ft',
        })
    })
})

// ── collectTurnStartEffects – confusion_turn_start ──

describe('collectTurnStartEffects – confusion_turn_start', () => {
    it('maps passive_rule confusion_turn_start effect', () => {
        const result = collectTurnStartEffects([{
            name: 'Confusion Aura',
            automation: { type: 'passive_rule', effect: 'confusion_turn_start' }
        }])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'confusion_turn_start',
            name: 'Confusion Aura',
        })
    })
})

// ── collectTurnStartEffects – survivor_turn_start_heal (bloodiedOnly path) ──

describe('collectTurnStartEffects – survivor_turn_start_heal', () => {
    it('maps healing_start_of_turn with bloodiedOnly to survivor_turn_start_heal', () => {
        const result = collectTurnStartEffects([{
            name: 'Survivor',
            automation: { type: 'healing_start_of_turn', bloodiedOnly: true, healExpression: '5' }
        }])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'survivor_turn_start_heal',
            name: 'Survivor',
            healExpression: '5',
            bloodiedOnly: true,
            bodyPartRegrowMinutes: 2,
        })
    })
})

// ── collectTurnStartEffects – ignore_loading_crossbows with weapons ──

describe('collectTurnStartEffects – ignore_loading_crossbows', () => {
    it('collects ignore_loading_crossbows with explicit weapons array', () => {
        const result = collectTurnStartEffects([{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows', weapons: ['hand_crossbow', 'heavy_crossbow'] }
        }])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'ignore_loading_crossbows',
            name: 'Crossbow Expert',
            weapons: ['hand_crossbow', 'heavy_crossbow'],
        })
    })

    it('collects ignore_loading_crossbows with empty weapons when not provided', () => {
        const result = collectTurnStartEffects([{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows' }
        }])
        expect(result).toHaveLength(1)
        expect(result[0].weapons).toEqual([])
    })
})

// ── collectTurnStartEffects – no_melee_disadvantage_crossbows ──

describe('collectTurnStartEffects – no_melee_disadvantage_crossbows', () => {
    it('collects no_melee_disadvantage_crossbows effect', () => {
        const result = collectTurnStartEffects([{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' }
        }])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'no_melee_disadvantage_crossbows',
            name: 'Crossbow Expert',
        })
    })
})

// ── processFeatureAutomation – return value structure ──

describe('processFeatureAutomation – return value structure', () => {
    it('returns the automation object from collectAutomationFromFeatures', () => {
        const actions = [], bonusActions = [], reactions = [], specialActions = [
            { name: 'Ritual Caster', automation: { type: 'passive_rule', effect: 'ritual_spells' } },
            { name: 'Primal Knowledge', automation: { type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'athletics' }] } },
        ]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result).toHaveProperty('actions')
        expect(result).toHaveProperty('bonusActions')
        expect(result).toHaveProperty('reactions')
        expect(result).toHaveProperty('specialActions')
        expect(result).toHaveProperty('passives')
        expect(result).toHaveProperty('autoEffects')
        expect(result).toHaveProperty('saveModifiers')
        expect(result).toHaveProperty('primalKnowledge')
        expect(result).toHaveProperty('ritualSpells')
    })

    it('returns ritualSpells and primalKnowledge extracted from specialActions', () => {
        const actions = [], bonusActions = [], reactions = [], specialActions = [
            { name: 'Ritual Caster', automation: { type: 'passive_rule', effect: 'ritual_spells' } },
            { name: 'Primal Knowledge', automation: { type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'athletics' }, { skill: 'survival' }] } },
        ]
        const result = processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(result.ritualSpells).toHaveLength(1)
        expect(result.primalKnowledge).toHaveLength(2)
    })

    it('injects wrappers into allActions when reaction feature is not already in actions', () => {
        const actions = [], bonusActions = [], reactions = [{ name: 'Unique React', automation: { type: 'warding_bond' } }], specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
        expect(actions[0].name).toBe('Unique React')
        expect(actions[0].hasAutomation).toBe(true)
        expect(actions[0].automation.type).toBe('warding_bond')
    })

    it('does not inject when feature name already exists in target array', () => {
        const actions = [{ name: 'Existing', automation: { type: 'warding_bond' } }]
        const bonusActions = [], reactions = [{ name: 'Existing', automation: { type: 'attack_rider' } }], specialActions = []
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(actions).toHaveLength(1)
    })

    it('does not inject when feature name already exists in specialActions', () => {
        const actions = [], bonusActions = [], reactions = [], specialActions = [{ name: 'Existing', automation: { type: 'warding_bond' } }]
        processFeatureAutomation(actions, bonusActions, reactions, specialActions, ps)
        expect(specialActions).toHaveLength(1)
    })

    it('handles null arrays by treating them as empty', () => {
        const result = processFeatureAutomation(null, null, null, null, ps)
        expect(result.actions).toEqual([])
        expect(result.bonusActions).toEqual([])
        expect(result.reactions).toEqual([])
        expect(result.specialActions).toEqual([])
        expect(result.passives).toEqual([])
        expect(result.autoEffects).toEqual([])
        expect(result.saveModifiers).toEqual([])
        expect(result.primalKnowledge).toEqual([])
        expect(result.ritualSpells).toEqual([])
    })
})

// ── collectAutomationFromFeatures – cantrip_range_bonus edge cases ──

describe('collectAutomationFromFeatures – cantrip_range_bonus edge cases', () => {
    it('extracts multi-digit numbers from rangeBonusCantrip', () => {
        const result = collectAutomationFromFeatures([
            { name: 'Fire Bolt', automation: { type: 'damage_bonus', rangeBonusCantrip: '+100ft' } },
        ], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].type).toBe('cantrip_range_bonus')
        expect(result.passives[0].bonusExpression).toBe('100')
    })

    it('handles rangeBonusCantrip with spaces', () => {
        const result = collectAutomationFromFeatures([
            { name: 'Bolt', automation: { type: 'damage_bonus', rangeBonusCantrip: '+ 25 ft' } },
        ], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].bonusExpression).toBe('25')
    })

    it('handles negative numbers in rangeBonusCantrip', () => {
        const result = collectAutomationFromFeatures([
            { name: 'Bolt', automation: { type: 'damage_bonus', rangeBonusCantrip: '-5ft' } },
        ], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].bonusExpression).toBe('5')
    })
})

// ── collectAutomationFromFeatures – feature without name property ──

describe('collectAutomationFromFeatures – feature without name', () => {
    it('handles features with missing name property gracefully', () => {
        const result = collectAutomationFromFeatures([
            { automation: { type: 'warding_bond' } }
        ], ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].name).toBeUndefined()
    })
})

// ── collectAutomationFromFeatures – multiple features with overlapping types ──

describe('collectAutomationFromFeatures – multiple features accumulation', () => {
    it('accumulates automations from multiple features into correct buckets', () => {
        const features = [
            makeFeature({ type: 'warding_bond' }),
            makeFeature({ type: 'bulwark_of_force' }),
            makeFeature({ type: 'psionic_strike' }),
            makeFeature({ type: 'starry_form' }),
        ]
        const result = collectAutomationFromFeatures(features, ps)
        expect(result.actions).toHaveLength(1)
        expect(result.bonusActions).toHaveLength(1)
        expect(result.reactions).toHaveLength(1)
        expect(result.specialActions).toHaveLength(1)
        expect(result.passives).toHaveLength(0)
    })

    it('handles features with both type and source conditions', () => {
        const feature = { name: 'GWF', type: 'damage', source: 'feat', automation: { type: 'great_weapon_fighting' } }
        const result = collectAutomationFromFeatures([feature], ps)
        expect(result.passives).toHaveLength(1)
        expect(result.passives[0].effect).toBe('great_weapon_fighting')
    })
})
