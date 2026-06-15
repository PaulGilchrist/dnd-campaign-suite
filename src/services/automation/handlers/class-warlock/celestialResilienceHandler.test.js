import { describe, it, expect, vi, beforeEach } from 'vitest'
import { grantCelestialResilience, handle } from './celestialResilienceHandler.js'

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn().mockResolvedValue({ players: [] }),
}))

vi.mock('../../../combat/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr, ps) => {
        if (expr.includes('warlock level + CHA')) {
            return (ps.level || 0) + (ps.abilities?.find(a => a.name === 'Charisma')?.bonus || 0)
        }
        if (expr.includes('floor(warlock level / 2) + CHA')) {
            const warlockLevel = ps.level || 0
            const chaMod = ps.abilities?.find(a => a.name === 'Charisma')?.bonus || 0
            return Math.floor(warlockLevel / 2) + chaMod
        }
        return 0
    }),
}))

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js'

const campaignName = 'test-campaign'
const mapName = 'test-map'

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    level: 10,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    class: { major: {}, subclass: {} },
    ...overrides,
})

const celestialPlayerStats = (overrides = {}) => ({
    ...makePlayerStats(overrides),
    class: {
        major: { name: 'Celestial Patron' },
        subclass: { name: 'Celestial Patron' },
    },
    characterAdvancement: [
        { name: 'Celestial Resilience', automation: {
            type: 'celestial_resilience',
            tempHpExpression: 'warlock level + CHA modifier',
            allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
            maxAllies: 5,
            range: '60_ft',
        }},
    ],
})

describe('celestialResilienceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('grantCelestialResilience', () => {
        it('returns null for non-Celestial patrons', async () => {
            const result = await grantCelestialResilience(
                makePlayerStats({ class: { major: { name: 'Fiend Patron' } } }),
                campaignName,
                'magical_cunning',
                mapName,
            )
            expect(result).toBeNull()
        })

        it('returns null when feature not in character advancement', async () => {
            const result = await grantCelestialResilience(
                makePlayerStats({
                    class: { major: { name: 'Celestial Patron' } },
                    characterAdvancement: [],
                }),
                campaignName,
                'magical_cunning',
                mapName,
            )
            expect(result).toBeNull()
        })

        it('grants self temp HP on rest trigger', async () => {
            getRuntimeValue.mockReturnValue(0)

            const result = await grantCelestialResilience(
                celestialPlayerStats(),
                campaignName,
                'rest',
                null,
            )

            expect(result).not.toBeNull()
            expect(result.selfTempHp).toBe(13) // level 10 + cha 3
            expect(result.message).toContain('13 temporary hit points')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'tempHp', 13, campaignName)
        })

        it('grants self temp HP on magical cunning trigger', async () => {
            getRuntimeValue.mockReturnValue(0)

            const result = await grantCelestialResilience(
                celestialPlayerStats(),
                campaignName,
                'magical_cunning',
                mapName,
            )

            expect(result).not.toBeNull()
            expect(result.selfTempHp).toBe(13)
            expect(result.allyTempHp).toBe(8) // floor(10/2) + 3
            expect(result.maxAllies).toBe(5)
        })

        it('adds to existing temp HP', async () => {
            getRuntimeValue.mockReturnValue(5)

            await grantCelestialResilience(
                celestialPlayerStats(),
                campaignName,
                'rest',
                null,
            )

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'tempHp', 18, campaignName)
        })
    })

    describe('handle', () => {
        it('returns popup with description when granted', async () => {
            getRuntimeValue.mockReturnValue(0)

            const result = await handle(
                { name: 'Celestial Resilience', automation: { type: 'celestial_resilience' } },
                celestialPlayerStats(),
                campaignName,
                mapName,
            )

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('Celestial Resilience')
            expect(result.payload.description).toContain('temporary hit points')
        })

        it('returns null for non-Celestial patron', async () => {
            const result = await handle(
                { name: 'Celestial Resilience', automation: { type: 'celestial_resilience' } },
                makePlayerStats({ class: { major: { name: 'Fiend Patron' } } }),
                campaignName,
                mapName,
            )

            expect(result).toBeNull()
        })
    })
})
