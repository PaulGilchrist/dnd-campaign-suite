// @maintained-by-ai
//
// Unit tests for the Haste automation handler (./hasteHandler.js).
// Fully deterministic: every external dependency (runtime store, combat
// summary, log service, map-position resolver, range validation, expirations)
// is mocked, so this suite pins only the handler's own stable contract:
//   - handle()        → haste_target_selection popup payload
//   - applyHaste()   → buff write, DEX save advantage, expiration, logging
//   - isHasteActive()→ stored-buff lookup (name AND effect must match)
// If the handler's output contract changes, update this file alongside it.

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

beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so mockImplementation never leaks
    // between tests; re-stub the values the handler depends on by default.
    vi.resetAllMocks();
    addEntry.mockResolvedValue(undefined); // handler calls .catch() on this
    rangeToFeet.mockReturnValue(30);
});

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

/** Fresh target: no buffs, empty conditionEffects. */
function mockFreshTarget() {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'conditionEffects') return {};
        return null;
    });
}

function buffsWritesFor(targetName) {
    return setRuntimeValue.mock.calls.filter(
        (c) => c[0] === targetName && c[1] === 'activeBuffs',
    );
}

// ─── handle ───

describe('hasteHandler.handle', () => {
    it('returns the haste_target_selection popup payload', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }, { name: 'Wizard1' }, { name: 'Enemy1' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null, []);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'haste_target_selection',
                name: 'Haste',
                creatureTargets: ['Ally1', 'Wizard1', 'Enemy1'],
                range: '30 feet',
                rangeFt: 30,
                duration: 'Concentration, up to 1 minute',
                attackerPos: null,
            },
        });
        expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
        expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        expect(resolveMapPositions).not.toHaveBeenCalled();
    });

    it('returns an empty creature list when no creatures are available', async () => {
        getCombatSummary.mockReturnValue(null);
        let result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null, []);
        expect(result.payload.creatureTargets).toEqual([]);

        getCombatSummary.mockReturnValue({ creatures: [] });
        result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null, []);
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('resolves attacker position only when a map name is provided', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy1' }] });
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP, []);

        expect(resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN, MAP, 'Wizard1');
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });

        resolveMapPositions.mockResolvedValue({});
        const noPos = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP, []);
        expect(noPos.payload.attackerPos).toBeNull();
    });

    it('passes spell range to rangeToFeet and surfaces name/range/duration in the payload', async () => {
        getCombatSummary.mockReturnValue({ creatures: [] });
        rangeToFeet.mockReturnValue(60);

        const action = { name: 'Custom Haste', spell: { range: '60 feet', duration: '10 minutes' } };
        const result = await handle(action, makePlayerStats(), CAMPAIGN, null, []);

        expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        expect(result.payload.name).toBe('Custom Haste');
        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.rangeFt).toBe(60);
        expect(result.payload.duration).toBe('10 minutes');
    });

    it('falls back to default range and duration when spell data is absent', async () => {
        getCombatSummary.mockReturnValue({ creatures: [] });

        const noSpell = await handle({ name: 'Haste' }, makePlayerStats(), CAMPAIGN, null, []);
        expect(noSpell.payload.range).toBe('30 feet');
        expect(noSpell.payload.duration).toBe('Concentration, up to 1 minute');

        const partialSpell = await handle(
            { name: 'Haste', spell: { duration: '1 minute' } },
            makePlayerStats(), CAMPAIGN, null, [],
        );
        expect(partialSpell.payload.range).toBe('30 feet');
        expect(partialSpell.payload.duration).toBe('1 minute');
    });
});

// ─── applyHaste ───

describe('hasteHandler.applyHaste', () => {
    it('returns null without side effects for missing, empty, or non-array targetNames', async () => {
        const action = makeAction();

        expect(await applyHaste(action, makePlayerStats(), CAMPAIGN, null, null)).toBeNull();
        expect(await applyHaste(action, makePlayerStats(), CAMPAIGN, null, [])).toBeNull();
        expect(await applyHaste(action, makePlayerStats(), CAMPAIGN, null, 'Ally1')).toBeNull();

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('writes the Haste buff to activeBuffs and returns an info popup', async () => {
        mockFreshTarget();

        const result = await applyHaste(
            makeAction(), makePlayerStats({ name: 'CasterOne' }), CAMPAIGN, null, ['Ally1'],
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Haste');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Haste',
                    effect: 'haste',
                    duration: 'Concentration, up to 1 minute',
                    sourceCharacter: 'CasterOne',
                }),
            ]),
            CAMPAIGN,
        );
    });

    it('does not write activeBuffs when the target already has Haste', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [{ name: 'Haste', effect: 'haste' }];
            if (key === 'conditionEffects') return {};
            return null;
        });

        const result = await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, ['Ally1']);

        expect(result).not.toBeNull();
        expect(buffsWritesFor('Ally1')).toHaveLength(0);
    });

    it('applies the buff to every target in a multi-target cast', async () => {
        mockFreshTarget();

        const result = await applyHaste(
            makeAction(), makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2', 'Ally3'],
        );

        expect(result.payload.description).toBe('3 targets gained Haste from Haste: Ally1, Ally2, Ally3.');
        expect(buffsWritesFor('Ally1')).toHaveLength(1);
        expect(buffsWritesFor('Ally2')).toHaveLength(1);
        expect(buffsWritesFor('Ally3')).toHaveLength(1);
    });

    it('coerces missing or malformed stored activeBuffs to an empty array', async () => {
        const action = makeAction();

        for (const stored of [null, 'not-an-array']) {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return stored;
                if (key === 'conditionEffects') return {};
                return null;
            });
            const target = stored === null ? 'Ally1' : 'Ally2';
            const result = await applyHaste(action, makePlayerStats(), CAMPAIGN, null, [target]);

            expect(result).not.toBeNull();
            expect(buffsWritesFor(target)[0][2]).toContainEqual(
                expect.objectContaining({ name: 'Haste', effect: 'haste' }),
            );
        }
    });

    it('grants DEX save advantage, tolerating missing conditionEffects data', async () => {
        const variants = [null, {}, { saveAdvantageCount: 0 }];
        const targets = ['Ally1', 'Ally2', 'Ally3'];

        for (let i = 0; i < variants.length; i++) {
            const conditionEffects = variants[i];
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'conditionEffects') return conditionEffects;
                return null;
            });
            await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, [targets[i]]);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                targets[i],
                'conditionEffects',
                expect.objectContaining({
                    saveAdvantageCount: 1,
                    saveAdvantageAbilities: ['DEX'],
                }),
                CAMPAIGN,
            );
        }
    });

    it('preserves existing save advantage abilities and never duplicates DEX', async () => {
        const cases = [
            { target: 'Ally1', existing: ['DEX'], expected: ['DEX'] },
            { target: 'Ally2', existing: ['STR'], expected: ['STR', 'DEX'] },
        ];

        for (const { target, existing, expected } of cases) {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'conditionEffects') return { saveAdvantageCount: 1, saveAdvantageAbilities: existing };
                return null;
            });
            await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, [target]);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                target,
                'conditionEffects',
                expect.objectContaining({
                    saveAdvantageCount: 2,
                    saveAdvantageAbilities: expected,
                }),
                CAMPAIGN,
            );
        }
    });

    it('uses spell duration for the buff and falls back to the default', async () => {
        mockFreshTarget();

        await applyHaste(
            makeAction({ spell: { duration: '2 minutes' } }),
            makePlayerStats(), CAMPAIGN, null, ['Ally1'],
        );
        expect(buffsWritesFor('Ally1')[0][2]).toContainEqual(
            expect.objectContaining({ duration: '2 minutes' }),
        );

        await applyHaste(
            makeAction({ spell: {} }),
            makePlayerStats(), CAMPAIGN, null, ['Ally2'],
        );
        expect(buffsWritesFor('Ally2')[0][2]).toContainEqual(
            expect.objectContaining({ duration: 'Concentration, up to 1 minute' }),
        );
    });

    it('adds a remove_active_buff expiration for each target', async () => {
        mockFreshTarget();

        await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        for (const target of ['Ally1', 'Ally2']) {
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Wizard1',
                targetName: target,
                effects: [expect.objectContaining({ type: 'remove_active_buff', buffName: 'Haste' })],
                campaignName: CAMPAIGN,
            });
        }
    });

    it('logs an ability_use entry for each target (required for all automation)', async () => {
        mockFreshTarget();

        await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        for (const target of ['Ally1', 'Ally2']) {
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Wizard1',
                abilityName: 'Haste',
                description: expect.stringContaining(`Wizard1 cast Haste on ${target}`),
            }));
        }
    });

    it('names the caster and action in the single-target description', async () => {
        mockFreshTarget();

        const result = await applyHaste(
            { name: 'Enhanced Haste', spell: { range: '30 feet' } },
            makePlayerStats({ name: 'CasterOne' }), CAMPAIGN, null, ['Ally1'],
        );

        expect(result.payload.description).toBe('Ally1 gained Haste from Enhanced Haste.');
    });

    it('skips the buff write for an already-hasted target but still expires and logs it', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [{ name: 'Haste', effect: 'haste' }];
                return [];
            }
            if (key === 'conditionEffects') return {};
            return null;
        });

        const result = await applyHaste(makeAction(), makePlayerStats(), CAMPAIGN, null, ['Ally1', 'Ally2']);

        expect(result).not.toBeNull();
        const buffsWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeBuffs');
        expect(buffsWrites).toHaveLength(1);
        expect(buffsWrites[0][0]).toBe('Ally2');
        expect(addExpiration).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenCalledTimes(2);
    });
});

// ─── isHasteActive ───

describe('hasteHandler.isHasteActive', () => {
    it('returns true when a Haste buff (name and effect) is stored, even among other buffs', () => {
        getRuntimeValue.mockReturnValue([
            { name: 'Bless', effect: 'bless' },
            { name: 'Haste', effect: 'haste' },
        ]);

        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(true);
        expect(getRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', CAMPAIGN);
    });

    it('returns false when nothing usable is stored', () => {
        for (const stored of [null, undefined, [], 'not-an-array']) {
            getRuntimeValue.mockReturnValue(stored);
            expect(isHasteActive('Ally1', CAMPAIGN)).toBe(false);
        }
    });

    it('requires both name and effect to match', () => {
        getRuntimeValue.mockReturnValue([{ name: 'Haste', effect: 'slow' }]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(false);

        getRuntimeValue.mockReturnValue([{ name: 'Slow', effect: 'haste' }]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(false);

        getRuntimeValue.mockReturnValue([{ name: 'Haste', effect: 'haste' }]);
        expect(isHasteActive('Ally1', CAMPAIGN)).toBe(true);
    });
});
