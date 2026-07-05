// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest'
import { healingHandlers } from './healing.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

vi.mock('../../../../rules/effects/restRules.js', () => ({
    getHitDieSize: () => 8
}))

// ── healing ──────────────────────────────────────────────────────────

describe('healingHandlers.healing', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'healing' })
        const result = healingHandlers.healing(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'healing',
            name: 'Test Feature',
            healAmount: 0,
            healExpression: '',
            action: 'action',
            uses: null,
            usesMax: null,
            recharge: 'long_rest',
            casting_time: '',
            hasAutomation: true
        })
    })

    it('returns the expression string when healExpression is a dice formula', () => {
        const feature = makeFeature({ type: 'healing', healExpression: '2d8+4' })
        const result = healingHandlers.healing(feature, BASE_STATS)

        expect(result.healAmount).toBe('2d8+4')
        expect(result.healExpression).toBe('2d8+4')
    })

    it('overrides action, uses, recharge, and casting_time from automation', () => {
        const feature = makeFeature({
            type: 'healing',
            action: 'bonus_action',
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 bonus action'
        })
        const result = healingHandlers.healing(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('treats uses: 0 as a valid value instead of defaulting to null', () => {
        const feature = makeFeature({ type: 'healing', uses: 0 })
        const result = healingHandlers.healing(feature, BASE_STATS)

        expect(result.uses).toBe(0)
        expect(result.usesMax).toBe(0)
    })
})

// ── healing_pool ─────────────────────────────────────────────────────

describe('healingHandlers.healing_pool', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'healing_pool' })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'healing_pool',
            name: 'Test Feature',
            pool: 0,
            poolExpression: '',
            isDicePool: false,
            dieType: null,
            action: 'action',
            recharge: 'long_rest',
            alsoCures: [],
            cureCost: 5,
            range: '',
            resourceCost: '',
            maxDicePerUse: '',
            hasAutomation: true
        })
    })

    it('detects a dice pool from a matching expression like 2d8', () => {
        const feature = makeFeature({ type: 'healing_pool', poolExpression: '2d8' })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.isDicePool).toBe(true)
        expect(result.dieType).toBe(8)
        expect(result.pool).toBe(2)
    })

    it('evaluates a non-dice expression via evaluateAutoExpression', () => {
        const feature = makeFeature({ type: 'healing_pool', poolExpression: '10' })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.isDicePool).toBe(false)
        expect(result.dieType).toBe(null)
        expect(result.pool).toBe(10)
    })

    it('uses explicit isDicePool flag and falls back to dieType 6', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '10',
            isDicePool: true
        })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.isDicePool).toBe(true)
        expect(result.dieType).toBe(6)
    })

    it('passes through explicit dieType string when isDicePool is set', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '5',
            isDicePool: true,
            dieType: 'd12'
        })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.dieType).toBe('d12')
    })

    it('passes through range, resourceCost, and maxDicePerUse', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            range: '30_ft',
            resourceCost: 'spell_slot',
            maxDicePerUse: 3
        })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.maxDicePerUse).toBe(3)
    })

    it('generates resourceKey from lowercased feature name', () => {
        const feature = makeFeature({ type: 'healing_pool' }, 'Mighty Heal')
        const result = healingHandlers.healing_pool(feature, BASE_STATS)

        expect(result.resourceKey).toBe('mightyhealPool')
    })
})

// ── self_healing ─────────────────────────────────────────────────────

describe('healingHandlers.self_healing', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'self_healing' })
        const result = healingHandlers.self_healing(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'self_healing',
            name: 'Test Feature',
            healAmount: 0,
            healExpression: '',
            action: 'action',
            uses: 1,
            usesMax: 1,
            recharge: 'short_rest',
            bloodiedOnly: false,
            hitDiceCost: 0,
            hasAutomation: true
        })
    })

    it('uses getHitDieSize when healExpression is hit_die_roll', () => {
        const feature = makeFeature({ type: 'self_healing', healExpression: 'hit_die_roll' })
        const result = healingHandlers.self_healing(feature, BASE_STATS)

        expect(result.healAmount).toBe(8)
        expect(result.healExpression).toBe('hit_die_roll')
    })

    it('returns the expression string for a dice formula healExpression', () => {
        const feature = makeFeature({ type: 'self_healing', healExpression: '2d8+4' })
        const result = healingHandlers.self_healing(feature, BASE_STATS)

        expect(result.healAmount).toBe('2d8+4')
    })

    it('overrides action, uses, recharge, bloodiedOnly, and hitDiceCost', () => {
        const feature = makeFeature({
            type: 'self_healing',
            action: 'bonus_action',
            uses: 2,
            recharge: 'long_rest',
            bloodiedOnly: true,
            hitDiceCost: 1
        })
        const result = healingHandlers.self_healing(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
        expect(result.uses).toBe(2)
        expect(result.usesMax).toBe(2)
        expect(result.recharge).toBe('long_rest')
        expect(result.bloodiedOnly).toBe(true)
        expect(result.hitDiceCost).toBe(1)
    })
})

// ── buff_ally ────────────────────────────────────────────────────────

describe('healingHandlers.buff_ally', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'buff_ally' })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'buff_ally',
            name: 'Test Feature',
            buffExpression: '',
            range: '60_ft',
            action: 'bonus_action',
            usesMax: 0,
            usesRecharge: 'long_rest',
            hasAutomation: true
        })
    })

    it('resolves usesMax from uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({ type: 'buff_ally', uses_expression: 'proficiency_bonus' })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)

        expect(result.usesMax).toBe(3)
    })

    it('overrides range, action, and recharge from automation', () => {
        const feature = makeFeature({
            type: 'buff_ally',
            range: '30_ft',
            action: 'action',
            recharge: 'short_rest'
        })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

// ── heroic_inspiration_buff ──────────────────────────────────────────

describe('healingHandlers.heroic_inspiration_buff', () => {
    it('returns defaults with heroic-specific values', () => {
        const feature = makeFeature({ type: 'heroic_inspiration_buff' })
        const result = healingHandlers.heroic_inspiration_buff(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'buff_ally',
            name: 'Test Feature',
            buffExpression: '',
            range: '60_ft',
            action: 'action',
            usesMax: 0,
            usesRecharge: 'short_or_long_rest',
            targetsExpression: '',
            hasAutomation: true
        })
    })

    it('overrides range, uses_expression, and targetsExpression', () => {
        const feature = makeFeature({
            type: 'heroic_inspiration_buff',
            range: '30_ft',
            uses_expression: 'proficiency_bonus',
            targetsExpression: '3 creatures'
        })
        const result = healingHandlers.heroic_inspiration_buff(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.usesMax).toBe(3)
        expect(result.targetsExpression).toBe('3 creatures')
    })
})

// ── divine_spark ─────────────────────────────────────────────────────

describe('healingHandlers.divine_spark', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'divine_spark' })
        const result = healingHandlers.divine_spark(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'divine_spark',
            name: 'Test Feature',
            range: '30 ft',
            healExpression: '',
            damageExpression: '',
            damageTypes: [],
            saveType: 'CON',
            resourceCost: '',
            hasAutomation: true
        })
    })

    it('overrides all custom fields', () => {
        const feature = makeFeature({
            type: 'divine_spark',
            range: '60 ft',
            healExpression: '2d8',
            damageExpression: '3d6',
            damageTypes: ['fire'],
            resourceCost: 'divine Spark'
        })
        const result = healingHandlers.divine_spark(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
        expect(result.healExpression).toBe('2d8')
        expect(result.damageExpression).toBe('3d6')
        expect(result.damageTypes).toEqual(['fire'])
        expect(result.resourceCost).toBe('divine Spark')
    })
})

// ── reaction_save_heal ───────────────────────────────────────────────

describe('healingHandlers.reaction_save_heal', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_save_heal' })
        const result = healingHandlers.reaction_save_heal(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'reaction_save_heal',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            dcScaling: 0,
            healExpression: '',
            recharge: 'short_or_long_rest',
            casting_time: '1 reaction',
            hasAutomation: true
        })
    })

    it('overrides saveType, saveDc, dcScaling, and healExpression', () => {
        const feature = makeFeature({
            type: 'reaction_save_heal',
            saveType: 'WIS',
            saveDc: 15,
            dcScaling: 2,
            healExpression: '2d8+4'
        })
        const result = healingHandlers.reaction_save_heal(feature, BASE_STATS)

        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.dcScaling).toBe(2)
        expect(result.healExpression).toBe('2d8+4')
    })
})

// ── post_cast_self_heal ──────────────────────────────────────────────

describe('healingHandlers.post_cast_self_heal', () => {
    it('returns defaults with healExpression 0 and othersOnly true', () => {
        const feature = makeFeature({ type: 'post_cast_self_heal' })
        const result = healingHandlers.post_cast_self_heal(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'post_cast_self_heal',
            name: 'Test Feature',
            healExpression: '0',
            othersOnly: true,
            hasAutomation: true
        })
    })

    it('honors explicit false for othersOnly via nullish coalescing', () => {
        const feature = makeFeature({
            type: 'post_cast_self_heal',
            othersOnly: false
        })
        const result = healingHandlers.post_cast_self_heal(feature, BASE_STATS)

        expect(result.othersOnly).toBe(false)
    })

    it('overrides healExpression', () => {
        const feature = makeFeature({
            type: 'post_cast_self_heal',
            healExpression: '2d8'
        })
        const result = healingHandlers.post_cast_self_heal(feature, BASE_STATS)

        expect(result.healExpression).toBe('2d8')
    })
})

// ── post_cast_ally_heal ──────────────────────────────────────────────

describe('healingHandlers.post_cast_ally_heal', () => {
    it('returns defaults with healExpression 0, othersOnly true, and range 30_ft', () => {
        const feature = makeFeature({ type: 'post_cast_ally_heal' })
        const result = healingHandlers.post_cast_ally_heal(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'post_cast_ally_heal',
            name: 'Test Feature',
            healExpression: '0',
            othersOnly: true,
            range: '30_ft',
            hasAutomation: true
        })
    })

    it('honors explicit false for othersOnly via nullish coalescing', () => {
        const feature = makeFeature({
            type: 'post_cast_ally_heal',
            othersOnly: false
        })
        const result = healingHandlers.post_cast_ally_heal(feature, BASE_STATS)

        expect(result.othersOnly).toBe(false)
    })

    it('overrides healExpression and range', () => {
        const feature = makeFeature({
            type: 'post_cast_ally_heal',
            healExpression: '3d8',
            range: '60_ft'
        })
        const result = healingHandlers.post_cast_ally_heal(feature, BASE_STATS)

        expect(result.healExpression).toBe('3d8')
        expect(result.range).toBe('60_ft')
    })
})

// ── heroes_feast ─────────────────────────────────────────────────────

describe('healingHandlers.heroes_feast', () => {
    it('returns defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'heroes_feast' })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'heroes_feast',
            name: 'Test Feature',
            hpMaxIncrease: 11,
            hpMaxIncreaseExpression: '2d10',
            slotLevel: 6,
            range: 'Self',
            maxTargets: 12,
            duration: '24 hours',
            action: 'action',
            hasAutomation: true
        })
    })

    it('resolves hpMaxIncrease from hpMaxIncreaseExpression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'heroes_feast',
            hpMaxIncreaseExpression: '3d10'
        })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)

        expect(result.hpMaxIncrease).toBe('3d10')
        expect(result.hpMaxIncreaseExpression).toBe('3d10')
    })

    it('overrides slotLevel, range, maxTargets, duration, and action', () => {
        const feature = makeFeature({
            type: 'heroes_feast',
            slotLevel: 7,
            range: 'Touch',
            maxTargets: 6,
            duration: '8 hours',
            action: 'bonus_action'
        })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)

        expect(result.slotLevel).toBe(7)
        expect(result.range).toBe('Touch')
        expect(result.maxTargets).toBe(6)
        expect(result.duration).toBe('8 hours')
        expect(result.action).toBe('bonus_action')
    })
})

// ── healing_bonus ────────────────────────────────────────────────────

describe('healingHandlers.healing_bonus', () => {
    it('returns a passive_rule with bonus_healing effect and defaults', () => {
        const feature = makeFeature({ type: 'healing_bonus' })
        const result = healingHandlers.healing_bonus(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'passive_rule',
            effect: 'bonus_healing',
            name: 'Test Feature',
            bonusExpression: '0',
            trigger: '',
            hasAutomation: true
        })
    })

    it('overrides extraHealing (bonusExpression) and trigger', () => {
        const feature = makeFeature({
            type: 'healing_bonus',
            extraHealing: '2d8',
            trigger: 'after_spell'
        })
        const result = healingHandlers.healing_bonus(feature, BASE_STATS)

        expect(result.bonusExpression).toBe('2d8')
        expect(result.trigger).toBe('after_spell')
    })
})
