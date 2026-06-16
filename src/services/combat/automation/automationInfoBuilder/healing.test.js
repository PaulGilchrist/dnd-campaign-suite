import { describe, it, expect } from 'vitest'
import { healingHandlers } from './healing.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

vi.mock('../../../../rules/effects/restRules.js', () => ({
    getHitDieSize: () => 8
}))

describe('healingHandlers – healing', () => {
    it('returns healing info with defaults', () => {
        const feature = makeFeature({ type: 'healing' })
        const result = healingHandlers.healing(feature, BASE_STATS)
        expect(result.type).toBe('healing')
        expect(result.healAmount).toBe(0)
        expect(result.healExpression).toBe('')
        expect(result.action).toBe('action')
        expect(result.uses).toBeNull()
        expect(result.usesMax).toBeNull()
        expect(result.recharge).toBe('long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves healExpression', () => {
        const feature = makeFeature({
            type: 'healing',
            healExpression: '2d8+4'
        })
        const result = healingHandlers.healing(feature, BASE_STATS)
        expect(result.healAmount).toBe("2d8+4")
    })

    it('passes through custom fields', () => {
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
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('healingHandlers – healing_pool', () => {
    it('returns healing_pool info with defaults', () => {
        const feature = makeFeature({ type: 'healing_pool' })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)
        expect(result.type).toBe('healing_pool')
        expect(result.pool).toBe(0)
        expect(result.poolExpression).toBe('')
        expect(result.isDicePool).toBe(false)
        expect(result.dieType).toBeNull()
        expect(result.action).toBe('action')
        expect(result.recharge).toBe('long_rest')
        expect(result.alsoCures).toEqual([])
        expect(result.cureCost).toBe(5)
        expect(result.hasAutomation).toBe(true)
    })

    it('detects dice pool from expression pattern', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '2d8'
        })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)
        expect(result.isDicePool).toBe(true)
        expect(result.dieType).toBe(8)
    })

    it('handles explicit dice pool flag', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '10',
            isDicePool: true
        })
        const result = healingHandlers.healing_pool(feature, BASE_STATS)
        expect(result.isDicePool).toBe(true)
        expect(result.dieType).toBe(6)
    })

    it('passes through custom fields', () => {
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
})

describe('healingHandlers – self_healing', () => {
    it('returns self_healing info with defaults', () => {
        const feature = makeFeature({ type: 'self_healing' })
        const result = healingHandlers.self_healing(feature, BASE_STATS)
        expect(result.type).toBe('self_healing')
        expect(result.healAmount).toBe(0)
        expect(result.action).toBe('action')
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('short_rest')
        expect(result.bloodiedOnly).toBe(false)
        expect(result.hitDiceCost).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('handles hit_die_roll expression', () => {
        const feature = makeFeature({
            type: 'self_healing',
            healExpression: 'hit_die_roll'
        })
        const result = healingHandlers.self_healing(feature, BASE_STATS)
        expect(result.healAmount).toBe(8) // from mocked getHitDieSize
    })

    it('resolves healExpression', () => {
        const feature = makeFeature({
            type: 'self_healing',
            healExpression: '2d8+4'
        })
        const result = healingHandlers.self_healing(feature, BASE_STATS)
        expect(result.healAmount).toBe("2d8+4")
    })

    it('passes through custom fields', () => {
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
        expect(result.recharge).toBe('long_rest')
        expect(result.bloodiedOnly).toBe(true)
        expect(result.hitDiceCost).toBe(1)
    })
})

describe('healingHandlers – buff_ally', () => {
    it('returns buff_ally info with defaults', () => {
        const feature = makeFeature({ type: 'buff_ally' })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)
        expect(result.type).toBe('buff_ally')
        expect(result.buffExpression).toBe('')
        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('bonus_action')
        expect(result.usesMax).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'buff_ally',
            uses_expression: 'proficiency_bonus'
        })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'buff_ally',
            range: '30_ft',
            action: 'action',
            uses: 3,
            recharge: 'short_rest'
        })
        const result = healingHandlers.buff_ally(feature, BASE_STATS)
        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

describe('healingHandlers – heroic_inspiration_buff', () => {
    it('returns buff_ally type with heroic defaults', () => {
        const feature = makeFeature({ type: 'heroic_inspiration_buff' })
        const result = healingHandlers.heroic_inspiration_buff(feature, BASE_STATS)
        expect(result.type).toBe('buff_ally')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_or_long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'heroic_inspiration_buff',
            range: '30_ft',
            targetsExpression: '3 creatures'
        })
        const result = healingHandlers.heroic_inspiration_buff(feature, BASE_STATS)
        expect(result.range).toBe('30_ft')
        expect(result.targetsExpression).toBe('3 creatures')
    })
})

describe('healingHandlers – divine_spark', () => {
    it('returns divine_spark info with defaults', () => {
        const feature = makeFeature({ type: 'divine_spark' })
        const result = healingHandlers.divine_spark(feature, BASE_STATS)
        expect(result.type).toBe('divine_spark')
        expect(result.range).toBe('30 ft')
        expect(result.healExpression).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.damageTypes).toEqual([])
        expect(result.saveType).toBe('CON')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
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

describe('healingHandlers – reaction_save_heal', () => {
    it('returns reaction_save_heal info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_save_heal' })
        const result = healingHandlers.reaction_save_heal(feature, BASE_STATS)
        expect(result.type).toBe('reaction_save_heal')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(10)
        expect(result.dcScaling).toBe(0)
        expect(result.healExpression).toBe('')
        expect(result.recharge).toBe('short_or_long_rest')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
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

describe('healingHandlers – post_cast_self_heal', () => {
    it('returns post_cast_self_heal info with defaults', () => {
        const feature = makeFeature({ type: 'post_cast_self_heal' })
        const result = healingHandlers.post_cast_self_heal(feature, BASE_STATS)
        expect(result.type).toBe('post_cast_self_heal')
        expect(result.healExpression).toBe('0')
        expect(result.othersOnly).toBe(true)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'post_cast_self_heal',
            healExpression: '2d8',
            othersOnly: false
        })
        const result = healingHandlers.post_cast_self_heal(feature, BASE_STATS)
        expect(result.healExpression).toBe('2d8')
        expect(result.othersOnly).toBe(false)
    })
})

describe('healingHandlers – post_cast_ally_heal', () => {
    it('returns post_cast_ally_heal info with defaults', () => {
        const feature = makeFeature({ type: 'post_cast_ally_heal' })
        const result = healingHandlers.post_cast_ally_heal(feature, BASE_STATS)
        expect(result.type).toBe('post_cast_ally_heal')
        expect(result.healExpression).toBe('0')
        expect(result.othersOnly).toBe(true)
        expect(result.range).toBe('30_ft')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
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

describe('healingHandlers – heroes_feast', () => {
    it('returns heroes_feast info with defaults', () => {
        const feature = makeFeature({ type: 'heroes_feast' })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)
        expect(result.type).toBe('heroes_feast')
        expect(result.hpMaxIncrease).toBe(11)
        expect(result.hpMaxIncreaseExpression).toBe('2d10')
        expect(result.slotLevel).toBe(6)
        expect(result.range).toBe('Self')
        expect(result.maxTargets).toBe(12)
        expect(result.duration).toBe('24 hours')
        expect(result.action).toBe('action')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves hpMaxIncreaseExpression', () => {
        const feature = makeFeature({
            type: 'heroes_feast',
            hpMaxIncreaseExpression: '3d10'
        })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)
        expect(result.hpMaxIncrease).toBe('3d10')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'heroes_feast',
            slotLevel: 7,
            range: 'Touch',
            maxTargets: 6,
            duration: '8 hours'
        })
        const result = healingHandlers.heroes_feast(feature, BASE_STATS)
        expect(result.slotLevel).toBe(7)
        expect(result.range).toBe('Touch')
        expect(result.maxTargets).toBe(6)
        expect(result.duration).toBe('8 hours')
    })
})

describe('healingHandlers – healing_bonus', () => {
    it('returns passive_rule with bonus_healing effect', () => {
        const feature = makeFeature({ type: 'healing_bonus' })
        const result = healingHandlers.healing_bonus(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('bonus_healing')
        expect(result.bonusExpression).toBe('0')
        expect(result.trigger).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
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
