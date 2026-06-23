// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { combatStanceHandlers } from './combatStance.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('combatStanceHandlers – combat_stance', () => {
    it('returns combat_stance info with defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'combat_stance',
            name: 'Test Feature',
            effect: '',
            damageBonusExpression: '',
            resistanceTypes: [],
            advantages: [],
            options: [],
            duration: '',
            resourceKey: 'ragePoints',
            uses: 0,
            flySpeed: null,
            reactionSave: null,
            blocksSpellcasting: false,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            effect: 'rage',
            damageBonusExpression: '2d6',
            resistanceTypes: ['fire', 'cold'],
            advantages: ['STR checks'],
            duration: '1_minute',
            resourceKey: 'staminaPoints',
            uses: 3,
            flySpeed: 30,
            reactionSave: 'WIS',
            blocksSpellcasting: true
        })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)

        expect(result.effect).toBe('rage')
        expect(result.damageBonusExpression).toBe('2d6')
        expect(result.resistanceTypes).toEqual(['fire', 'cold'])
        expect(result.advantages).toEqual(['STR checks'])
        expect(result.duration).toBe('1_minute')
        expect(result.resourceKey).toBe('staminaPoints')
        expect(result.uses).toBe(3)
        expect(result.flySpeed).toBe(30)
        expect(result.reactionSave).toBe('WIS')
        expect(result.blocksSpellcasting).toBe(true)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'combat_stance' }, 'Rage')
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.name).toBe('Rage')
    })

    it('passes through custom options array', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            options: ['option1', 'option2']
        })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.options).toEqual(['option1', 'option2'])
    })

    it('ignores playerStats parameter and always returns same defaults', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = combatStanceHandlers.combat_stance(feature, { level: 20 })
        expect(result.resourceKey).toBe('ragePoints')
        expect(result.uses).toBe(0)
        expect(result.flySpeed).toBeNull()
    })

    it('coerces blocksSpellcasting to boolean via || fallback', () => {
        // blocksSpellcasting: false is the default; passing a truthy string
        // would still be truthy via ||, but passing a falsy value falls through
        const feature = makeFeature({ type: 'combat_stance', blocksSpellcasting: false })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.blocksSpellcasting).toBe(false)
    })

    it('uses empty string default when effect is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', effect: '' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.effect).toBe('')
    })

    it('uses empty string default when damageBonusExpression is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', damageBonusExpression: '' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.damageBonusExpression).toBe('')
    })

    it('uses empty array default when resistanceTypes is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', resistanceTypes: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.resistanceTypes).toEqual([])
    })

    it('uses empty array default when advantages is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', advantages: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.advantages).toEqual([])
    })

    it('uses empty array default when options is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', options: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.options).toEqual([])
    })

    it('uses ragePoints default when resourceKey is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', resourceKey: '' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.resourceKey).toBe('ragePoints')
    })

    it('uses 0 default when uses is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', uses: 0 })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        // 0 is falsy so || falls through to 0 — same result but verifies the behavior
        expect(result.uses).toBe(0)
    })

    it('uses null default when flySpeed is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', flySpeed: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.flySpeed).toBeNull()
    })

    it('uses null default when reactionSave is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', reactionSave: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.reactionSave).toBeNull()
    })

    it('uses false default when blocksSpellcasting is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', blocksSpellcasting: null })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.blocksSpellcasting).toBe(false)
    })

    it('uses empty string default when duration is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', duration: '' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.duration).toBe('')
    })
})
