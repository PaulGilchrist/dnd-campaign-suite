// @maintained-by-ai — deterministic handler contract: all deps mocked, static inputs,
// exact payloads pinned. Only rework if the handler's popup/toggle/expiration contract changes.
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
        it('activates buff, registers expiration, and returns target selection popup at default range 30', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Rogue' },
                    { name: 'Barbarian' },
                    { name: 'Wizard' },
                ],
            })

            const action = makeAction()
            const result = await handle(action, { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                {
                    type: 'pass_without_trace',
                    duration: 'Concentration, up to 1 hour',
                    effect: 'pass_without_trace',
                    auraRange: 30,
                },
                CAMPAIGN
            )
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Rogue',
                targetName: 'Rogue',
                effects: [{ type: 'remove_active_buff', buffName: 'Pass Without Trace' }],
                campaignName: CAMPAIGN,
            })
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'pass_without_trace_target_selection',
                    name: 'Pass Without Trace',
                    creatureTargets: ['Rogue', 'Barbarian', 'Wizard'],
                    auraRange: 30,
                    automation: action.automation,
                },
            })
        })

        it('propagates custom auraRange to toggleBuff and popup', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Rogue' }],
            })

            const action = makeAction({ auraRange: 60 })
            const result = await handle(action, { name: 'Rogue' }, CAMPAIGN, null)

            expect(toggleBuff).toHaveBeenCalledWith(
                'Rogue',
                'Pass Without Trace',
                expect.objectContaining({ auraRange: 60 }),
                CAMPAIGN
            )
            expect(result.payload).toEqual({
                type: 'pass_without_trace_target_selection',
                name: 'Pass Without Trace',
                creatureTargets: ['Rogue'],
                auraRange: 60,
                automation: action.automation,
            })
        })

        it('returns info popup when no combat context', async () => {
            toggleBuff.mockReturnValue({ wasActive: false })
            getCombatContext.mockResolvedValue(null)

            const result = await handle(makeAction(), { name: 'Rogue' }, CAMPAIGN, null)

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

            expect(addExpiration).not.toHaveBeenCalled()
            expect(result.payload.type).toBe('pass_without_trace_target_selection')
        })

        it('throws when playerStats is null', async () => {
            await expect(
                handle(makeAction(), null, CAMPAIGN, null)
            ).rejects.toThrow(TypeError)
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

        it('returns false when activeBuffs is null or undefined', () => {
            getRuntimeValue.mockReturnValue(null)
            expect(isPassWithoutTraceActive('Rogue', CAMPAIGN)).toBe(false)

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
