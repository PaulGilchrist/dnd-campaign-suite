// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mistyEscapeHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { buildSaveDc } = await import('../../common/savePrompt.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'WarlockGirl',
        abilities: [{ name: 'CHA', bonus: 4 }],
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Misty Escape',
        automation: {
            type: 'misty_escape',
            saveDc: 15,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makeRecentAttack(overrides = {}) {
    return {
        attackEvent: { timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'WarlockGirl',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Fire'],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    buildSaveDc.mockReturnValue(15);
});

describe('mistyEscapeHandler', () => {
    describe('guard: no recent damage', () => {
        it('returns popup when no recent damage taken', async () => {
            const testCases = [
                { attack: { attackEvent: null, targetName: null, totalDamage: 0 } },
                { attack: { targetName: 'OtherPlayer' } },
                { attack: { totalDamage: 0, primaryDamage: 0 } },
            ];

            for (const { attack } of testCases) {
                findLastAttack.mockResolvedValue(makeRecentAttack(attack));

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No recent damage taken');
            }
        });
    });

    describe('disappearing step: invisible condition', () => {
        it('adds invisible condition to existing conditions', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            getRuntimeValue.mockReturnValue(['fatigued']);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WarlockGirl',
                'activeConditions',
                ['fatigued', 'invisible'],
                'test-campaign'
            );
        });

        it('skips setting conditions when invisible is already present', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            getRuntimeValue.mockReturnValue(['invisible']);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('registers expiration for invisible condition after 1 round', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith(
                'WarlockGirl',
                'WarlockGirl',
                [{ type: 'condition', condition: 'invisible' }],
                'test-campaign',
                undefined,
                'WarlockGirl'
            );
        });
    });

    describe('popup result payload', () => {
        function setupSuccessfulHandler() {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);
        }

        it('includes full description and save/damage info for default action', async () => {
            setupSuccessfulHandler();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Misty Escape');
            expect(result.payload.description).toContain('Misty Step');
            expect(result.payload.description).toContain('Invisible condition');
            expect(result.payload.description).toContain('Dreadful Step');
            expect(result.payload.description).toContain('2d10 Psychic damage');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageExpression).toBe('2d10');
            expect(result.payload.aoeRange).toBe('5_ft');
            expect(result.payload.triggerMistyStep).toBe(true);
        });

        it('respects custom saveType and feature name from automation config', async () => {
            setupSuccessfulHandler();
            buildSaveDc.mockReturnValue(17);

            const result = await handle(
                makeAction({ name: 'Shadow Blink', automation: { saveType: 'CHA' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Shadow Blink');
            expect(result.payload.description).toContain('Shadow Blink');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(17);
        });
    });

    describe('logging', () => {
        it('logs ability use with correct type, character, and feature name', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'WarlockGirl',
                abilityName: 'Misty Escape',
            }));
        });

        it('logs with custom feature name', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction({ name: 'My Misty Escape' }), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'My Misty Escape',
            }));
        });
    });
});
