import { triggerPassWithoutTraceSpell, applyPassWithoutTraceEffect } from './passWithoutTraceService.js'
import { executeHandler } from '../../automation/index.js'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../ui/logService.js'

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}))

const CAMPAIGN = 'test-campaign'

function makeSpell(overrides = {}) {
    return {
        name: 'Pass Without Trace',
        level: 2,
        casting_time: '1 action',
        automation: { type: 'pass_without_trace', auraRange: 30 },
        ...overrides,
    }
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'Druid',
        ...overrides,
    }
}

describe('passWithoutTraceService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('triggerPassWithoutTraceSpell', () => {
        it('returns null for non-matching spell name', async () => {
            const result = await triggerPassWithoutTraceSpell(
                { name: 'Bless' },
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )
            expect(result).toBeNull()
        })

        it('returns null when spell name is empty string', async () => {
            const result = await triggerPassWithoutTraceSpell(
                { name: '' },
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )
            expect(result).toBeNull()
        })

        it('uses default slotLevel of 1 when neither metaCtx nor spell has level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' })

            await triggerPassWithoutTraceSpell(
                { name: 'Pass Without Trace' },
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    spellSlotLevel: 1,
                }),
                makePlayerStats(),
                CAMPAIGN,
                null
            )
        })

        it('uses default auraRange of 30 when automation has no auraRange', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' })

            await triggerPassWithoutTraceSpell(
                { name: 'Pass Without Trace', level: 2, automation: { type: 'pass_without_trace' } },
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        auraRange: 30,
                    }),
                }),
                makePlayerStats(),
                CAMPAIGN,
                null
            )
        })

        it('calls executeHandler with correct action for Pass Without Trace', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } })

            await triggerPassWithoutTraceSpell(
                makeSpell(),
                { slotLevel: 2 },
                makePlayerStats(),
                CAMPAIGN,
                null
            )

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Pass Without Trace',
                    automation: expect.objectContaining({
                        type: 'pass_without_trace',
                        auraRange: 30,
                    }),
                }),
                makePlayerStats(),
                CAMPAIGN,
                null
            )
        })

        it('returns the handler result', async () => {
            const expected = { type: 'popup', payload: { type: 'test' } }
            executeHandler.mockResolvedValue(expected)

            const result = await triggerPassWithoutTraceSpell(
                makeSpell(),
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )

            expect(result).toEqual(expected)
        })

        it('returns null when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'))
            const consoleSpy = vi.spyOn(console, 'error')

            const result = await triggerPassWithoutTraceSpell(
                makeSpell(),
                {},
                makePlayerStats(),
                CAMPAIGN,
                null
            )

            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[passWithoutTrace] Failed to execute handler:'),
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })
    })

    describe('applyPassWithoutTraceEffect', () => {
        it('returns null when no target names provided', async () => {
            const result = await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                null
            )
            expect(result).toBeNull()
        })

        it('returns null when target names is empty array', async () => {
            const result = await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                []
            )
            expect(result).toBeNull()
        })

        it('uses default slotLevel of 1 when spell has no level', async () => {
            getRuntimeValue.mockReturnValue([])

            await applyPassWithoutTraceEffect(
                { name: 'Pass Without Trace' },
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        slotLevel: 1,
                    }),
                ]),
                CAMPAIGN
            )
        })

        it('uses default targetEffects when getRuntimeValue returns falsy', async () => {
            getRuntimeValue.mockReturnValue(null)

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Druid',
                    }),
                ]),
                CAMPAIGN
            )
        })

        it('handles non-array storedEffects gracefully', async () => {
            getRuntimeValue.mockReturnValue('not-an-array')

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Druid',
                    }),
                ]),
                CAMPAIGN
            )
        })

        it('uses default casting_time when spell has no casting_time', async () => {
            getRuntimeValue.mockReturnValue([])

            await applyPassWithoutTraceEffect(
                { name: 'Pass Without Trace', level: 2 },
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    castingTime: '1 action',
                })
            )
        })

        it('stores per-target effects in targetEffects', async () => {
            getRuntimeValue.mockReturnValue([])

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid', 'Barbarian', 'Wizard']
            )

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Druid',
                        effect: 'pass_without_trace_bonus',
                        source: 'Druid',
                        bonusExpression: '+10',
                    }),
                    expect.objectContaining({
                        target: 'Barbarian',
                        effect: 'pass_without_trace_bonus',
                        source: 'Druid',
                    }),
                    expect.objectContaining({
                        target: 'Wizard',
                        effect: 'pass_without_trace_bonus',
                        source: 'Druid',
                    }),
                ]),
                CAMPAIGN
            )
        })

        it('adds spell log entry', async () => {
            getRuntimeValue.mockReturnValue([])

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid', 'Barbarian']
            )

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'spell',
                    characterName: 'Druid',
                    targets: ['Druid', 'Barbarian'],
                    spellName: 'Pass Without Trace',
                })
            )
        })

        it('adds automation log entry', async () => {
            getRuntimeValue.mockReturnValue([])

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid', 'Barbarian']
            )

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'automation',
                    characterName: 'Druid',
                    automationType: 'pass_without_trace',
                    description: expect.stringContaining('2 creature(s) affected'),
                })
            )
        })

        it('returns popup with result summary', async () => {
            getRuntimeValue.mockReturnValue([])

            const result = await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid', 'Barbarian', 'Wizard']
            )

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'Pass Without Trace cast: 3 creature(s) affected — Druid, Barbarian, Wizard. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                },
            })
        })

        it('updates existing effects for same caster and target', async () => {
            const existingEffects = [
                { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', old: true },
            ]
            getRuntimeValue.mockReturnValue(existingEffects)

            await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [expect.objectContaining({
                    target: 'Druid',
                    effect: 'pass_without_trace_bonus',
                    source: 'Druid',
                    bonusExpression: '+10',
                })],
                CAMPAIGN
            )
        })

        it('handles addEntry rejection for spell log and logs error', async () => {
            getRuntimeValue.mockReturnValue([])
            addEntry.mockRejectedValue(new Error('DB error'))
            const consoleSpy = vi.spyOn(console, 'error')

            const result = await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'Pass Without Trace cast: 1 creature(s) affected — Druid. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                },
            })

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[passWithoutTrace] Error logging cast:'),
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })

        it('handles addEntry rejection for automation log and logs error', async () => {
            getRuntimeValue.mockReturnValue([])
            addEntry.mockRejectedValueOnce(undefined)
            addEntry.mockRejectedValue(new Error('DB error'))
            const consoleSpy = vi.spyOn(console, 'error')

            const result = await applyPassWithoutTraceEffect(
                makeSpell(),
                makePlayerStats(),
                CAMPAIGN,
                null,
                ['Druid']
            )

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'Pass Without Trace cast: 1 creature(s) affected — Druid. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                },
            })

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[passWithoutTrace] Error logging automation:'),
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })
    })
})
