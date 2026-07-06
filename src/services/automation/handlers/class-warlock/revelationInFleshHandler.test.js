// @improved-by-ai
import { handle, applyRevelationOption } from './revelationInFleshHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../../services/character/classFeatures.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    getCurrentSorceryPoints: vi.fn(),
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Revelation in Flesh',
    automation: { type: 'revelation_in_flesh', options: [], ...auto },
});

const makeActionWithOptions = (auto = {}) => ({
    name: 'Revelation in Flesh',
    automation: {
        type: 'revelation_in_flesh',
        options: [
            { name: 'Option A', effect: 'effect_a', description: 'Description A' },
            { name: 'Option B', effect: 'effect_b' },
        ],
        ...auto,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    ...overrides,
});

describe('revelationInFleshHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        metamagic.getCurrentSorceryPoints.mockReturnValue(5);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        it('should return info popup when no options available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'Revelation in Flesh has no options available.',
                    automation: expect.objectContaining({ type: 'revelation_in_flesh', options: [] }),
                }),
            });
        });

        it('should return info popup when no sorcery points available', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);

            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign');

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    automationType: 'revelation_in_flesh',
                    description: 'Revelation in Flesh: No Sorcery Points available. Cost: 1 SP.',
                }),
            });
        });

        it('should return modal when options and sorcery points available', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'revelationInFlesh',
                payload: expect.objectContaining({
                    action: expect.objectContaining({ name: 'Revelation in Flesh' }),
                    playerStats: expect.objectContaining({ name: 'TestWarlock' }),
                    campaignName: 'campaign',
                }),
            });
        });

        it('should handle automation with no options property', async () => {
            const action = { name: 'Revelation in Flesh', automation: {} };
            const result = await handle(action, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('has no options available');
        });
    });

    describe('applyRevelationOption', () => {
        it('should return error popup for unknown option', async () => {
            const result = await applyRevelationOption(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Unknown',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'Unknown option: Unknown',
                }),
            });
        });

        it('should return error popup when insufficient sorcery points', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);

            const result = await applyRevelationOption(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Option A',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Sorcery Points available');
            expect(result.payload.description).toContain('1 SP');
        });

        it('should spend 1 SP when option is applied', async () => {
            await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith('TestWarlock', 1, 'campaign');
        });

        it('should add new buff when none exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Revelation in Flesh',
                        effect: 'effect_a',
                        hasAutomation: true,
                        duration: '10_minutes',
                    }),
                ]),
                'campaign',
            );
        });

        it('should update existing buff with matching name', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([
                { name: 'Revelation in Flesh', effect: 'old_effect', duration: '1_hour' },
                { name: 'Other Buff', effect: 'other' },
            ]);

            await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Revelation in Flesh', effect: 'effect_a', hasAutomation: true, duration: '10_minutes' }),
                    expect.objectContaining({ name: 'Other Buff' }),
                ]),
                'campaign',
            );
        });

        it('should use custom duration from automation when provided', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeActionWithOptions({ duration: '1_hour' });

            await applyRevelationOption(action, makePlayerStats(), 'campaign', 'Option A');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_hour' }),
                ]),
                'campaign',
            );
        });

        it('should include option description in result when available', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.payload.description).toContain('Description A');
        });

        it('should include logEntries in result', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.logEntries).toEqual([
                {
                    characterName: 'TestWarlock',
                    type: 'action',
                    text: 'Revelation in Flesh: Option A (1 SP)',
                },
            ]);
        });

        it('should handle non-array stored activeBuffs as empty', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Revelation in Flesh' }),
                ]),
                'campaign',
            );
        });
    });
});
