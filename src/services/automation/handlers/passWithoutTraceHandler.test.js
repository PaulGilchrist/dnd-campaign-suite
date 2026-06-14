import { handle, getPassWithoutTraceStealthBonus, isPassWithoutTraceActive } from './passWithoutTraceHandler.js'
import { toggleBuff } from '../common/buffToggle.js'
import { addExpiration } from '../../rules/expirations.js'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js'

vi.mock('../common/buffToggle.js', () => ({
    toggleBuff: vi.fn()
}))

vi.mock('../../rules/expirations.js', () => ({
    addExpiration: vi.fn()
}))

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn()
}))

describe('Pass Without Trace handler', () => {
    const mockAction = {
        name: 'Pass Without Trace',
        automation: {
            type: 'pass_without_trace',
            duration: 'Concentration, up to 1 hour',
            auraRange: 30
        }
    }
    const mockPlayerStats = { name: 'Test Character' }
    const campaignName = 'test-campaign'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('activates the buff and sets stealth bonus when not active', async () => {
        toggleBuff.mockReturnValue({ wasActive: false })

        const result = await handle(mockAction, mockPlayerStats, campaignName, null)

        expect(toggleBuff).toHaveBeenCalledWith(
            'Test Character',
            'Pass Without Trace',
            expect.objectContaining({
                effect: 'pass_without_trace',
                auraRange: 30
            }),
            campaignName
        )
        expect(addExpiration).toHaveBeenCalledWith(
            'Test Character',
            'Test Character',
            expect.arrayContaining([
                expect.objectContaining({ type: 'remove_active_buff', buffName: 'Pass Without Trace' })
            ]),
            campaignName
        )
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            'passWithoutTraceStealthBonus',
            10,
            campaignName
        )
        expect(result.type).toBe('popup')
        expect(result.payload.type).toBe('automation_info')
        expect(result.payload.description).toContain('activated')
        expect(result.payload.description).toContain('+10')
    })

    it('deactivates the buff and clears stealth bonus when already active', async () => {
        toggleBuff.mockReturnValue({ wasActive: true })

        const result = await handle(mockAction, mockPlayerStats, campaignName, null)

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            'passWithoutTraceStealthBonus',
            0,
            campaignName
        )
        expect(result.payload.description).toContain('deactivated')
    })

    it('uses default auraRange of 30 when not specified', async () => {
        const actionNoRange = {
            name: 'Pass Without Trace',
            automation: {
                type: 'pass_without_trace',
                duration: 'Concentration, up to 1 hour'
            }
        }
        toggleBuff.mockReturnValue({ wasActive: false })

        await handle(actionNoRange, mockPlayerStats, campaignName, null)

        expect(toggleBuff).toHaveBeenCalledWith(
            'Test Character',
            'Pass Without Trace',
            expect.objectContaining({ auraRange: 30 }),
            campaignName
        )
    })

    it('getPassWithoutTraceStealthBonus returns stored value', () => {
        getRuntimeValue.mockReturnValue(10)
        expect(getPassWithoutTraceStealthBonus('Test Character', campaignName)).toBe(10)
    })

    it('getPassWithoutTraceStealthBonus returns 0 when not set', () => {
        getRuntimeValue.mockReturnValue(null)
        expect(getPassWithoutTraceStealthBonus('Test Character', campaignName)).toBe(0)
    })

    it('isPassWithoutTraceActive returns true when buff is active', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Pass Without Trace', effect: 'pass_without_trace' }
        ])
        expect(isPassWithoutTraceActive('Test Character', campaignName)).toBe(true)
    })

    it('isPassWithoutTraceActive returns false when buff is not active', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Some Other Spell', effect: 'some_effect' }
        ])
        expect(isPassWithoutTraceActive('Test Character', campaignName)).toBe(false)
    })
})
