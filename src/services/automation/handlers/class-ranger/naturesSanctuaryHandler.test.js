import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, handleMove } from './naturesSanctuaryHandler.js'

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((v) => parseInt(v) || 120),
}))

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/useRuntimeState.js')
const { addExpiration } = await import('../../../rules/effects/expirations.js')

beforeEach(() => {
    vi.clearAllMocks()
})

function makePlayerStats(overrides = {}) {
    return {
        name: 'Druid',
        class: {
            name: 'Druid',
            class_levels: [{ level: 14, wild_shape: 4 }],
            major: { type: 'Temperate' },
            ...overrides.class,
        },
        ...overrides,
    }
}

function makeAction(overrides = {}) {
    return {
        name: "Nature's Sanctuary",
        description: 'As a Action, expend Wild Shape to cause spectral trees and vines...',
        automation: {
            type: 'nature_sanctuary',
            range: '120_ft',
            cubeSize: 15,
            duration: '1_minute',
            moveRange: 60,
            movesPerDuration: 1,
            resourceCost: 'wild_shape',
            casting_time: '1 action',
            ...overrides.automation,
        },
        ...overrides,
    }
}

describe("Nature's Sanctuary Handler", () => {
    describe('handle (activation)', () => {
        it('activates sanctuary and returns popup info', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 3
                if (key === 'naturesSanctuaryActive') return null
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats()

            const result = await handle(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.name).toBe("Nature's Sanctuary")
            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'wildShapeUses', 2, 'test-campaign')
            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryActive', true, 'test-campaign')
            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryResistance', 'Lightning', 'test-campaign')
            expect(addExpiration).toHaveBeenCalledWith('Druid', 'Druid', [{ type: 'remove_natures_sanctuary' }], 'test-campaign', 10)
        })

        it('returns error when no wild shape uses remain', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 0
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats()

            const result = await handle(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('No Wild Shape uses remaining')
        })

        it('returns error when sanctuary is already active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 3
                if (key === 'naturesSanctuaryActive') return true
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats()

            const result = await handle(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('already active')
        })

        it('resists arid land type (Fire)', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 3
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats({ class: { major: { type: 'Arid' } } })

            await handle(action, playerStats, 'test-campaign', null)

            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryResistance', 'Fire', 'test-campaign')
        })

        it('resists polar land type (Cold)', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 3
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats({ class: { major: { type: 'Polar' } } })

            await handle(action, playerStats, 'test-campaign', null)

            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryResistance', 'Cold', 'test-campaign')
        })

        it('resists tropical land type (Poison)', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'wildShapeUses') return 3
                return null
            })

            const action = makeAction()
            const playerStats = makePlayerStats({ class: { major: { type: 'Tropical' } } })

            await handle(action, playerStats, 'test-campaign', null)

            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryResistance', 'Poison', 'test-campaign')
        })
    })

    describe('handleMove (bonus action)', () => {
        it('moves sanctuary and decrements moves', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'naturesSanctuaryActive') return true
                if (key === 'naturesSanctuaryMoves') return 1
                return null
            })

            const action = {
                name: "Nature's Sanctuary (Move)",
                automation: {
                    type: 'nature_sanctuary_move',
                    moveRange: 60,
                },
            }
            const playerStats = makePlayerStats()

            const result = await handleMove(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryMoves', 0, 'test-campaign')
        })

        it('returns error when sanctuary not active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'naturesSanctuaryActive') return null
                return null
            })

            const action = {
                name: "Nature's Sanctuary (Move)",
                automation: {
                    type: 'nature_sanctuary_move',
                    moveRange: 60,
                },
            }
            const playerStats = makePlayerStats()

            const result = await handleMove(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('not currently active')
        })

        it('returns error when no moves remaining', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'naturesSanctuaryActive') return true
                if (key === 'naturesSanctuaryMoves') return 0
                return null
            })

            const action = {
                name: "Nature's Sanctuary (Move)",
                automation: {
                    type: 'nature_sanctuary_move',
                    moveRange: 60,
                },
            }
            const playerStats = makePlayerStats()

            const result = await handleMove(action, playerStats, 'test-campaign', null)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('no moves remaining')
        })
    })
})
