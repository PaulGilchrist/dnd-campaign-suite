import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, isMagicalCunningUsed } from './magicalCunningHandler.js'

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}))

// Re-import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js'

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

describe('magicalCunningHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns popup when already used this rest', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'magicalCunningUsed') return true
            return null
        })

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats(),
            campaignName,
            null,
        )

        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('already been used')
    })

    it('returns popup when no Pact Magic slots', async () => {
        getRuntimeValue.mockReturnValue(null)

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats({ resources: { warlockPactMagic: { max: 0 } } }),
            campaignName,
            null,
        )

        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('requires Pact Magic')
    })

    it('returns popup when no spell slots available', async () => {
        getRuntimeValue.mockReturnValue(null)

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats({ spellAbilities: {} }),
            campaignName,
            null,
        )

        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('requires Pact Magic')
    })

    it('returns popup when no slots expended', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'spell_slots_level_1') return 2
            return null
        })

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats(),
            campaignName,
            null,
        )

        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('No Pact Magic spell slots have been expended')
    })

    it('regains half maximum slots (round up) when slots expended', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'spell_slots_level_1') return 0
            return null
        })

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
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

    it('respects max regain cap (half maximum round up)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'spell_slots_level_1') return 0
            return null
        })

        // Player has 2 max slots, can only regain 1 (ceil(2/2) = 1)
        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats({ resources: { warlockPactMagic: { max: 2 } }, spellAbilities: { spell_slots_level_1: 2 } }),
            campaignName,
            null,
        )

        expect(result.payload.description).toContain('Regained 1')
    })

    it('Eldritch Master regains ALL expended slots', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
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
    })

    it('returns popup when fewer expended than max regain', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'spell_slots_level_1') return 1
            return null
        })

        // 1 expended, max regain = 1 (ceil(2/2)), so regain 1
        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats({ resources: { warlockPactMagic: { max: 2 } }, spellAbilities: { spell_slots_level_1: 2 } }),
            campaignName,
            null,
        )

        expect(result.payload.description).toContain('Regained 1')
    })

    it('returns popup when all slots full (already caught by expended check)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'spell_slots_level_1') return 2
            return null
        })

        const result = await handle(
            { name: 'Magical Cunning', automation: { type: 'magical_cunning' } },
            makePlayerStats(),
            campaignName,
            null,
        )

        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('No Pact Magic spell slots have been expended')
    })

    it('isMagicalCunningUsed returns true when used', () => {
        getRuntimeValue.mockReturnValue(true)
        expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(true)
    })

    it('isMagicalCunningUsed returns false when not used', () => {
        getRuntimeValue.mockReturnValue(false)
        expect(isMagicalCunningUsed('TestWarlock', campaignName)).toBe(false)
    })
})
