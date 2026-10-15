// @maintained-by-ai
// Deterministic contract tests for the Magical Cunning Pact Magic slot-restoration
// handler: rest-usage gate, slot-level selection, half-round-up / Eldritch-Master
// regain math, unconditional Celestial Resilience delegation (popup text append vs
// modal passthrough), and server-first setRuntimeValue write order.
// Pure handler behaviour behind mocked runtime/log/celestial deps — stable, no
// churn expected as the app evolves.
// NOTE: isMagicalCunningUsed has NO production caller (orphaned export, flagged).
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
    handle: vi.fn(),
}))

// Re-import after mocking
const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js')
const celestialResilienceModule = await import('../class-warlock/celestialResilienceHandler.js')
const { addEntry } = await import('../../../ui/logService.js')
const { handle: handleCelestialResilience } = celestialResilienceModule

const campaignName = 'test-campaign'

const defaultAction = { name: 'Magical Cunning', automation: { type: 'magical_cunning' } }

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        level: 5,
        abilities: [{ name: 'Charisma', bonus: 2 }],
        class: { name: 'Warlock', major: {} },
        resources: { warlockPactMagic: { max: 2 } },
        spellAbilities: { spell_slots_level_1: 2 },
        ...overrides,
    }
}

function setupMocks() {
    vi.clearAllMocks()
    handleCelestialResilience.mockResolvedValue(null)
    getRuntimeValue.mockReturnValue(null)
    setRuntimeValue.mockResolvedValue(undefined)
}

describe('magicalCunningHandler', () => {
    beforeEach(setupMocks)

    describe('handle', () => {
        it('returns info popup when already used this rest', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'magicalCunningUsed') return true
                return null
            })

            const result = await handle(defaultAction, makePlayerStats(), campaignName, null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.name).toBe('Magical Cunning')
            expect(result.payload.description).toContain('already been used')
            expect(result.payload.description).toContain('Long Rest')
            expect(result.payload.automation).toEqual({ type: 'magical_cunning' })
            expect(setRuntimeValue).not.toHaveBeenCalled()
            expect(addEntry).not.toHaveBeenCalled()
        })

        it('returns info popup when no Pact Magic spell slots available (empty or undefined spellAbilities)', async () => {
            for (const spellAbilities of [{}, undefined]) {
                const result = await handle(
                    defaultAction,
                    makePlayerStats({ resources: { warlockPactMagic: { max: 0 } }, spellAbilities }),
                    campaignName,
                    null,
                )

                expect(result.type).toBe('popup')
                expect(result.payload.type).toBe('automation_info')
                expect(result.payload.description).toContain('requires Pact Magic spell slots')
                expect(setRuntimeValue).not.toHaveBeenCalled()
                expect(addEntry).not.toHaveBeenCalled()
            }
        })

        it('returns info popup when no slots have been expended (current slots full or runtime undefined)', async () => {
            for (const runtimeValue of [2, undefined]) {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'spell_slots_level_1') return runtimeValue
                    return null
                })

                const result = await handle(defaultAction, makePlayerStats(), campaignName, null)

                expect(result.type).toBe('popup')
                expect(result.payload.type).toBe('automation_info')
                expect(result.payload.description).toContain('No Pact Magic spell slots have been expended')
                expect(setRuntimeValue).not.toHaveBeenCalled()
                expect(addEntry).not.toHaveBeenCalled()
            }
        })

        it('regains half maximum slots (round up) when slots fully expended', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(defaultAction, makePlayerStats(), campaignName, null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe(
                'Magical Cunning: Regained 1 1th-level Pact Magic spell slot. (1/2 slots available)',
            )
            expect(result.payload.automation).toEqual({ type: 'magical_cunning' })

            // Verify call order: slot restore first, then flag
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWarlock', 'spell_slots_level_1', 1, campaignName)
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWarlock', 'magicalCunningUsed', true, campaignName)
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWarlock',
                    abilityName: 'Magical Cunning',
                    description: expect.stringContaining('regaining 1 expended'),
                    timestamp: expect.any(Number),
                }),
            )
        })

        it('regains half maximum slots with rounding up for odd max', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({ resources: { warlockPactMagic: { max: 3 } }, spellAbilities: { spell_slots_level_1: 3 } }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('Regained 2')
            expect(result.payload.description).toContain('(2/3 slots available)')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_1', 2, campaignName)
        })

        it('regains all expended slots for Eldritch Master via automation flag', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                { ...defaultAction, automation: { type: 'magical_cunning', eldritchMaster: true } },
                makePlayerStats({ resources: { warlockPactMagic: { max: 2 } }, spellAbilities: { spell_slots_level_1: 2 } }),
                campaignName,
                null,
            )

            expect(result.payload.description).toBe(
                'Magical Cunning (Eldritch Master): Regained 2 1th-level Pact Magic spell slots. (2/2 slots available)',
            )
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_1', 2, campaignName)
        })

        it('regains all expended slots for Eldritch Master via specialActions', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
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

        it('regains partial slots when not all are expended (normal path)', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'spell_slots_level_1') return 1
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({ resources: { warlockPactMagic: { max: 4 } }, spellAbilities: { spell_slots_level_1: 4 } }),
                campaignName,
                null,
            )

            // expended = 4 - 1 = 3, maxRegain = ceil(4/2) = 2, slotsToRegain = min(3, 2) = 2
            expect(result.payload.description).toContain('Regained 2')
            expect(result.payload.description).toContain('(3/4 slots available)')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_1', 3, campaignName)
        })

        it('uses highest spell slot level available', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
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
            expect(result.payload.description).toContain('Regained 1')
            expect(result.payload.description).toContain('(1/2 slots available)')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_3', 1, campaignName)
        })

        it('uses warlockPactMagic max when available, falling back to spell slot max', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
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

        it('falls back to spell slot max when warlockPactMagic is missing or incomplete', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'spell_slots_level_1') return 0
                return null
            })

            const result = await handle(
                defaultAction,
                makePlayerStats({ resources: {} }),
                campaignName,
                null,
            )

            expect(result.payload.description).toContain('Regained 1')
            expect(result.payload.description).toContain('(1/2 slots available)')
        })

        it('applies Celestial Resilience info when warlock has Celestial Patron', async () => {
            handleCelestialResilience.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    description: 'You gain 3 temporary hit points.',
                },
            })

            getRuntimeValue.mockImplementation((_name, key) => {
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

            expect(handleCelestialResilience).toHaveBeenCalled()
            expect(result.payload.description).toContain('Celestial Resilience')
            expect(result.payload.description).toContain('temporary hit points')
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_1', 1, campaignName)
        })

        it('returns modal when Celestial Resilience has allies in range', async () => {
            handleCelestialResilience.mockResolvedValue({
                type: 'modal',
                modalName: 'celestialResilienceModal',
                payload: {
                    creatureTargets: [{ name: 'Ally1', type: 'player' }],
                    allyTempHp: 4,
                    selfTempHp: 3,
                    maxTargets: 5,
                },
            })

            getRuntimeValue.mockImplementation((_name, key) => {
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
                'test-map',
            )

            expect(result.type).toBe('modal')
            expect(result.modalName).toBe('celestialResilienceModal')
            expect(result.payload.creatureTargets).toHaveLength(1)
            // Slots are still restored (and flag set) even when a modal is returned
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWarlock', 'spell_slots_level_1', 1, campaignName)
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWarlock', 'magicalCunningUsed', true, campaignName)
        })

        it('omits Celestial Resilience text when handler returns null', async () => {
            handleCelestialResilience.mockResolvedValue(null)

            getRuntimeValue.mockImplementation((_name, key) => {
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

            expect(handleCelestialResilience).toHaveBeenCalled()
            expect(result.payload.description).not.toContain('Celestial Resilience')
            expect(result.payload.description).toContain('Regained 1')
        })

        it('omits Celestial Resilience text when handler returns result without payload.description', async () => {
            handleCelestialResilience.mockResolvedValue({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Something' },
            })

            getRuntimeValue.mockImplementation((_name, key) => {
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

            expect(result.payload.description).not.toContain('Celestial Resilience')
            expect(result.payload.description).toContain('Regained 1')
        })
    })

    describe('isMagicalCunningUsed', () => {
        it('returns true when used', () => {
            getRuntimeValue.mockReturnValue(true)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(true)
        })

        it('returns false when not used or falsy', () => {
            getRuntimeValue.mockReturnValue(null)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)

            getRuntimeValue.mockReturnValue(false)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)

            getRuntimeValue.mockReturnValue(undefined)
            expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)
        })
    })
})
