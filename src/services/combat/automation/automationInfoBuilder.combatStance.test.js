// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – bardic_inspiration_defense', () => {
    it('returns type, name, and hasAutomation for bardic_inspiration_defense', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_defense' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('bardic_inspiration_defense')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – bardic_inspiration_offense', () => {
    it('returns type, name, and hasAutomation for bardic_inspiration_offense', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_offense' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('bardic_inspiration_offense')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – combat_stance', () => {
    it('returns all default values when no optional fields are provided', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('combat_stance')
        expect(result.name).toBe('Test Feature')
        expect(result.effect).toBe('')
        expect(result.damageBonusExpression).toBe('')
        expect(result.resistanceTypes).toEqual([])
        expect(result.advantages).toEqual([])
        expect(result.options).toEqual([])
        expect(result.duration).toBe('')
        expect(result.resourceKey).toBe('ragePoints')
        expect(result.uses).toBe(0)
        expect(result.flySpeed).toBeNull()
        expect(result.reactionSave).toBeNull()
        expect(result.blocksSpellcasting).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through all optional fields when provided', () => {
        const feature = makeFeature(
            {
                type: 'combat_stance',
                effect: 'rage',
                damageBonusExpression: '2d6',
                resistanceTypes: ['fire', 'cold'],
                advantages: ['perception'],
                options: ['option1'],
                duration: '1 minute',
                resourceKey: 'customKey',
                uses: 3,
                flySpeed: 30,
                reactionSave: 'DEX',
                blocksSpellcasting: true,
            },
            'Raging Stance',
        )
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('combat_stance')
        expect(result.name).toBe('Raging Stance')
        expect(result.effect).toBe('rage')
        expect(result.damageBonusExpression).toBe('2d6')
        expect(result.resistanceTypes).toEqual(['fire', 'cold'])
        expect(result.advantages).toEqual(['perception'])
        expect(result.options).toEqual(['option1'])
        expect(result.duration).toBe('1 minute')
        expect(result.resourceKey).toBe('customKey')
        expect(result.uses).toBe(3)
        expect(result.flySpeed).toBe(30)
        expect(result.reactionSave).toBe('DEX')
        expect(result.blocksSpellcasting).toBe(true)
        expect(result.hasAutomation).toBe(true)
    })

    it('uses default resourceKey when not provided', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            effect: 'berserker',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('ragePoints')
    })

    it('uses default uses of 0 when automation.uses is 0', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            uses: 0,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(0)
    })

    it('defaults flySpeed to null when automation.flySpeed is falsy', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            flySpeed: 0,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.flySpeed).toBeNull()
    })

    it('defaults reactionSave to null when automation.reactionSave is empty string', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            reactionSave: '',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.reactionSave).toBeNull()
    })

    it('defaults blocksSpellcasting to false when automation.blocksSpellcasting is false', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            blocksSpellcasting: false,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.blocksSpellcasting).toBe(false)
    })

    it('defaults arrays to empty when explicitly set to undefined', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            resistanceTypes: undefined,
            advantages: undefined,
            options: undefined,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resistanceTypes).toEqual([])
        expect(result.advantages).toEqual([])
        expect(result.options).toEqual([])
    })
})

describe('buildAttackInfo – conditional_advantage', () => {
    it('returns all default values when no optional fields are provided', () => {
        const feature = makeFeature({ type: 'conditional_advantage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('conditional_advantage')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('advantage')
        expect(result.abilities).toEqual([])
        expect(result.uses).toBeNull()
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('passive')
        expect(result.trigger).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through all optional fields when provided', () => {
        const feature = makeFeature({
            type: 'conditional_advantage',
            target: 'attack_roll',
            condition: 'flanked',
            effect: 'advantage2',
            abilities: ['STR', 'DEX'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('attack_roll')
        expect(result.condition).toBe('flanked')
        expect(result.effect).toBe('advantage2')
        expect(result.abilities).toEqual(['STR', 'DEX'])
    })
})

describe('buildAttackInfo – conditional_disadvantage', () => {
    it('returns all default values when no optional fields are provided', () => {
        const feature = makeFeature({ type: 'conditional_disadvantage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('conditional_disadvantage')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('attack_roll')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('disadvantage')
        expect(result.abilities).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through all optional fields when provided', () => {
        const feature = makeFeature({
            type: 'conditional_disadvantage',
            target: 'saving_throw',
            condition: 'blinded',
            effect: 'disadvantage2',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('blinded')
        expect(result.effect).toBe('disadvantage2')
    })
})

describe('buildAttackInfo – evasion', () => {
    it('returns all default values when no optional fields are provided', () => {
        const feature = makeFeature({ type: 'evasion' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('evasion')
        expect(result.name).toBe('Test Feature')
        expect(result.saveType).toBe('DEX')
        expect(result.shareable).toBe(false)
        expect(result.shareRange).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through all optional fields when provided', () => {
        const feature = makeFeature({
            type: 'evasion',
            saveType: 'CON',
            shareable: true,
            shareRange: 30,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('CON')
        expect(result.shareable).toBe(true)
        expect(result.shareRange).toBe(30)
    })
})
