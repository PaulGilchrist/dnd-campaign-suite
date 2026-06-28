import { reactionHandlers } from './reaction.js'

const BASE_STATS = {
    name: 'Test Character',
    proficiency: 2,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 4 },
        { name: 'Charisma', bonus: 5 },
    ],
    class: { class_levels: [{ level: 5 }] },
    level: 5,
}

function makeFeature(overrides, name = 'Protection') {
    return {
        name,
        automation: { type: 'protection', ...overrides },
    }
}

describe('reactionHandlers – protection', () => {
    it('returns type protection with correct defaults', () => {
        const feature = makeFeature({ type: 'protection' })
        const result = reactionHandlers.protection(feature, BASE_STATS)

        expect(result.type).toBe('protection')
        expect(result.name).toBe('Protection')
        expect(result.trigger).toBe('ally_within_5ft_attacked')
        expect(result.range).toBe('5_ft')
        expect(result.requiresShield).toBe(true)
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('uses feature name when provided', () => {
        const feature = makeFeature({ type: 'protection' }, 'Shield Protection')
        const result = reactionHandlers.protection(feature, BASE_STATS)
        expect(result.name).toBe('Shield Protection')
    })

    it('always sets requiresShield to true (Protection always requires a shield)', () => {
        const feature = makeFeature({ type: 'protection', requiresShield: false })
        const result = reactionHandlers.protection(feature, BASE_STATS)
        expect(result.requiresShield).toBe(true)
    })

    it('handles missing automation gracefully', () => {
        const feature = makeFeature({ type: 'protection' })
        const result = reactionHandlers.protection(feature, BASE_STATS)
        expect(result).toBeDefined()
        expect(result.type).toBe('protection')
    })
})
