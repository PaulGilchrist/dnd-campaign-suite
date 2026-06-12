import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicSpell } from './warMagicSpellHandler.js'

vi.mock('../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

describe('warMagicSpellHandler', () => {
    const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
    const mockCampaignName = 'test-campaign'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('should return a modal with modalName warMagicSpell', async () => {
            const { loadSpellData } = await import('../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1 },
                { name: 'Shield', level: 1 },
                { name: 'Web', level: 2 },
                { name: 'Ray of Frost', level: 0 },
            ])

            const action = {
                name: 'Improved War Magic',
                automation: {
                    type: 'war_magic_spell',
                    spellList: 'wizard_spells',
                    maxSpellLevel: 2,
                    action: 'action',
                    casting_time: '1 action',
                    replacesWarMagic: true,
                },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('modal')
            expect(result.modalName).toBe('warMagicSpell')
            expect(result.payload.options).toEqual(['Burning Hands', 'Shield', 'Web'])
            expect(result.payload.maxSpellLevel).toBe(2)
            expect(result.payload.spellListKey).toBe('wizard_spells')
        })

        it('should filter out cantrips and level 3+ spells', async () => {
            const { loadSpellData } = await import('../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1 },
                { name: 'Web', level: 2 },
                { name: 'Ray of Frost', level: 0 },
                { name: 'Fireball', level: 3 },
            ])

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.payload.options).toEqual(['Burning Hands', 'Web'])
        })

        it('should return popup when no eligible spells available', async () => {
            const { loadSpellData } = await import('../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Ray of Frost', level: 0 },
                { name: 'Fireball', level: 3 },
            ])

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('level 1-2')
        })

        it('should default maxSpellLevel to 2', async () => {
            const { loadSpellData } = await import('../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                { name: 'Burning Hands', level: 1 },
                { name: 'Fireball', level: 3 },
            ])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.payload.options).toEqual(['Burning Hands'])
        })

        it('should default spellList to wizard_spells', async () => {
            const { loadSpellData } = await import('../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([{ name: 'Burning Hands', level: 1 }])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell' },
            }

            await handle(action, mockPlayerStats, mockCampaignName)

            expect(loadSpellData).toHaveBeenCalledWith('wizard_spells', mockPlayerStats)
        })
    })

    describe('confirmWarMagicSpell', () => {
        it('should return automation_info popup with selected spell', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await confirmWarMagicSpell(action, mockPlayerStats, mockCampaignName, 'Burning Hands')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('Burning Hands')
            expect(result.payload.description).toContain('level 2')
            expect(result.payload.automationType).toBe('war_magic_spell')
        })

        it('should return error popup when no spell selected', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell' },
            }

            const result = await confirmWarMagicSpell(action, mockPlayerStats, mockCampaignName, null)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toContain('No spell selected')
        })

        it('should log ability_use entry', async () => {
            const { addEntry } = await import('../../ui/logService.js')
            addEntry.mockResolvedValue()

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            await confirmWarMagicSpell(action, mockPlayerStats, mockCampaignName, 'Shield')

            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: mockPlayerStats.name,
                abilityName: 'Improved War Magic',
                description: 'Improved War Magic: Replaced attack with spell "Shield"',
            })
        })
    })
})
