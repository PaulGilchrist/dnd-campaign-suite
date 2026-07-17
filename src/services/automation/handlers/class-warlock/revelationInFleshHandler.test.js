// @improved-by-ai
import { handle, applyRevelationOptions } from './revelationInFleshHandler.js';
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

        it('should return info popup when automation has no options property', async () => {
            const action = { name: 'Revelation in Flesh', automation: {} };
            const result = await handle(action, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('has no options available');
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
                    description: 'Revelation in Flesh: No Sorcery Points available. Cost: 1 SP per selection.',
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
    });

    describe('applyRevelationOptions', () => {
        it('should return error popup for no valid options selected', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                []
            );

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'No valid options selected.',
                }),
            });
        });

        it('should return error popup for unknown options', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                ['Unknown']
            );

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'No valid options selected.',
                }),
            });
        });

        it('should return error popup when insufficient sorcery points', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(1);

            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                ['Option A', 'Option B']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
            expect(result.payload.description).toContain('Need 2, have 1');
        });

        it('should spend correct SP and add multiple buffs when options are applied', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                ['Option A', 'Option B']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Option A, Option B');
            expect(result.payload.description).toContain('2 SP spent');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'sorceryPoints',
                8,
                'campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Revelation in Flesh', effect: 'effect_a' }),
                    expect.objectContaining({ name: 'Revelation in Flesh', effect: 'effect_b' }),
                ]),
                'campaign',
            );
        });

        it('should include logEntries for each selected option', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                ['Option A', 'Option B']
            );

            expect(result.logEntries).toEqual([
                {
                    characterName: 'TestWarlock',
                    type: 'ability_use',
                    abilityName: 'Revelation in Flesh',
                    description: expect.stringContaining('Option A'),
                },
                {
                    characterName: 'TestWarlock',
                    type: 'ability_use',
                    abilityName: 'Revelation in Flesh',
                    description: expect.stringContaining('Option B'),
                },
            ]);
        });

        it('should use custom duration from automation when provided', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeActionWithOptions({ duration: '1_hour' });

            await applyRevelationOptions(action, makePlayerStats(), 'campaign', ['Option A']);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Revelation in Flesh', duration: '1_hour' }),
                ]),
                'campaign',
            );
        });

        it('should filter out invalid options and only apply valid ones', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                ['Option A', 'Invalid Option']
            );

            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0].type).toBe('ability_use');
            expect(result.logEntries[0].abilityName).toBe('Revelation in Flesh');
            expect(result.logEntries[0].description).toContain('Option A');
            expect(result.logEntries[0].description).not.toContain('Invalid');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                'sorceryPoints',
                9,
                'campaign'
            );
        });
    });
});
