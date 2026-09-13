// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyHaste, isHasteActive } from './hasteHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Wizard1',
        level: 5,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Haste',
        spell: { range: '30 feet', duration: 'Concentration, up to 1 minute', ...overrides.spell },
        ...overrides,
    };
}

// ─── handle ───

describe('hasteHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeToFeet.mockReturnValue(30);
    });

    it('returns target selection popup with creature list from combat summary', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Ally1' },
                { name: 'Wizard1' },
                { name: 'Enemy1' },
            ],
        });
        resolveMapPositions.mockResolvedValue(null);

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('haste_target_selection');
        expect(result.payload.name).toBe('Haste');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'Wizard1', 'Enemy1']);
        expect(result.payload.range).toBe('30 feet');
        expect(result.payload.rangeFt).toBe(30);
        expect(result.payload.duration).toBe('Concentration, up to 1 minute');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('returns empty creature list when no combat summary', async () => {
        getCombatSummary.mockReturnValue(null);

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('haste_target_selection');
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns empty creature list when combat summary has no creatures', async () => {
        getCombatSummary.mockReturnValue({ creatures: [] });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('resolves map positions when mapName is provided', async () => {
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP, []);

        expect(resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN, MAP, 'Wizard1');
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });
    });

    it('uses spell range and duration from action when present', async () => {
        resolveMapPositions.mockResolvedValue(null);
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const action = makeAction({ spell: { range: '60 feet', duration: '10 minutes' } });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('10 minutes');
    });

    it('uses defaults when action has no spell property', async () => {
        resolveMapPositions.mockResolvedValue(null);
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const action = { name: 'Haste' };
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.payload.range).toBe('30 feet');
        expect(result.payload.duration).toBe('Concentration, up to 1 minute');
    });

    it('uses action name in popup payload when provided', async () => {
        resolveMapPositions.mockResolvedValue(null);
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }],
        });

        const action = { name: 'Custom Haste', spell: { range: '30 feet' } };
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.payload.name).toBe('Custom Haste');
    });

    it('defaults range to 30 feet when spell.range is missing', async () => {
        resolveMapPositions.mockResolvedValue(null);
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }],
        });

        const action = makeAction({ spell: { duration: '1 minute' } });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(result.payload.range).toBe('30 feet');
    });
});

// ─── applyHaste ───

describe('hasteHandler.applyHaste', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when targetNames is null', async () => {
        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, null);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is an empty array', async () => {
        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, []);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, 'Ally1');
        expect(result).toBeNull();
    });

    it('applies haste buff to a single target and returns info popup', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Ally1 gained Haste');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Haste',
                    effect: 'haste',
                    duration: 'Concentration, up to 1 minute',
                    sourceCharacter: 'Wizard1',
                }),
            ]),
            CAMPAIGN,
        );
    });

    it('returns info popup with description when target already has Haste', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [{ name: 'Haste', effect: 'haste' }];
            return {};
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Ally1 gained Haste');

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls).toHaveLength(0);
    });

    it('applies buff to multiple targets', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2', 'Ally3']);

        expect(result.payload.description).toContain('3 targets gained Haste');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.any(Array), CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.any(Array), CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally3', 'activeBuffs', expect.any(Array), CAMPAIGN);
    });

    it('skips targets that already have Haste in multi-target call', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [{ name: 'Haste', effect: 'haste' }];
                return [];
            }
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[1] === 'activeBuffs',
        );
        expect(buffsCalls).toHaveLength(1);
        expect(buffsCalls[0][0]).toBe('Ally2');
    });

    it('handles activeBuffs not set (null stored value)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return null;
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result).not.toBeNull();
        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls).toHaveLength(1);
        expect(buffsCalls[0][2]).toContainEqual(
            expect.objectContaining({ name: 'Haste', effect: 'haste' }),
        );
    });

    it('handles activeBuffs set to non-array value (coerces to empty array)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return 'not-an-array';
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result).not.toBeNull();
        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls).toHaveLength(1);
    });

    it('adds DEX save advantage to conditionEffects for each target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'conditionEffects',
            expect.objectContaining({
                saveAdvantageCount: 1,
                saveAdvantageAbilities: expect.arrayContaining(['DEX']),
            }),
            CAMPAIGN,
        );
    });

    it('does not duplicate DEX in saveAdvantageAbilities if already present', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {
                saveAdvantageCount: 1,
                saveAdvantageAbilities: ['DEX'],
            };
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'conditionEffects',
            expect.objectContaining({
                saveAdvantageCount: 2,
                saveAdvantageAbilities: ['DEX'],
            }),
            CAMPAIGN,
        );
    });

    it('adds new ability to saveAdvantageAbilities if not already present', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {
                saveAdvantageCount: 1,
                saveAdvantageAbilities: ['STR'],
            };
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'conditionEffects',
            expect.objectContaining({
                saveAdvantageCount: 2,
                saveAdvantageAbilities: ['STR', 'DEX'],
            }),
            CAMPAIGN,
        );
    });

    it('handles missing conditionEffects (null stored value)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return null;
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'conditionEffects',
            expect.objectContaining({
                saveAdvantageCount: 1,
                saveAdvantageAbilities: expect.arrayContaining(['DEX']),
            }),
            CAMPAIGN,
        );
    });

    it('handles missing conditionEffects.saveAdvantageAbilities (undefined)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return { saveAdvantageCount: 0 };
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'conditionEffects',
            expect.objectContaining({
                saveAdvantageAbilities: ['DEX'],
            }),
            CAMPAIGN,
        );
    });

    it('adds expiration for each target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Ally1', effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Haste',
                }),
            ]), campaignName: CAMPAIGN });
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Ally2', effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Haste',
                }),
            ]), campaignName: CAMPAIGN });
    });

    it('posts a log entry for each target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: 'Wizard1',
            abilityName: 'Haste',
            description: expect.stringContaining('Wizard1 cast Haste on Ally1'),
        }));
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: 'Wizard1',
            abilityName: 'Haste',
            description: expect.stringContaining('Wizard1 cast Haste on Ally2'),
        }));
    });

    it('uses custom duration from spell when provided', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction({ spell: { duration: '2 minutes' } });
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls[0][2]).toContainEqual(
            expect.objectContaining({ duration: '2 minutes' }),
        );
    });

    it('uses default duration when action.spell is missing duration', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction({ spell: {} });
        await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls[0][2]).toContainEqual(
            expect.objectContaining({ duration: 'Concentration, up to 1 minute' }),
        );
    });

    it('reports single target in description correctly', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result.payload.description).toBe('Ally1 gained Haste from Haste.');
    });

    it('reports multiple targets in description correctly', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        expect(result.payload.description).toBe('2 targets gained Haste from Haste: Ally1, Ally2.');
    });

    it('uses action name in description when different from default', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = { name: 'Enhanced Haste', spell: { range: '30 feet' } };
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result.payload.description).toBe('Ally1 gained Haste from Enhanced Haste.');
    });

    it('skips adding buff but still adds expiration and log for already-hasted target in multi-target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [{ name: 'Haste', effect: 'haste' }];
                return [];
            }
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        expect(result).not.toBeNull();

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[1] === 'activeBuffs',
        );
        expect(buffsCalls).toHaveLength(1);
        expect(buffsCalls[0][0]).toBe('Ally2');

        expect(addExpiration).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenCalledTimes(2);
    });

    it('uses playerStats.name as sourceCharacter in buff', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const action = makeAction();
        await applyHaste(action, makePlayerStats({ name: 'ClericOfLathander' }), CAMPAIGN, null, ['Ally1']);

        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCalls[0][2]).toContainEqual(
            expect.objectContaining({ sourceCharacter: 'ClericOfLathander' }),
        );
    });
});

// ─── isHasteActive ───

describe('hasteHandler.isHasteActive', () => {
    it('returns true when haste buff is active', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Haste', effect: 'haste', duration: 'Concentration, up to 1 minute' },
        ]);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(true);
    });

    it('returns false when no buffs stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(false);
    });

    it('returns false when activeBuffs is an empty array', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(false);
    });

    it('returns false when haste has wrong effect value', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Haste', effect: 'slow' },
        ]);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(false);
    });

    it('returns false when haste has wrong name', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Slow', effect: 'haste' },
        ]);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(false);
    });

    it('returns true when haste is among multiple buffs', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Bless', effect: 'bless' },
            { name: 'Haste', effect: 'haste' },
            { name: 'Shield of Faith', effect: 'shield_of_faith' },
        ]);

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(true);
    });

    it('returns false when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');

        const result = isHasteActive('Ally1', CAMPAIGN);
        expect(result).toBe(false);
    });

    it('requires both name and effect to match', () => {
        // name matches but effect doesn't
        getRuntimeValue.mockReturnValue([
            { name: 'Haste', effect: 'something_else' },
        ]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(false);

        // effect matches but name doesn't
        getRuntimeValue.mockReturnValue([
            { name: 'Something', effect: 'haste' },
        ]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(false);

        // both match
        getRuntimeValue.mockReturnValue([
            { name: 'Haste', effect: 'haste' },
        ]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(true);
    });
});
