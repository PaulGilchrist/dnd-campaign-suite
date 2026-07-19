vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './patientDefenseHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { toggleBuff, isBuffActive } from '../../common/buffToggle.js';

const campaignName = 'test-campaign';

function makePlayerStats(level, focusPoints, martialArtsDie = 4) {
    return {
        name: 'TestMonk',
        level,
        class: {
            class_levels: [{ level, focus_points: focusPoints, martial_arts_die: martialArtsDie }],
        },
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Patient Defense',
        description: 'Take Disengage as Bonus Action, or expend 1 Focus Point for Disengage + Dodge.',
        automation: {
            type: 'patient_defense',
            cost: { resource: 'focus_points', amount: 1 },
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('patientDefenseHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Patient Defense', () => {
        it('should return popup with enhanced action when focus points available', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 2;
                return null;
            });

            const action = makeAction();
            const playerStats = makePlayerStats(2, 2);

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Patient Defense');
            expect(result.payload.description).toContain('Disengage and Dodge');
            expect(result.payload.description).toContain('1 Focus Points remaining');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
            expect(isBuffActive).toHaveBeenCalledWith('TestMonk', 'Dodge', campaignName);
            expect(toggleBuff).toHaveBeenCalledWith('TestMonk', 'Dodge', {
                effect: 'dodge',
                duration: 'until_start_of_next_turn',
            }, campaignName, 'TestMonk');
            expect(addEntry).toHaveBeenCalled();
        });

        it('should not toggle Dodge if already active', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 2;
                return null;
            });
            isBuffActive.mockReturnValue(true);

            const action = makeAction();
            const playerStats = makePlayerStats(2, 2);

            await handle(action, playerStats, campaignName);

            expect(toggleBuff).not.toHaveBeenCalled();
        });

        it('should return popup with disengage only when no focus points available', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 0;
                return null;
            });

            const action = makeAction();
            const playerStats = makePlayerStats(2, 0);

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Patient Defense');
            expect(result.payload.description).toContain('Disengage');
            expect(result.payload.description).toContain('0/1 Focus Points');
            expect(addEntry).toHaveBeenCalled();
        });

        it('should fall back to maxFocusPoints when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction();
            const playerStats = makePlayerStats(2, 3);

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Disengage and Dodge');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 2, campaignName);
        });
    });

    describe('Heightened Patient Defense', () => {
        it('should return popup with temp HP when focus points available', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 2;
                if (key === 'tempHp') return 0;
                return null;
            });
            isBuffActive.mockReturnValue(false);

            const action = makeAction({ name: 'Heightened Patient Defense' });
            const playerStats = makePlayerStats(10, 2, 6);

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Heightened Patient Defense');
            expect(result.payload.description).toContain('Disengage and Dodge');
            expect(result.payload.description).toContain('temporary hit points');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'tempHp', expect.any(Number), campaignName);
            expect(toggleBuff).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
        });

        it('should return popup with disengage only when no focus points available', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 0;
                return null;
            });

            const action = makeAction({ name: 'Heightened Patient Defense' });
            const playerStats = makePlayerStats(10, 0);

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Heightened Patient Defense');
            expect(result.payload.description).toContain('Disengage');
            expect(result.payload.description).toContain('0/1 Focus Points');
            expect(addEntry).toHaveBeenCalled();
        });

        it('should not grant temp HP when no focus points available', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'focusPoints') return 0;
                return null;
            });

            const action = makeAction({ name: 'Heightened Patient Defense' });
            const playerStats = makePlayerStats(10, 0);

            await handle(action, playerStats, campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestMonk', 'tempHp', expect.any(Number), campaignName);
        });
    });
});
