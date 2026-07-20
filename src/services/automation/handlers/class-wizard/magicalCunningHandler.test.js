// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, isMagicalCunningUsed } from './magicalCunningHandler.js'

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../class-warlock/celestialResilienceHandler.js', () => ({
    handle: vi.fn().mockResolvedValue(null),
}))

// Re-import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import { handle as celestialResilienceHandle } from '../class-warlock/celestialResilienceHandler.js'
import { addEntry } from '../../../ui/logService.js'

const campaignName = 'test-campaign'

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    level: 5,
    abilities: [{ name: 'Charisma', bonus: 2 }],
    class: { name: 'Warlock', major: {} },
    resources: { warlockPactMagic: { max: 2 } },
    spellAbilities: { spell_slots_level_1: 2 },
    ...overrides,
})

const defaultAction = { name: 'Magical Cunning', automation: { type: 'magical_cunning' } }

describe('magicalCunningHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('returns info popup when already used this rest', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'magicalCunningUsed') return true
                return null
            })

            const result = await handle(defaultAction, makePlayerStats(), campaignName, null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('already been used')
        })

        it('returns info popup when no Pact Magic spell slots available', async () => {
            getRuntimeValue.mockReturnValue(null)

            const result = await handle(
                defaultAction,
                makePlayerStats({ resources: { warlockPactMagic: { max: 0 } }, spellAbilities: {} }),
                campaignName,
                null,
            )

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('requires Pact Magic spell slots')
        })

        it('returns info popup when no spell slots available', async () => {
            getRuntimeValue.mockReturnValue(null)

            const result = await handle(
                defaultAction,
                makePlayerStats({ spellAbilities: {} }),
                campaignName,
                null,
            )

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('requires Pact Magic')
        })

        it('returns info popup when no slots have been expended', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 2
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats(),
                campaignName,
                null,
            )

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('No Pact Magic spell slots have been expended')
        })

        it('regains half maximum slots (round up) when slots fully expended', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats(),
                campaignName,
                null,
            )

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('Regained 1')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_1', 1, campaignName)
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'magicalCunningUsed', true, campaignName)
        })

        it('regains all expended slots for Eldritch Master via automation flag', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                { name: 'Eldritch Master', automation: { type: 'magical_cunning', eldritchMaster: true } },
                makePlayerStats({ resources: { warlockPactMagic: { max: 2 } }, spellAbilities: { spell_slots_level_1: 2 } }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('Regained 2')
            expect(result.payload.description).toContain('Eldritch Master')
        })

        it('regains all expended slots for Eldritch Master via specialActions', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({
                    resources: { warlockPactMagic: { max: 2 } },
                    spellAbilities: { spell_slots_level_1: 2 },
                    specialActions: [{ name: 'Eldritch Master' }],
                }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('Regained 2')
            expect(result.payload.description).toContain('Eldritch Master')
        })

        it('uses highest spell slot level available', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_3') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({
                    resources: { warlockPactMagic: { max: 2 } },
                    spellAbilities: { spell_slots_level_1: 2, spell_slots_level_2: 1, spell_slots_level_3: 2 },
                }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('3th-level')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_3', 1, campaignName)
        })

        it('applies Celestial Resilience when warlock has Celestial Patron', async () => {
            vi.mocked(grantCelestialResilience).mockResolvedValue({
                selfTempHp: 3,
                message: 'Celestial Resilience: You gain 3 temporary hit points.',
            })

            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({
                    class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
                    specialActions: [{ name: 'Celestial Resilience' }],
                }),
                campaignName,
                null,
            )

            expect(vi.mocked(grantCelestialResilience)).toHaveBeenCalledWith(
                expect.any(Object),
                campaignName,
                'magical_cunning',
            )
            expect(result.payload.description).toContain('Celestial Resilience')
        })

        it('logs an ability_use entry on success', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            await handle(defaultAction, makePlayerStats(), campaignName, null)

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Magical Cunning',
                description: expect.stringContaining('regaining 1 expended Pact Magic spell slot'),
                timestamp: expect.any(Number),
            })
        })

        it('returns correct description format with slot count and max', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({ resources: { warlockPactMagic: { max: 4 } }, spellAbilities: { spell_slots_level_1: 4 } }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('Regained 2')
            expect(result.payload.description).toContain('(2/4 slots available)')
        })
    })

    describe('isMagicalCunningUsed', () => {
        it('returns true when used', () => {
            getRuntimeValue.mockReturnValue(true)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(true)
        })

        it('returns false when not used or null', () => {
            getRuntimeValue.mockReturnValue(null)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)

            getRuntimeValue.mockReturnValue(false)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)
        })
    })
})
