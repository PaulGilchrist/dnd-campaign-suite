import { describe, it, expect } from 'vitest'
import { utilityHandlers } from './utility-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── brew_poison ──────────────────────────────────────────────────────

describe('utilityHandlers – brew_poison', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'brew_poison' })
        const result = utilityHandlers.brew_poison(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'brew_poison',
            description: '',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── apply_poison ─────────────────────────────────────────────────────

describe('utilityHandlers – apply_poison', () => {
    it('computes saveDc from max(DEX, INT) modifiers + proficiency', () => {
        const feature = makeFeature({ type: 'apply_poison' })
        const result = utilityHandlers.apply_poison(feature, BASE_STATS)
        expect(result.type).toBe('apply_poison')
        // dexMod=2, intMod=1, max=2, prof=3, saveDc=8+2+3=13
        expect(result.saveDc).toBe(13)
        expect(result.poisonerAbilityModifier).toBe(2)
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('Poison')
        expect(result.condition).toBe('poisoned')
        expect(result.saveType).toBe('CON')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('uses INT modifier when higher than DEX', () => {
        const stats = {
            ...BASE_STATS,
            abilities: [
                { name: 'Strength', bonus: 1 },
                { name: 'Dexterity', bonus: 0 },
                { name: 'Constitution', bonus: 1 },
                { name: 'Intelligence', bonus: 4 },
                { name: 'Wisdom', bonus: 1 },
                { name: 'Charisma', bonus: 1 },
            ]
        }
        const feature = makeFeature({ type: 'apply_poison' })
        const result = utilityHandlers.apply_poison(feature, stats)
        // dexMod=0, intMod=4, max=4, prof=3, saveDc=8+4+3=15
        expect(result.saveDc).toBe(15)
        expect(result.poisonerAbilityModifier).toBe(4)
    })
})
