import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicCantrip } from './warMagicCantripHandler.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

describe('warMagicCantripHandler', () => {
    const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
    const mockCampaignName = 'test-campaign'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('should return a modal with modalName warMagicCantrip', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Ray of Frost', level: 0 },
                { name: 'Shocking Grasp', level: 0 },
                { name: 'Burning Hands', level: 1 },
            ])

            const action = {
                name: 'Improved War Magic',
                automation: {
                    type: 'war_magic_cantrip',
                    spellList: 'wizard_cantrips',
                    action: 'action',
                    casting_time: '1 action',
                },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('modal')
            expect(result.modalName).toBe('warMagicCantrip')
            expect(result.payload.options).toEqual(['Ray of Frost', 'Shocking Grasp'])
            expect(result.payload.spellListKey).toBe('wizard_cantrips')
        })

        it('should filter out non-cantrips from options', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Ray of Frost', level: 0 },
                { name: 'Burning Hands', level: 1 },
                { name: 'Shield', level: 1 },
            ])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.payload.options).toEqual(['Ray of Frost'])
        })

        it('should return popup when no cantrips available', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1 },
            ])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })

        it('should return popup when no spells available', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('popup')
        })

        it('should default spellList to wizard_cantrips', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([{ name: 'Ray of Frost', level: 0 }])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            await handle(action, mockPlayerStats, mockCampaignName)

            expect(loadSpellData).toHaveBeenCalledWith('wizard_cantrips', mockPlayerStats)
        })
    })

    describe('confirmWarMagicCantrip', () => {
        it('should return automation_info popup with selected cantrip', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, 'Ray of Frost')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('Ray of Frost')
            expect(result.payload.automationType).toBe('war_magic_cantrip')
        })

        it('should return error popup when no spell selected', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('No cantrip selected')
        })

        it('should log ability_use entry', async () => {
            const { addEntry } = await import('../../../ui/logService.js')
            addEntry.mockResolvedValue()

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, 'Shocking Grasp')

            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: mockPlayerStats.name,
                abilityName: 'Improved War Magic',
                description: 'Improved War Magic: Replaced attack with cantrip "Shocking Grasp"',
            })
        })
    })
})
