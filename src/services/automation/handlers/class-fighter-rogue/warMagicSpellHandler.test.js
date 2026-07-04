// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicSpell } from './warMagicSpellHandler.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'

const level1Spell = { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'A flash of flames.', damage: '3d6 fire' }
const level2Spell = { name: 'Web', level: 2, casting_time: '1 action', range: 'Self', description: 'A sheet of sticky webbing.', damage: null }
const cantrip = { name: 'Ray of Frost', level: 0 }
const level3Spell = { name: 'Fireball', level: 3 }


describe('warMagicSpellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('returns a modal with filtered spell options and details', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([level1Spell, level2Spell, cantrip, level3Spell])

            const action = {
                name: 'Improved War Magic',
                automation: {
                    type: 'war_magic_spell',
                    spellList: 'wizard_spells',
                    maxSpellLevel: 2,
                },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warMagicSpell',
                payload: {
                    action,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    options: ['Burning Hands', 'Web'],
                    optionDetails: {
                        'Burning Hands': {
                            name: 'Burning Hands',
                            level: 1,
                            casting_time: '1 action',
                            range: 'Self',
                            description: 'A flash of flames.',
                            damage: '3d6 fire',
                        },
                        'Web': {
                            name: 'Web',
                            level: 2,
                            casting_time: '1 action',
                            range: 'Self',
                            description: 'A sheet of sticky webbing.',
                            damage: null,
                        },
                    },
                    spellListKey: 'wizard_spells',
                    maxSpellLevel: 2,
                },
            })
        })

        it('uses custom spellListKey when specified', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([level1Spell])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell', spellList: 'sorcerer_spells', maxSpellLevel: 3 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.payload.spellListKey).toBe('sorcerer_spells')
        })

        it('returns an info popup when the spell list is empty or null', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'No Wizard spells available.',
                },
            })
        })

        it('returns an info popup when no eligible spells remain after filtering', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([cantrip, level3Spell])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'No Wizard spells of level 1-2 available.',
                },
            })
        })

        it('uses fallback defaults for missing spell properties in optionDetails', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([{ name: 'Minor Spell', level: 1 }])

            const action = {
                name: 'War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await handle(action, mockPlayerStats, mockCampaignName)

            expect(result.payload.optionDetails['Minor Spell']).toEqual({
                name: 'Minor Spell',
                level: 1,
                casting_time: '1 action',
                range: '',
                description: '',
                damage: null,
            })
        })
    })

    describe('confirmWarMagicSpell', () => {
        it('returns a popup with the selected spell and automationType', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
            }

            const result = await confirmWarMagicSpell(action, mockPlayerStats, mockCampaignName, 'Burning Hands')

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    automationType: 'war_magic_spell',
                    description: 'Improved War Magic: Replaced one attack with the level 2 spell <b>Burning Hands</b>.',
                    automation: action.automation,
                },
            })
        })

        it('returns an error popup when no spell is selected', async () => {
            const action = {
                name: 'Improved War Magic',
                automation: { type: 'war_magic_spell' },
            }

            const result = await confirmWarMagicSpell(action, mockPlayerStats, mockCampaignName, null)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'No spell selected.',
                },
            })
        })

        it('logs an ability_use entry with the correct description', async () => {
            const { addEntry } = await import('../../../ui/logService.js')

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
