// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

// ── initiative_action ──────────────────────────────────────────────────

describe('buildAttackInfo – initiative_action', () => {
    it('returns null when feature has no automation', () => {
        const feature = { name: 'No Automation' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'initiative_action' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'initiative_action',
            name: 'Test Feature',
            effect: '',
            healExpression: '',
            trigger: 'roll_initiative',
            uses: 1,
            usesMax: 1,
            recharge: 'long_rest',
            resourceCost: '',
            resourceKey: 'testfeatureUses',
            hasAutomation: true,
        })
    })

    it('builds resourceKey from feature name with spaces collapsed', () => {
        const feature = makeFeature({ type: 'initiative_action' }, 'My Special Feature')
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('myspecialfeatureUses')
    })

    it('uses explicit uses value for both uses and usesMax', () => {
        const feature = makeFeature({
            type: 'initiative_action',
            uses: 3,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
    })

    it('defaults uses to 1 when automation has no uses property', () => {
        const feature = makeFeature({ type: 'initiative_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'initiative_action',
            effect: 'advantage',
            healExpression: '2d4',
            trigger: 'on_initiative',
            uses: 3,
            recharge: 'short_rest',
            resourceCost: 'spell_slot',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('advantage')
        expect(result.healExpression).toBe('2d4')
        expect(result.trigger).toBe('on_initiative')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('spell_slot')
    })
})

// ── meta ───────────────────────────────────────────────────────────────

describe('buildAttackInfo – meta', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'meta' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'meta',
            name: 'Test Feature',
            effect: '',
            hasAutomation: true,
        })
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'meta',
            effect: 'meta_effect',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('meta_effect')
    })
})

// ── passive_buff ───────────────────────────────────────────────────────

describe('buildAttackInfo – passive_buff', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'passive_buff',
            name: 'Test Feature',
            target: 'allies_in_range',
            range_expression: '10_ft',
            effect: '',
            bonusExpression: '',
            condition: '',
            conditionImmunity: '',
            resistances: [],
            resistanceType: [],
            validTypes: [],
            options: [],
            extraMastery: [],
            replaceMastery: [],
            grantsFlySpeed: false,
            grantsSwimSpeed: false,
            amount: 0,
            alsoSelfHealing: null,
            hasAutomation: true,
        })
    })

    it('transforms type to passive_rule when effect is max_hp_increase', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            effect: 'max_hp_increase',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
    })

    it('keeps type as passive_buff for non-special effects', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            effect: 'ac_bonus',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_buff')
    })

    it('falls back bonus to bonusExpression when bonusExpression is empty', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            bonus: '+2',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+2')
    })

    it('prefers bonusExpression over bonus when both are set', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            bonusExpression: '+3',
            bonus: '+2',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+3')
    })

    it('coerces grantsFlySpeed and grantsSwimSpeed to boolean', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            grantsFlySpeed: 'yes',
            grantsSwimSpeed: 1,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.grantsFlySpeed).toBe(true)
        expect(result.grantsSwimSpeed).toBe(true)
    })

    it('defaults amount to 0 when not provided', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.amount).toBe(0)
    })

    it('passes through amount when provided', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            amount: 10,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.amount).toBe(10)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            target: 'self',
            range_expression: '30_ft',
            effect: 'buff',
            bonusExpression: '+2',
            condition: 'conditions',
            conditionImmunity: 'charmed',
            resistances: ['fire'],
            options: ['option1'],
            extraMastery: ['extra1'],
            grantsFlySpeed: true,
            grantsSwimSpeed: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('self')
        expect(result.range_expression).toBe('30_ft')
        expect(result.effect).toBe('buff')
        expect(result.bonusExpression).toBe('+2')
        expect(result.condition).toBe('conditions')
        expect(result.conditionImmunity).toBe('charmed')
        expect(result.resistances).toEqual(['fire'])
        expect(result.options).toEqual(['option1'])
        expect(result.extraMastery).toEqual(['extra1'])
        expect(result.grantsFlySpeed).toBe(true)
        expect(result.grantsSwimSpeed).toBe(true)
    })
})

// ── passive_immunity ───────────────────────────────────────────────────

describe('buildAttackInfo – passive_immunity', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'passive_immunity' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'passive_immunity',
            name: 'Test Feature',
            target: 'self',
            conditionImmunity: '',
            damageResistance: [],
            saveAdvantage: [],
            hasAutomation: true,
        })
    })

    it('uses snake_case damage_resistance from automation', () => {
        const feature = makeFeature({
            type: 'passive_immunity',
            damage_resistance: ['fire', 'cold'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageResistance).toEqual(['fire', 'cold'])
    })

    it('uses snake_case save_advantage from automation', () => {
        const feature = makeFeature({
            type: 'passive_immunity',
            save_advantage: ['WIS', 'CON'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveAdvantage).toEqual(['WIS', 'CON'])
    })

    it('defaults to self target', () => {
        const feature = makeFeature({ type: 'passive_immunity' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('self')
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'passive_immunity',
            target: 'allies',
            conditionImmunity: 'charmed|frightened',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('allies')
        expect(result.conditionImmunity).toBe('charmed|frightened')
    })
})
