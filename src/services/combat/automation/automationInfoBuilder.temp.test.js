// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo', () => {
    describe('dispatch behavior', () => {
        it('returns null when feature has no automation', () => {
            const feature = { ...BASE_FEATURE, automation: null }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when feature automation is undefined', () => {
            const feature = { name: 'No Automation' }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when automation type has no handler', () => {
            const feature = makeFeature({ type: 'nonexistent_type' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })
    })

    describe('spell_modifier handler', () => {
        it('returns defaults', () => {
            const feature = makeFeature({ type: 'spell_modifier' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.type).toBe('spell_modifier')
            expect(result.name).toBe('Test Feature')
            expect(result.options).toEqual([])
            expect(result.resource).toBe('sorcery_points')
            expect(result.hasAutomation).toBe(true)
        })

        it('passes through custom options and resource', () => {
            const feature = makeFeature({
                type: 'spell_modifier',
                options: ['Empowered', 'Quickened'],
                resource: 'spell_slot',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.options).toEqual(['Empowered', 'Quickened'])
            expect(result.resource).toBe('spell_slot')
        })
    })

    describe('temp_buff handler', () => {
        it('returns defaults', () => {
            const feature = makeFeature({ type: 'temp_buff' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.type).toBe('temp_buff')
            expect(result.name).toBe('Test Feature')
            expect(result.effect).toBe('')
            expect(result.duration).toBe('1_minute')
            expect(result.action).toBe('bonus_action')
            expect(result.recharge).toBe('long_rest')
            expect(result.distance).toBe('')
            expect(result.extendedDistance).toBe('')
            expect(result.oncePerRage).toBe(false)
            expect(result.bringAllies).toBe(false)
            expect(result.allyCount).toBe(0)
            expect(result.teleportRange).toBe('')
            expect(result.enemiesDisadvantageSaves).toEqual([])
            expect(result.triggerOnRage).toBe(false)
            expect(result.distanceExpression).toBe('')
            expect(result.casting_time).toBe('')
            expect(result.uses).toBeNull()
            expect(result.usesMax).toBeNull()
            expect(result.hasAutomation).toBe(true)
        })

        it('resolves uses when set to proficiency_bonus', () => {
            const feature = makeFeature({ type: 'temp_buff', uses: 'proficiency_bonus' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.uses).toBe('proficiency_bonus')
            expect(result.usesMax).toBe(3)
        })

        it('resolves uses when set to a matching _level suffix', () => {
            const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.usesMax).toBe(5)
        })

        it('resolves uses to fallback level when _level suffix does not match class name', () => {
            const stats = { ...BASE_STATS, class: { name: 'Wizard' } }
            const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
            const result = buildAttackInfo(feature, stats)
            expect(result.usesMax).toBe(5)
        })

        it('passes through custom fields', () => {
            const feature = makeFeature({
                type: 'temp_buff',
                effect: 'haste',
                duration: 'concentration',
                action: 'action',
                recharge: 'short_rest',
                distance: '30 ft',
                extendedDistance: '60 ft',
                oncePerRage: true,
                bringAllies: true,
                allyCount: 2,
                teleportRange: '100 ft',
                enemies_disadvantage_saves: ['save1'],
                triggerOnRage: true,
                distanceExpression: '2d6',
                casting_time: '1 action',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('haste')
            expect(result.duration).toBe('concentration')
            expect(result.action).toBe('action')
            expect(result.recharge).toBe('short_rest')
            expect(result.distance).toBe('30 ft')
            expect(result.extendedDistance).toBe('60 ft')
            expect(result.oncePerRage).toBe(true)
            expect(result.bringAllies).toBe(true)
            expect(result.allyCount).toBe(2)
            expect(result.teleportRange).toBe('100 ft')
            expect(result.enemiesDisadvantageSaves).toEqual(['save1'])
            expect(result.triggerOnRage).toBe(true)
            expect(result.distanceExpression).toBe('2d6')
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('temp_hp_buff handler', () => {
        it('returns defaults', () => {
            const feature = makeFeature({ type: 'temp_hp_buff' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.type).toBe('temp_hp_buff')
            expect(result.name).toBe('Test Feature')
            expect(result.buffExpression).toBe('')
            expect(result.range).toBe('60_ft')
            expect(result.targets).toBe(1)
            expect(result.targetsExpression).toBe('')
            expect(result.bonusMovement).toBe(false)
            expect(result.extraEffect).toBeNull()
            expect(result.tempHpExpression).toBe('')
            expect(result.triggerOnRage).toBe(false)
            expect(result.ongoingHealingExpression).toBe('')
            expect(result.healingStartOfTurn).toBe(false)
            expect(result.healingRange).toBe('')
            expect(result.casting_time).toBe('1 bonus action')
            expect(result.includesSelf).toBe(false)
            expect(result.multiTargetAlly).toBe(false)
            expect(result.hasAutomation).toBe(true)
        })

        it('maps snake_case trigger_on_rage to camelCase triggerOnRage', () => {
            const feature = makeFeature({
                type: 'temp_hp_buff',
                trigger_on_rage: true,
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.triggerOnRage).toBe(true)
        })

        it('passes through custom fields', () => {
            const feature = makeFeature({
                type: 'temp_hp_buff',
                buffExpression: '2d8',
                range: '30_ft',
                targets: 3,
                targetsExpression: '2d4',
                bonusMovement: true,
                extraEffect: 'extra',
                tempHpExpression: '3d6',
                trigger_on_rage: true,
                ongoingHealingExpression: '1d4',
                healingStartOfTurn: true,
                healingRange: '10_ft',
                casting_time: '1 action',
                includesSelf: true,
                multiTargetAlly: true,
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.buffExpression).toBe('2d8')
            expect(result.range).toBe('30_ft')
            expect(result.targets).toBe(3)
            expect(result.targetsExpression).toBe('2d4')
            expect(result.bonusMovement).toBe(true)
            expect(result.extraEffect).toBe('extra')
            expect(result.tempHpExpression).toBe('3d6')
            expect(result.triggerOnRage).toBe(true)
            expect(result.ongoingHealingExpression).toBe('1d4')
            expect(result.healingStartOfTurn).toBe(true)
            expect(result.healingRange).toBe('10_ft')
            expect(result.includesSelf).toBe(true)
            expect(result.multiTargetAlly).toBe(true)
            expect(result.casting_time).toBe('1 action')
        })
    })
})
