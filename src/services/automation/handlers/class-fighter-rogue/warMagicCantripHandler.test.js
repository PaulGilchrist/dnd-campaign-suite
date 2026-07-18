// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicCantrip } from './warMagicCantripHandler.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'

const cantripA = { name: 'Ray of Frost', level: 0, casting_time: '1 action', range: '120 feet', description: 'A freezing beam of blue light.', damage: '1d8 cold' }
const cantripB = { name: 'Shocking Grasp', level: 0, casting_time: '1 action', range: 'Self', description: 'A beam of lightning.', damage: '1d6 lightning' }
const nonCantrip = { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'A flash of flames.', damage: '3d6 fire' }

describe('warMagicCantripHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('returns a modal with cantrip options and details', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([cantripA, cantripB, nonCantrip])

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warMagicCantrip',
                payload: {
                    action,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    options: ['Ray of Frost', 'Shocking Grasp'],
                    optionDetails: {
                        'Ray of Frost': {
                            name: 'Ray of Frost',
                            level: 0,
                            casting_time: '1 action',
                            range: '120 feet',
                            description: 'A freezing beam of blue light.',
                            damage: '1d8 cold',
                        },
                        'Shocking Grasp': {
                            name: 'Shocking Grasp',
                            level: 0,
                            casting_time: '1 action',
                            range: 'Self',
                            description: 'A beam of lightning.',
                            damage: '1d6 lightning',
                        },
                    },
                    spellListKey: 'wizard_cantrips',
                },
            })
        })

        it('returns a modal with a custom spellListKey', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([cantripA])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip', spellList: 'sorcerer_cantrips' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('modal')
            expect(result.payload.spellListKey).toBe('sorcerer_cantrips')
        })

        it('returns an info popup when the spell list contains no cantrips', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([nonCantrip])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'No Wizard cantrips available.',
                },
            })
        })

        it('returns an info popup when the spell list is empty', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe('No Wizard cantrips available.')
        })

    })

    describe('confirmWarMagicCantrip', () => {
        it('returns a popup with the selected cantrip and automationType', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, 'Ray of Frost')

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    automationType: 'war_magic_cantrip',
                    description: 'Improved War Magic: Replaced one attack with the cantrip <b>Ray of Frost</b>.',
                    automation: action.automation,
                },
            })
        })

        it('returns an error popup when no cantrip is selected', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, null)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'No cantrip selected.',
                },
            })
        })

        it('logs an ability_use entry with the correct description', async () => {
            const { addEntry } = await import('../../../ui/logService.js')

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, 'Shocking Grasp')

            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Improved War Magic',
                description: 'Improved War Magic: Replaced attack with cantrip "Shocking Grasp"',
            })
        })

        it('does not throw when addEntry rejects', async () => {
            const { addEntry } = await import('../../../ui/logService.js')
            addEntry.mockRejectedValue(new Error('log failed'))

            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_cantrip' },
            }

            const result = await confirmWarMagicCantrip(action, mockPlayerStats, mockCampaignName, 'Ray of Frost')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })
    })
})
