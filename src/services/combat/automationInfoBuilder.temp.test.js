import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – spell_modifier', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'spell_modifier' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'spell_modifier',
            name: 'Test Feature',
            options: [],
            resource: 'sorcery_points',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'spell_modifier',
                options: ['option1'],
                resource: 'warlock_slots',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.options).toEqual(['option1'])
        expect(result.resource).toBe('warlock_slots')
    })
})

describe('buildAttackInfo – temp_buff', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'temp_buff' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'temp_buff',
            name: 'Test Feature',
            effect: '',
            duration: '1_minute',
            action: 'bonus_action',
            recharge: 'long_rest',
            distance: '',
            extendedDistance: '',
            oncePerRage: false,
            bringAllies: false,
            allyCount: 0,
            teleportRange: '',
            enemiesDisadvantageSaves: [],
            triggerOnRage: false,
            distanceExpression: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'temp_buff',
                effect: 'teleport',
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
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('teleport')
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
    })
})

describe('buildAttackInfo – temp_hp_buff', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'temp_hp_buff' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'temp_hp_buff',
            name: 'Test Feature',
            buffExpression: '',
            range: '60_ft',
            targets: 1,
            targetsExpression: '',
            bonusMovement: false,
            extraEffect: null,
            tempHpExpression: '',
            triggerOnRage: false,
            ongoingHealingExpression: '',
            healingStartOfTurn: false,
            healingRange: '',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
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
            },
        }
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
        expect(result.casting_time).toBe('1 action')
    })
})
