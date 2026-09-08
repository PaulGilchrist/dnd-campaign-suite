// @improved-by-ai
// @cleaned-by-ai
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

describe('thirdEyeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup with effect name when Third Eye is already active', async () => {
            setupMocks([
                { name: 'The Third Eye', effect: 'darkvision_120' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('The Third Eye');
            expect(result.payload.description).toContain('Darkvision (120 feet)');
            expect(result.payload.description).toContain('currently active');
            expect(result.payload.description).toContain('Duration: until start of Short or Long Rest');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('logs a refusal entry when Third Eye is already active', async () => {
            setupMocks([
                { name: 'The Third Eye', effect: 'see_invisibility' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0].type).toBe('automation');
            expect(result.logEntries[0].creatureName).toBe('TestWizard');
            expect(result.logEntries[0].name).toBe('The Third Eye');
            expect(result.logEntries[0].description).toContain('already active');
            expect(result.logEntries[0].description).toContain('See Invisibility');
            expect(result.logEntries[0].description).toContain('no new benefit gained');
        });

        it('returns popup with unknown effect key when buff has unrecognized effect', async () => {
            setupMocks([
                { name: 'The Third Eye', effect: 'some_unknown_effect' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('some_unknown_effect');
        });

        it('returns popup with Unknown fallback when buff has no effect property', async () => {
            setupMocks([
                { name: 'The Third Eye' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Unknown');
        });

        it('returns popup with Unknown fallback when buff effect is null', async () => {
            setupMocks([
                { name: 'The Third Eye', effect: null },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown');
        });

        it('returns modal when Third Eye is not active', async () => {
            setupMocks([]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('thirdEye');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('uses action.name in popup description when feature is active', async () => {
            setupMocks([
                { name: 'Custom Third Eye', effect: 'darkvision_120' },
            ]);

            const action = makeAction({ name: 'Custom Third Eye' });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.name).toBe('Custom Third Eye');
            expect(result.payload.description).toContain('Custom Third Eye');
        });

        it('passes action.automation even when automation is undefined', async () => {
            setupMocks([]);

            const action = makeAction({ automation: undefined });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.payload.action.automation).toBeUndefined();
        });
    });

    describe('applyThirdEye', () => {
        it('applies Darkvision option and stores buff with correct properties', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Darkvision (120 feet)');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('The Third Eye');
            expect(result.payload.description).toContain('Darkvision');
            expect(result.payload.description).toContain('120 feet');
            expect(result.payload.description).toContain('Duration: until start of Short or Long Rest');
            expect(result.payload.automation).toBe(action.automation);
            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0].characterName).toBe('TestWizard');
            expect(result.logEntries[0].type).toBe('ability_use');
            expect(result.logEntries[0].abilityName).toBe('The Third Eye');
            expect(result.logEntries[0].description).toContain('Darkvision (120 feet)');
            expect(result.logEntries[0].description).toContain('Darkvision out to a range of 120 feet');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'The Third Eye',
                        effect: 'darkvision_120',
                        darkvisionRange: '120 ft.',
                        duration: 'short_or_long_rest',
                        seeInvisibleRange: null,
                        hasAutomation: true,
                    }),
                ]),
                campaignName,
            );
        });

        it('applies Greater Comprehension option', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('read any language');
            expect(result.payload.description).toContain('Greater Comprehension');
            expect(result.logEntries[0].abilityName).toBe('The Third Eye');
            expect(result.logEntries[0].description).toContain('Greater Comprehension');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'The Third Eye',
                        effect: 'greater_comprehension',
                    }),
                ]),
                campaignName,
            );
        });

        it('applies See Invisibility option', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'See Invisibility');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('invisible');
            expect(result.payload.description).toContain('10 feet');
            expect(result.payload.description).toContain('See Invisibility');
            expect(result.logEntries[0].abilityName).toBe('The Third Eye');
            expect(result.logEntries[0].description).toContain('See Invisibility');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'The Third Eye',
                        effect: 'see_invisibility',
                        seeInvisibleRange: 10,
                        darkvisionRange: null,
                    }),
                ]),
                campaignName,
            );
        });

        it('removes existing Third Eye buff before adding the new one', async () => {
            setupMocks([], [
                { name: 'The Third Eye', effect: 'darkvision_120' },
                { name: 'Other Buff', effect: 'some_other' },
            ]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            const callArgs = setRuntimeValue.mock.calls[0];
            const newBuffs = callArgs[2];
            expect(newBuffs).toHaveLength(2);
            expect(newBuffs.find(b => b.effect === 'darkvision_120')).toBeUndefined();
            expect(newBuffs.find(b => b.effect === 'greater_comprehension')).toBeDefined();
            expect(newBuffs.find(b => b.effect === 'some_other')).toBeDefined();
        });

        it('uses automation duration when provided, defaults to short_or_long_rest', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: '1 hour' },
            };
            const playerStats = makePlayerStats();

            await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: '1 hour',
                    }),
                ]),
                campaignName,
            );
        });

        it('crashes when automation is undefined (no duration fallback)', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: undefined,
            };
            const playerStats = makePlayerStats();

            await expect(
                applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension')
            ).rejects.toThrow();
        });

        it('returns error for unknown option without calling setRuntimeValue', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Unknown Option');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Unknown option: Unknown Option');
            expect(result.payload.automation).toBe(action.automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns error for empty string option', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, '');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown option: ');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns error for whitespace-only option', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, '   ');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown option:    ');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses playerStats.name in log entry and buff storage', async () => {
            setupMocks([], []);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats({ name: 'OtherWizard' });

            const result = await applyThirdEye(action, playerStats, campaignName, 'Darkvision (120 feet)');

            expect(result.logEntries[0].characterName).toBe('OtherWizard');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'OtherWizard',
                'activeBuffs',
                expect.any(Array),
                campaignName,
            );
        });

        it('stores buff with hasAutomation: true for all effect types', async () => {
            const effectTypes = [
                'Darkvision (120 feet)',
                'Greater Comprehension',
                'See Invisibility',
            ];

            for (const option of effectTypes) {
                setupMocks([], []);

                const action = {
                    name: 'The Third Eye',
                    automation: { type: 'third_eye', duration: 'short_or_long_rest' },
                };
                const playerStats = makePlayerStats();

                await applyThirdEye(action, playerStats, campaignName, option);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestWizard',
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({
                            hasAutomation: true,
                        }),
                    ]),
                    campaignName,
                );
            }
        });

        it('handles null existing activeBuffs', async () => {
            setupMocks([], null);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        effect: 'greater_comprehension',
                    }),
                ]),
                campaignName,
            );
        });

        it('uses action.name in popup when action.name is undefined', async () => {
            setupMocks([], []);

            const action = {
                name: undefined,
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(result.payload.name).toBeUndefined();
            expect(result.logEntries[0].characterName).toBe('TestWizard');
        });
    });
});
