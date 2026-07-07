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
    })

    describe('getPassWithoutTraceStealthBonus', () => {
        it('returns the stored bonus value', () => {
            getRuntimeValue.mockReturnValue(10)

            expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(10)
        })

        it('returns 0 for null, undefined, NaN, non-number strings, and zero', () => {
            const values = [null, undefined, NaN, 'not-a-number', 0]

            for (const val of values) {
                getRuntimeValue.mockReturnValue(val)

                expect(getPassWithoutTraceStealthBonus('Rogue', CAMPAIGN)).toBe(0)
            }
        })
    })

    describe('isPassWithoutTraceActive', () => {
        it('returns true when Pass Without Trace buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Pass Without Trace', effect: 'pass_without_trace' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(true)
        })
    })
})
