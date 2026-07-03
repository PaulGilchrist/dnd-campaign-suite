// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyThirdEye } from './thirdEyeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../../../services/automation/common/buffToggle.js';

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

describe('thirdEyeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup with effect name when Third Eye is already active', async () => {
            buffToggle.getActiveBuffs.mockReturnValue([
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

        it('returns popup with unknown effect key when buff has unrecognized effect', async () => {
            buffToggle.getActiveBuffs.mockReturnValue([
                { name: 'The Third Eye', effect: 'some_unknown_effect' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('some_unknown_effect');
        });

        it('returns popup with Unknown fallback when buff has no effect property', async () => {
            buffToggle.getActiveBuffs.mockReturnValue([
                { name: 'The Third Eye' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown');
        });

        it('returns modal when Third Eye is not active', async () => {
            buffToggle.getActiveBuffs.mockReturnValue([]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('thirdEye');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
        });
    });

    describe('applyThirdEye', () => {
        it('applies Darkvision option and stores buff with correct properties', async () => {
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue([]);

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
            expect(result.logEntries).toEqual([{
                characterName: 'TestWizard',
                type: 'action',
                text: 'The Third Eye: Darkvision (120 feet)',
            }]);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
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
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            const result = await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('read any language');
            expect(result.payload.description).toContain('Greater Comprehension');
            expect(result.logEntries[0].text).toBe('The Third Eye: Greater Comprehension');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
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
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue([]);

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
            expect(result.logEntries[0].text).toBe('The Third Eye: See Invisibility');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
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
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue([
                { name: 'The Third Eye', effect: 'darkvision_120' },
                { name: 'Other Buff', effect: 'some_other' },
            ]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' },
            };
            const playerStats = makePlayerStats();

            await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            const callArgs = runtimeState.setRuntimeValue.mock.calls[0];
            const newBuffs = callArgs[2];
            expect(newBuffs).toHaveLength(2);
            expect(newBuffs.find(b => b.effect === 'darkvision_120')).toBeUndefined();
            expect(newBuffs.find(b => b.effect === 'greater_comprehension')).toBeDefined();
            expect(newBuffs.find(b => b.effect === 'some_other')).toBeDefined();
        });

        it('uses automation duration when provided, defaults to short_or_long_rest', async () => {
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: '1 hour' },
            };
            const playerStats = makePlayerStats();

            await applyThirdEye(action, playerStats, campaignName, 'Greater Comprehension');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
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

        it('returns error for unknown option without calling setRuntimeValue', async () => {
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

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
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
