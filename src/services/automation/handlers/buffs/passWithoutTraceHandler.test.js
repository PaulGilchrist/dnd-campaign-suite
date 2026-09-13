// @improved-by-ai
// @cleaned-by-ai
import { handle, isPassWithoutTraceActive } from './passWithoutTraceHandler.js'
import { toggleBuff } from '../../common/buffToggle.js'
import { addExpiration } from '../../../rules/effects/expirations.js'
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import { getCombatContext } from '../../../rules/combat/damageUtils.js'

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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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
        it('returns target selection popup when spell is activated', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Rogue' },
                    { name: 'Barbarian' },
                    { name: 'Wizard' },
                ],
            })
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
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Rogue', targetName: 'Rogue', effects: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Pass Without Trace',
                    }),
                ]), campaignName: CAMPAIGN })
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'pass_without_trace_target_selection',
                    name: 'Pass Without Trace',
                    creatureTargets: ['Rogue', 'Barbarian', 'Wizard'],
                    auraRange: 30,
                }),
            })
        })

        it('returns target selection popup with custom auraRange', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Rogue' }],
            })

            const result = await handle(makeAction({ auraRange: 60 }), { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({ auraRange: 60 }),
                CAMPAIGN
            )
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Rogue', targetName: 'Rogue', effects: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Pass Without Trace',
                    }),
                ]), campaignName: CAMPAIGN })
            expect(result.payload.auraRange).toBe(60)
        })

        it('returns info popup when no combat context', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue(null)

            const result = await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({
                    effect: 'pass_without_trace',
                    auraRange: 30,
                }),
                CAMPAIGN
            )
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Rogue', targetName: 'Rogue', effects: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Pass Without Trace',
                    }),
                ]), campaignName: CAMPAIGN })
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'No combat context found. Cannot apply Pass Without Trace.',
                },
            })
        })

        it('does not call addExpiration when buff is already active', async () => {
            toggleBuff.mockReturnValue({ wasActive: true })
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Rogue' }],
            })

            const result = await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({
                    effect: 'pass_without_trace',
                    auraRange: 30,
                }),
                CAMPAIGN
            )
            expect(addExpiration).not.toHaveBeenCalled()
            expect(result.payload.type).toBe('pass_without_trace_target_selection')
        })

        it('returns target selection popup with empty creature list', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({ creatures: [] })

            const result = await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'pass_without_trace_target_selection',
                    creatureTargets: [],
                    auraRange: 30,
                }),
            })
        })

        it('throws when playerStats is null', async () => {
            await expect(
                handle(makeAction(), null, CAMPAIGN, null)
            ).rejects.toThrow()
        })

        it('uses default auraRange of 30 when automation has no auraRange', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Rogue' }],
            })

            await handle(
                { name: 'Pass Without Trace', automation: { type: 'pass_without_trace' } },
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
    })

    describe('isPassWithoutTraceActive', () => {
        it('returns true when Pass Without Trace buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Pass Without Trace', effect: 'pass_without_trace' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(true)
        })

        it('returns false when buff is not active', () => {
            getRuntimeValue.mockReturnValue([])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when activeBuffs is null', () => {
            getRuntimeValue.mockReturnValue(null)

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when activeBuffs is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined)

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })

        it('returns false when buff has matching name but wrong effect', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Pass Without Trace', effect: 'something_else' },
            ])

            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)
        })
    })
})
