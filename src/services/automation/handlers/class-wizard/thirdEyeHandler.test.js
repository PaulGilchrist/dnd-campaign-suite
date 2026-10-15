// @maintained-by-ai
// Deterministic unit contract for the Third Eye automation handler (2024 wizard feature):
// already-active popup/refusal-log branches, option-selection modal payload, strict
// buff-table writes to the runtime store, and unknown-option rejection. Both exports
// are live: handle -> third_eye in services/automation/index.js router,
// applyThirdEye -> ThirdEyeModal.jsx. Only direct deps (runtime store, buffToggle)
// are mocked; no timers, no DOM, pure handler behaviour. Timestamps are destructured
// out of exact-object pins.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyThirdEye } from './thirdEyeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../../services/automation/common/buffToggle.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

const campaignName = 'TestCampaign';
const DURATION_TEXT = 'Duration: until start of Short or Long Rest';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'The Third Eye',
        automation: { type: 'third_eye', casting_time: '1 bonus action' },
        ...overrides,
    };
}

function setupMocks(getBuffsReturnValue, existingBuffs = []) {
    getActiveBuffs.mockReturnValue(getBuffsReturnValue);
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        return null;
    });
    setRuntimeValue.mockResolvedValue(undefined);
}

// Pin an object exactly, tolerating only the volatile timestamp field.
function expectExactExceptTimestamp(actual, expected) {
    const { timestamp, ...rest } = actual;
    expect(typeof timestamp).toBe('number');
    expect(rest).toEqual(expected);
}

describe('thirdEyeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup and refusal log when the feature is already active with a known effect', async () => {
            setupMocks([
                { name: 'Custom Third Eye', effect: 'see_invisibility' },
            ]);

            const action = makeAction({ name: 'Custom Third Eye' });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Custom Third Eye');
            expect(result.payload.description).toBe(
                `Custom Third Eye is currently active: See Invisibility. ${DURATION_TEXT}.`
            );
            expect(result.payload.automation).toBe(action.automation);
            expect(result.logEntries).toHaveLength(1);
            expectExactExceptTimestamp(result.logEntries[0], {
                type: 'automation',
                creatureName: 'TestWizard',
                name: 'Custom Third Eye',
                description: `TestWizard's Custom Third Eye is already active (See Invisibility) — no new benefit gained.`,
            });
        });

        it('shows the raw effect key when the active buff effect is unrecognized', async () => {
            setupMocks([
                { name: 'The Third Eye', effect: 'some_unknown_effect' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                `The Third Eye is currently active: some_unknown_effect. ${DURATION_TEXT}.`
            );
            expect(result.logEntries[0].description).toContain('some_unknown_effect');
        });

        it.each([
            ['missing effect', { name: 'The Third Eye' }],
            ['null effect', { name: 'The Third Eye', effect: null }],
        ])('falls back to Unknown when active buff has %s', async (_label, buff) => {
            setupMocks([buff]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                `The Third Eye is currently active: Unknown. ${DURATION_TEXT}.`
            );
        });

        it('returns the option modal when the feature is not active', async () => {
            setupMocks([]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('thirdEye');
            expect(result.payload).toEqual({ action, playerStats, campaignName });
        });
    });

    describe('applyThirdEye', () => {
        // Strict option table: option label -> exact buff shape and rules copy.
        const OPTION_TABLE = [
            {
                option: 'Darkvision (120 feet)',
                effect: 'darkvision_120',
                darkvisionRange: '120 ft.',
                seeInvisibleRange: null,
                benefit: 'You gain Darkvision out to a range of 120 feet.',
            },
            {
                option: 'Greater Comprehension',
                effect: 'greater_comprehension',
                darkvisionRange: null,
                seeInvisibleRange: null,
                benefit: 'You can read any language.',
            },
            {
                option: 'See Invisibility',
                effect: 'see_invisibility',
                darkvisionRange: null,
                seeInvisibleRange: 10,
                benefit: 'You can see invisible creatures and objects within 10 feet of you that are within line of sight.',
            },
        ];

        it.each(OPTION_TABLE)('applies $option with exact buff shape and popup/log copy', async ({ option, effect, darkvisionRange, seeInvisibleRange, benefit }) => {
            setupMocks([], []);

            const action = makeAction({ automation: { type: 'third_eye', duration: 'short_or_long_rest' } });
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, option);

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'automation_info',
                name: 'The Third Eye',
                description: `The Third Eye: ${option} chosen. ${benefit} (${DURATION_TEXT})`,
                automation: action.automation,
            });
            expect(result.logEntries).toHaveLength(1);
            expectExactExceptTimestamp(result.logEntries[0], {
                characterName: 'TestWizard',
                type: 'ability_use',
                abilityName: 'The Third Eye',
                description: `TestWizard uses The Third Eye, choosing ${option}. ${benefit} (${DURATION_TEXT})`,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'activeBuffs', [
                {
                    name: 'The Third Eye',
                    effect,
                    duration: 'short_or_long_rest',
                    darkvisionRange,
                    seeInvisibleRange,
                    hasAutomation: true,
                },
            ], campaignName);
        });

        it('replaces an existing Third Eye buff and preserves unrelated buffs', async () => {
            setupMocks([], [
                { name: 'The Third Eye', effect: 'darkvision_120' },
                { name: 'Other Buff', effect: 'some_other' },
            ]);

            const action = makeAction({ automation: { type: 'third_eye', duration: 'short_or_long_rest' } });
            const playerStats = makePlayerStats();

            await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'activeBuffs', [
                { name: 'Other Buff', effect: 'some_other' },
                {
                    name: 'The Third Eye',
                    effect: 'greater_comprehension',
                    duration: 'short_or_long_rest',
                    darkvisionRange: null,
                    seeInvisibleRange: null,
                    hasAutomation: true,
                },
            ], campaignName);
        });

        it('passes through automation.duration and defaults to short_or_long_rest when omitted', async () => {
            setupMocks([], []);

            await applyThirdEye(
                { name: 'The Third Eye', automation: { type: 'third_eye', duration: '1 hour' } },
                makePlayerStats(), campaignName, 'Greater Comprehension');

            expect(setRuntimeValue).toHaveBeenLastCalledWith(
                'TestWizard',
                'activeBuffs',
                [expect.objectContaining({ duration: '1 hour' })],
                campaignName,
            );

            await applyThirdEye(
                { name: 'The Third Eye', automation: { type: 'third_eye' } },
                makePlayerStats(), campaignName, 'Greater Comprehension');

            expect(setRuntimeValue).toHaveBeenLastCalledWith(
                'TestWizard',
                'activeBuffs',
                [expect.objectContaining({ duration: 'short_or_long_rest' })],
                campaignName,
            );
        });

        it('rejects undefined automation rather than inventing a fallback', async () => {
            setupMocks([], []);

            await expect(
                applyThirdEye({ name: 'The Third Eye', automation: undefined }, makePlayerStats(), campaignName, 'Greater Comprehension')
            ).rejects.toThrow();

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it.each(['Unknown Option', '', '   '])('returns error popup and never writes for option %j', async option => {
            setupMocks([], []);

            const action = { name: 'The Third Eye', automation: { type: 'third_eye' } };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, option);

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'automation_info',
                name: 'The Third Eye',
                description: `Unknown option: ${option}`,
                automation: action.automation,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('derives runtime key and log identity from playerStats.name', async () => {
            setupMocks([], []);

            const action = makeAction({ automation: { type: 'third_eye', duration: 'short_or_long_rest' } });
            const playerStats = makePlayerStats({ name: 'OtherWizard' });

            const result = await applyThirdEye(action, playerStats, campaignName, 'Darkvision (120 feet)');

            expect(result.logEntries[0].characterName).toBe('OtherWizard');
            const [key, , buffs] = setRuntimeValue.mock.calls[0];
            expect(key).toBe('OtherWizard');
            expect(buffs[0].name).toBe('The Third Eye');
        });
    });
});
