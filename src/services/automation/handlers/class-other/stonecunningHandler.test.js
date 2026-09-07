// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, restoreUses } from './stonecunningHandler.js';
import { isBuffActive } from '../../common/buffToggle.js';
import { KEY as PENDING_EXPIRATIONS_KEY } from '../../../rules/effects/expirations.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue, setRuntimeObject } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
    isBuffActive.mockReturnValue(false);
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'DwarfBoy',
        proficiency: 2,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    const auto = {
        type: 'stonecunning',
        effect: 'tremorsense_60ft',
        duration: '10_minutes',
        ...(overrides.automation || {}),
    };
    const rest = {};
    for (const [key, value] of Object.entries(overrides)) {
        if (key !== 'automation') rest[key] = value;
    }
    return {
        name: 'Stonecunning',
        automation: auto,
        ...rest,
    };
}

function usesImpl(uses) {
    return (_name, key) => {
        if (key === 'stonecunningUses') return uses;
        return null;
    };
}

function expectSuccessfulActivation(result, customName) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(customName || 'Stonecunning');
    expect(result.payload.automationType).toBe('stonecunning');
}

function expectNoUsesRemaining(result) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Stonecunning');
    expect(result.payload.automationType).toBe('stonecunning');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
}

describe('stonecunningHandler', () => {
    describe('uses calculation', () => {
        it('calculates usesMax from proficiency_bonus', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { uses: 'proficiency_bonus' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('1 use remaining');
        });

        it('uses usesMax when provided and uses is not a special value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { usesMax: 5 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('prefers uses over usesMax when both are numbers', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { uses: 2, usesMax: 10 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('1 use remaining');
        });
    });

    describe('long rest tracking', () => {
        it('starts fresh with usesMax when no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('uses stored uses when available and blocks when zero', async () => {
            getRuntimeValue.mockImplementation(usesImpl(2));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('1 use remaining');

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation(usesImpl(0));

            const blocked = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectNoUsesRemaining(blocked);
            expect(setRuntimeObject).not.toHaveBeenCalled();
        });

        it('treats stored non-numeric value as no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'stonecunningUses') return 'abc';
                return null;
            });

            const result = await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), 'test-campaign', null);

            expectNoUsesRemaining(result);
        });
    });

    describe('BUG-1: first activation decrements uses exactly once', () => {
        it('writes buff and decremented uses in a single merged store write', async () => {
            getRuntimeValue.mockImplementation(usesImpl(6));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('5 uses remaining');

            expect(setRuntimeObject).toHaveBeenCalledTimes(1);
            const [key, merged, campaign] = setRuntimeObject.mock.calls[0];
            expect(key).toBe('DwarfBoy');
            expect(campaign).toBe('test-campaign');
            expect(merged.stonecunningUses).toBe(5);
            expect(merged.activeBuffs).toHaveLength(1);
            expect(merged.activeBuffs[0]).toMatchObject({
                name: 'Stonecunning',
                effect: 'tremorsense_60ft',
                duration: '10_minutes',
                sourceCharacter: 'DwarfBoy',
            });
        });

        it('never issues a separate un-awaited buff write that could race the uses decrement', async () => {
            getRuntimeValue.mockImplementation(usesImpl(6));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const buffWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffWrites).toHaveLength(0);
        });

        it('appends to existing activeBuffs without dropping them', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'stonecunningUses') return 3;
                if (key === 'activeBuffs') return [{ name: 'Bless', effect: 'bless' }];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const [, merged] = setRuntimeObject.mock.calls[0];
            expect(merged.activeBuffs.map(b => b.name)).toEqual(['Bless', 'Stonecunning']);
            expect(merged.stonecunningUses).toBe(2);
        });
    });

    describe('BUG-2: re-click while active refuses without stripping the buff', () => {
        it('returns already active popup and performs zero state writes', async () => {
            getRuntimeValue.mockImplementation(usesImpl(5));
            isBuffActive.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already active');
            expect(result.payload.description).toContain('lasts');

            expect(setRuntimeObject).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(getCurrentCombatRound).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('BUG-3: activation registers a duration expiration', () => {
        it('registers remove_active_buff expiration with 100 rounds for 10_minutes in the merged write', async () => {
            getRuntimeValue.mockImplementation(usesImpl(6));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeObject).toHaveBeenCalledTimes(1);
            const [, merged] = setRuntimeObject.mock.calls[0];
            expect(merged[PENDING_EXPIRATIONS_KEY]).toHaveLength(1);
            expect(merged[PENDING_EXPIRATIONS_KEY][0]).toEqual({
                target: 'DwarfBoy',
                effects: [{ type: 'remove_active_buff', buffName: 'Stonecunning' }],
                appliedRound: 1,
                expiryRounds: 100,
                expireOnCreatureName: null,
            });
        });

        it('falls back to 100 rounds when automation carries no duration', async () => {
            getRuntimeValue.mockImplementation(usesImpl(6));

            await handle(
                { name: 'Stonecunning', automation: { type: 'stonecunning', effect: 'tremorsense_60ft' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            const [, merged] = setRuntimeObject.mock.calls[0];
            expect(merged[PENDING_EXPIRATIONS_KEY][0].expiryRounds).toBe(100);
        });

        it('appends to existing expirations without dropping them', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'stonecunningUses') return 6;
                if (key === PENDING_EXPIRATIONS_KEY) return [{ target: 'X', effects: [], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null }];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const [, merged] = setRuntimeObject.mock.calls[0];
            expect(merged[PENDING_EXPIRATIONS_KEY]).toHaveLength(2);
            expect(merged[PENDING_EXPIRATIONS_KEY][1].effects).toEqual([{ type: 'remove_active_buff', buffName: 'Stonecunning' }]);
        });

        it('does not register an expiration when the use is refused', async () => {
            getRuntimeValue.mockImplementation(usesImpl(0));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeObject).not.toHaveBeenCalled();
        });
    });

    describe('logging', () => {
        it('logs ability use on activation but not when refused', async () => {
            getRuntimeValue.mockImplementation(usesImpl(1));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'DwarfBoy',
                abilityName: 'Stonecunning',
            }));

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation(usesImpl(1));
            isBuffActive.mockReturnValue(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('popup description', () => {
        it('uses correct singular/plural "use" based on remaining count', async () => {
            getRuntimeValue.mockImplementation(usesImpl(2));
            let result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('1 use remaining');

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation(usesImpl(5));
            result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('includes custom duration when provided, default otherwise', async () => {
            getRuntimeValue.mockImplementation(usesImpl(1));

            let result = await handle(
                makeAction({ automation: { duration: '1_hour' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );
            expect(result.payload.description).toContain('1_hour');

            vi.clearAllMocks();

            result = await handle(
                { name: 'Stonecunning', automation: { type: 'stonecunning' } },
                makePlayerStats(),
                'test-campaign',
                null
            );
            expect(result.payload.description).toContain('10 min');
        });
    });

    describe('player name handling', () => {
        it('uses simple key regardless of player name spaces', async () => {
            const stats = makePlayerStats({ name: 'Dwarf Boy' });
            getRuntimeValue.mockImplementation(usesImpl(1));

            await handle(makeAction(), stats, 'test-campaign', null);

            expect(setRuntimeObject).toHaveBeenCalledTimes(1);
            expect(setRuntimeObject.mock.calls[0][0]).toBe('Dwarf Boy');
            expect(setRuntimeObject.mock.calls[0][1].stonecunningUses).toBe(0);
        });

        it('uses action.name for featureName when provided', async () => {
            getRuntimeValue.mockImplementation(usesImpl(1));

            const action = makeAction({ name: 'Custom Stonecunning' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Stonecunning');
            expect(result.payload.description).toContain('Custom Stonecunning');
        });
    });

    describe('restoreUses', () => {
        it('clears uses key by setting to null for names with and without spaces', () => {
            restoreUses('DwarfBoy', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DwarfBoy', 'stonecunningUses', null, 'test-campaign'
            );

            vi.clearAllMocks();
            restoreUses('Dwarf Boy', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Dwarf Boy', 'stonecunningUses', null, 'test-campaign'
            );
        });
    });
});
