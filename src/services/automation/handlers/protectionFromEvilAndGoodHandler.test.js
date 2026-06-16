import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, isProtectionFromEvilAndGoodActive, isCreatureWarded } from './protectionFromEvilAndGoodHandler.js'
import { toggleBuff } from '../common/buffToggle.js'
import { addExpiration } from '../../rules/effects/expirations.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

vi.mock('../common/buffToggle.js', () => ({
    toggleBuff: vi.fn()
}))

vi.mock('../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn()
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn()
}))

describe('protectionFromEvilAndGoodHandler', () => {
    const mockPlayerStats = { name: 'Test Character' }
    const campaignName = 'test-campaign'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns automation_info popup on activation', async () => {
        toggleBuff.mockReturnValue({ wasActive: false })

        const action = {
            name: 'Protection from Evil and Good',
            automation: {
                type: 'protection_from_evil_and_good',
                wardedCreatureTypes: ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'],
                duration: 'Concentration, up to 10 minutes',
                casting_time: '1 action',
                range: 'Touch'
            }
        }

        const result = await handle(action, mockPlayerStats, campaignName, 'test-map')

        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.name).toBe('Protection from Evil and Good')
        expect(result.payload.automationType).toBe('protection_from_evil_and_good')
        expect(result.payload.description).toContain('activated')
        expect(toggleBuff).toHaveBeenCalledWith(
            'Test Character',
            'Protection from Evil and Good',
            expect.objectContaining({ effect: 'protection_from_evil_and_good' }),
            campaignName
        )
        expect(addExpiration).toHaveBeenCalledWith(
            'Test Character',
            'Test Character',
            expect.arrayContaining([expect.objectContaining({ type: 'remove_active_buff' })]),
            campaignName
        )
    })

    it('returns automation_info popup on deactivation', async () => {
        toggleBuff.mockReturnValue({ wasActive: true })

        const action = {
            name: 'Protection from Evil and Good',
            automation: { type: 'protection_from_evil_and_good' }
        }

        const result = await handle(action, mockPlayerStats, campaignName, 'test-map')

        expect(result.type).toBe('popup')
        expect(result.payload.description).toContain('deactivated')
    })

    it('isProtectionFromEvilAndGoodActive returns true when buff is active', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' }
        ])

        expect(isProtectionFromEvilAndGoodActive('Test Character', campaignName)).toBe(true)
    })

    it('isProtectionFromEvilAndGoodActive returns false when buff is not active', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Some Other Spell', effect: 'some_effect' }
        ])

        expect(isProtectionFromEvilAndGoodActive('Test Character', campaignName)).toBe(false)
    })

    it('isCreatureWarded returns true for warded creature types', () => {
        getRuntimeValue.mockReturnValue(['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'])

        expect(isCreatureWarded('Aberration', 'Test Character', campaignName)).toBe(true)
        expect(isCreatureWarded('Fiend', 'Test Character', campaignName)).toBe(true)
        expect(isCreatureWarded('Undead', 'Test Character', campaignName)).toBe(true)
    })

    it('isCreatureWarded returns false for non-warded creature types', () => {
        getRuntimeValue.mockReturnValue(['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'])

        expect(isCreatureWarded('Humanoid', 'Test Character', campaignName)).toBe(false)
        expect(isCreatureWarded('Dragon', 'Test Character', campaignName)).toBe(false)
    })

    it('isCreatureWarded returns false when no warded types are stored', () => {
        getRuntimeValue.mockReturnValue([])

        expect(isCreatureWarded('Aberration', 'Test Character', campaignName)).toBe(false)
    })

    it('isCreatureWarded handles case-insensitive type matching', () => {
        getRuntimeValue.mockReturnValue(['Aberration', 'Celestial'])

        expect(isCreatureWarded('aberration', 'Test Character', campaignName)).toBe(true)
        expect(isCreatureWarded('ABERRATION', 'Test Character', campaignName)).toBe(true)
    })
})
