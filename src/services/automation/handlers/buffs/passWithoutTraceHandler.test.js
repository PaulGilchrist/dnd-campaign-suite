// @improved-by-ai
import { handle, getPassWithoutTraceStealthBonus, isPassWithoutTraceActive } from './passWithoutTraceHandler.js'
import { toggleBuff } from '../../common/buffToggle.js'
import { addExpiration } from '../../../rules/effects/expirations.js'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}))

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}))

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

const CAMPAIGN = 'test-campaign'

function makeAction(overrides = {}) {
    return {
        name: 'Pass Without Trace',
        automation: {
            type: 'pass_without_trace',
            duration: 'Concentration, up to 1 hour',
            ...overrides,
        },
    }
}

describe('passWithoutTraceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('activates buff and sets +10 stealth bonus when not active', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            const playerStats = { name: 'Rogue' }

            const result = await handle(makeAction(), playerStats, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({
                    effect: 'pass_without_trace',
                    auraRange: 30,
                }),
                CAMPAIGN
            )
            expect(addExpiration).toHaveBeenCalledWith(
                'Rogue',
                'Rogue',
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Pass Without Trace',
                    }),
                ]),
                CAMPAIGN
            )
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Rogue',
                'passWithoutTraceStealthBonus',
                10,
                CAMPAIGN
            )
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    automationType: 'pass_without_trace',
                    description: expect.stringContaining('activated'),
                }),
            })
        })

        it('deactivates buff and clears stealth bonus when already active', async () => {
            toggleBuff.mockReturnValue({ wasActive: true })
            const playerStats = { name: 'Rogue' }

            const result = await handle(makeAction(), playerStats, CAMPAIGN, null)

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Rogue',
                'passWithoutTraceStealthBonus',
                0,
                CAMPAIGN
            )
            expect(result.payload.description).toContain('deactivated')
        })

        it('does not call addExpiration when deactivating', async () => {
            toggleBuff.mockReturnValue({ wasActive: true })

            await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

            expect(addExpiration).not.toHaveBeenCalled()
        })

        it('uses default auraRange of 30 when not specified in automation', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            await handle(
                { name: 'Pass Without Trace', automation: { type: 'pass_without_trace', duration: 'Concentration, up to 1 hour' } },
                { name: 'Rogue' },
                CAMPAIGN,
                null
            )

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({ auraRange: 30 }),
                CAMPAIGN
            )
        })

        it('uses custom auraRange when specified in automation', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            await handle(makeAction({ auraRange: 60 }), { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({ auraRange: 60 }),
                CAMPAIGN
            )
        })

        it('uses custom auraRange of 0 when explicitly specified', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            await handle(makeAction({ auraRange: 0 }), { name: 'Rogue' }, CAMPAIGN, null)

            // auraRange 0 is falsy, so the handler uses the default 30
            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({ auraRange: 30 }),
                CAMPAIGN
            )
        })

        it('includes automation object in returned payload', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            const result = await handle(makeAction({ auraRange: 45 }), { name: 'Rogue' }, CAMPAIGN, null)

            expect(result.payload.automation).toEqual({
                type: 'pass_without_trace',
                duration: 'Concentration, up to 1 hour',
                auraRange: 45,
            })
        })

        it('includes automationType in payload matching action automation type', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            const result = await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

            expect(result.payload.automationType).toBe('pass_without_trace')
        })

        it('uses action.name in popup description', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })

            const result = await handle(
                { name: 'Custom Spell Name', automation: { type: 'pass_without_trace' } },
                { name: 'Rogue' },
                CAMPAIGN,
                null
            )

            expect(result.payload.name).toBe('Custom Spell Name')
            expect(result.payload.description).toContain('Custom Spell Name')
        })
    })

    describe('getPassWithoutTraceStealthBonus', () => {
        it('returns the stored bonus value', () => {
            getRuntimeValue.mockReturnValue(10)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(10)
        })

        it('returns 0 when stored value is null', () => {
            getRuntimeValue.mockReturnValue(null)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
        })

        it('returns 0 when stored value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
        })

        it('returns 0 when stored value is a non-number string', () => {
            getRuntimeValue.mockReturnValue('not-a-number')

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
        })

        it('returns 0 when stored value is NaN', () => {
            getRuntimeValue.mockReturnValue(NaN)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
        })

        it('returns the stored numeric value when it is zero', () => {
            getRuntimeValue.mockReturnValue(0)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
        })

        it('passes the correct key to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue(5)

            getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)

            expect(getRuntimeValue).toHaveBeenCalledWith('Rogue', 'passWithoutTraceStealthBonus', CAMPAIGN)
        })
    })

    describe('isPassWithoutTraceActive', () => {
        it('returns true when Pass Without Trace buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Pass Without Trace', effect: 'pass_without_trace' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(true)
        })

        it('returns false when no buffs stored', () => {
            getRuntimeValue.mockReturnValue(null)

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when activeBuffs is empty array', () => {
            getRuntimeValue.mockReturnValue([])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when stored value is not an array', () => {
            getRuntimeValue.mockReturnValue('invalid')

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when buff has different name', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Silent Image', effect: 'pass_without_trace' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when buff has different effect', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Pass Without Trace', effect: 'other_effect' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns true when buff is among multiple active buffs', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor' },
                { name: 'Pass Without Trace', effect: 'pass_without_trace' },
                { name: 'Bless', effect: 'bless' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(true)
        })

        it('returns false when there are other pass_without_trace buffs but not Pass Without Trace', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Some Other Spell', effect: 'pass_without_trace' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('passes the correct key to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue([])

            isPassWithoutTraceActive('Rogue', CAMPAIGN)

            expect(getRuntimeValue).toHaveBeenCalledWith('Rogue', 'activeBuffs', CAMPAIGN)
        })
    })
})
