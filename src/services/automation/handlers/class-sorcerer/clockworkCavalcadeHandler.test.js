// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './clockworkCavalcadeHandler.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';


vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ maxSorceryPoints: 8 })),
}));

const { spendSorceryPoints } = await import('../../../../hooks/combat/useMetamagic.js');
const { getClassFeatures } = await import('../../../character/classFeatures.js');

const DEFAULT_SP = 7;

function makeAction(overrides = {}) {
    return {
        name: 'Clockwork Cavalcade',
        automation: {
            type: 'clockwork_cavalcade',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        resources: { sorcery_points: { current: DEFAULT_SP } },
        ...overrides,
    };
}

function getSetRuntimeValueCallsForUses() {
    return useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] && typeof c[1] === 'string' && c[1].includes('clockworkCavalcadeUses')
    );
}

describe('clockworkCavalcadeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when feature has uses remaining', () => {
        it('should return a popup with automation_info payload containing the feature name', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Clockwork Cavalcade');
            expect(result.payload.automation).toEqual({ type: 'clockwork_cavalcade' });
        });

        it('should use the action name as the feature name when provided', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction({ name: 'Custom Name' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Custom Name');
        });

        it('should use a default feature name when action has no name', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                { automation: { type: 'clockwork_cavalcade' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Clockwork Cavalcade');
        });

        it('should decrement uses from the stored value', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('2');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const calls = getSetRuntimeValueCallsForUses();
            expect(calls.length).toBe(1);
            expect(calls[0][2]).toBe(1);
        });

        it('should decrement uses when no stored value (default 1 -> 0)', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const calls = getSetRuntimeValueCallsForUses();
            expect(calls.length).toBe(1);
            expect(calls[0][2]).toBe(0);
        });

        it('should log the ability use', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
            }));
        });

        it('should show the correct uses remaining in the description', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('3');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('should show singular "use remaining" when 1 use left after activation', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('2');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('1 use remaining');
        });

        it('should show "No uses remaining" when last use is consumed', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('No uses remaining');
        });
    });

    describe('when feature has no uses remaining', () => {
        it('should return a popup with "no uses remaining" when SP are insufficient', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 5 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.payload.description).toContain('no uses remaining');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should not restore when SP are zero', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 0 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.payload.description).toContain('no uses remaining');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should spend 7 SP and set uses to 0 when enough SP are available', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');

            const calls = getSetRuntimeValueCallsForUses();
            expect(calls.length).toBe(2);
            expect(calls[0][2]).toBe(1);
            expect(calls[1][2]).toBe(0);
        });

        it('should log the ability use when restoring via SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
            }));
        });
    });

    describe('sorcery point resolution', () => {
        it('should read SP from resources.sorcery_points.current when available', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 10 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });

        it('should fall back to maxSorceryPoints when sorcery_points resource is missing', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: {} });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });

        it('should fall back to maxSorceryPoints when resources object is null', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: null });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });

        it('should fall back to maxSorceryPoints when getClassFeatures returns null', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getClassFeatures.mockReturnValue(null);

            const stats = makePlayerStats({ resources: {} });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.payload.description).toContain('no uses remaining');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });
    });

    describe('description content', () => {
        it('should describe all capabilities and area of effect', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Heal');
            expect(result.payload.description).toContain('100 HP');
            expect(result.payload.description).toContain('Repair');
            expect(result.payload.description).toContain('Dispel');
            expect(result.payload.description).toContain('level 6 and lower');
            expect(result.payload.description).toContain('30-foot Cube');
        });
    });

});
// @cleaned-by-ai
