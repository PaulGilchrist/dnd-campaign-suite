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
    });

    describe('handle', () => {
        it('should return info popup when no options available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no options available');
        });

        it('should return info popup when no sorcery points available', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);

            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Sorcery Points available');
        });

        it('should return modal when options and SP available', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('revelationInFlesh');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('campaign');
        });

        it('should not spend SP in handle', async () => {
            await handle(makeActionWithOptions(), makePlayerStats(), 'campaign');

            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });
    });

    describe('applyRevelationOption', () => {
        it('should return error popup for unknown option', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Unknown');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown option');
        });

        it('should return error popup when insufficient SP', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);

            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Sorcery Points available');
        });

        it('should spend 1 SP when option applied', async () => {
            await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith('TestWarlock', 1, 'campaign');
        });

        it('should add buff to activeBuffs when none exists', async () => {
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
                'campaign'
            );
        });

        it('should update existing buff when already present', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([
                { name: 'Revelation in Flesh', effect: 'old_effect' },
            ]);

            await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Revelation in Flesh',
                        effect: 'effect_a',
                        hasAutomation: true,
                    }),
                ]),
                'campaign'
            );
        });

        it('should use custom duration from automation', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeActionWithOptions({ duration: '1_hour' });

            await applyRevelationOption(action, makePlayerStats(), 'campaign', 'Option A');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_hour' }),
                ]),
                'campaign'
            );
        });

        it('should default duration to 10_minutes', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '10_minutes' }),
                ]),
                'campaign'
            );
        });

        it('should include option description in result', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.payload.description).toContain('Description A');
        });

        it('should include SP cost in result', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.payload.description).toContain('1 SP spent');
        });

        it('should include duration in result', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.payload.description).toContain('duration');
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

        it('should omit description from result when option has none', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option B');

            expect(result.payload.description).toContain('Option B chosen');
        });

        it('should include automationType in result', async () => {
            const result = await applyRevelationOption(makeActionWithOptions(), makePlayerStats(), 'campaign', 'Option A');

            expect(result.payload.automationType).toBe('revelation_in_flesh');
        });
    });
});
