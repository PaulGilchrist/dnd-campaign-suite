// @maintained-by-ai
// Shield of Faith handler contract: target-selection popup shape, +2 AC buff
// registration into activeBuffs, per-target expiration + log, and the pure
// activeBuffs predicates (isShieldOfFaithActive / getShieldOfFaithBonus,
// including the acBonus||2 falsy fallback). Fully mocked and deterministic.
// AC application on the attack lane lives in loggedDiceRollUtils
// (getShieldOfFaithAcBonus); the selection popup is consumed by the spell
// overlay / CharSheet, which mock this module rather than re-testing it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyShieldOfFaith, isShieldOfFaithActive, getShieldOfFaithBonus } from '../shieldOfFaithHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

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

const CAMPAIGN_NAME = 'test-campaign';
const PLAYER_NAME = 'Cleric1';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, level: 5, ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Shield of Faith',
        spell: { range: '60 feet', duration: 'Concentration, up to 10 minutes', ...overrides.spell },
        ...overrides,
    };
}

// ─── handle ───

describe('shieldOfFaithHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeValidation.rangeToFeet.mockReturnValue(60);
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy1' }] });
        targetResolver.resolveMapPositions.mockResolvedValue(null);
    });

    it('returns the full shield_of_faith_target_selection popup', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }, { name: PLAYER_NAME }, { name: 'Enemy1' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'shield_of_faith_target_selection',
                name: 'Shield of Faith',
                creatureTargets: ['Ally1', PLAYER_NAME, 'Enemy1'],
                range: '60 feet',
                rangeFt: 60,
                duration: 'Concentration, up to 10 minutes',
                attackerPos: null,
            },
        });
    });

    it('passes spell.range to rangeToFeet and surfaces whatever rangeToFeet produces', async () => {
        rangeValidation.rangeToFeet.mockReturnValue(45);

        const result = await handle(makeAction({ spell: { range: 'Touched-by-a-glove', duration: '1 minute' } }), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('Touched-by-a-glove');
        expect(result.payload.range).toBe('Touched-by-a-glove');
        expect(result.payload.duration).toBe('1 minute');
        expect(result.payload.rangeFt).toBe(45);
    });

    it('defaults range to 60 feet and duration to Concentration when spell is missing or null', async () => {
        for (const action of [{ name: 'Shield of Faith' }, { name: 'Shield of Faith', spell: null }]) {
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null, []);
            expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60 feet');
            expect(result.payload.range).toBe('60 feet');
            expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
        }
    });

    it('resolves attackerPos when mapName is provided, null when unresolved', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });
        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN_NAME, 'test-map', PLAYER_NAME);
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });

        targetResolver.resolveMapPositions.mockResolvedValue(null);
        const unresolved = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);
        expect(unresolved.payload.attackerPos).toBeNull();
    });

    it('does not resolve map positions when mapName is absent', async () => {
        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);
        expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
        expect(result.payload.attackerPos).toBeNull();
    });

    it('returns empty creatureTargets when combat summary is missing or has no creatures', async () => {
        for (const summary of [null, {}]) {
            combatData.getCombatSummary.mockReturnValue(summary);
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('shield_of_faith_target_selection');
            expect(result.payload.creatureTargets).toEqual([]);
        }
    });
});

// ─── applyShieldOfFaith ───

describe('shieldOfFaithHandler.applyShieldOfFaith', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
    });

    it('returns null for null, empty, or non-array targetNames with no side effects', async () => {
        for (const targetNames of [null, [], 'Ally1']) {
            expect(await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, targetNames)).toBeNull();
        }
        expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('registers buff, expiration, and log for a fresh single target', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shield of Faith',
                description: 'Ally1 gained +2 AC from Shield of Faith.',
            },
        });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', [
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2, duration: 'Concentration, up to 10 minutes', sourceCharacter: PLAYER_NAME },
        ], CAMPAIGN_NAME);
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: PLAYER_NAME,
            targetName: 'Ally1',
            effects: [{ type: 'remove_active_buff', buffName: 'Shield of Faith' }],
            campaignName: CAMPAIGN_NAME,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Shield of Faith',
            description: `${PLAYER_NAME} cast Shield of Faith on Ally1. Target's AC increases by 2.`,
        });
    });

    it('applies to each fresh target, skips those already shielded, expires and logs every target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name) =>
            name === 'Ally1' ? [{ name: 'Shield of Faith', effect: 'shield_of_faith' }] : []);

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2', 'Ally3']);

        expect(result.payload.description).toBe('3 targets gained +2 AC from Shield of Faith: Ally1, Ally2, Ally3.');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally3', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(expirations.addExpiration).toHaveBeenCalledTimes(3);
        expect(logService.addEntry).toHaveBeenCalledTimes(3);
        expect(logService.addEntry.mock.calls.map(([, e]) => e.description)).toEqual([
            `${PLAYER_NAME} cast Shield of Faith on Ally1. Target's AC increases by 2.`,
            `${PLAYER_NAME} cast Shield of Faith on Ally2. Target's AC increases by 2.`,
            `${PLAYER_NAME} cast Shield of Faith on Ally3. Target's AC increases by 2.`,
        ]);
    });

    it('treats null activeBuffs as empty and still registers the buff', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', [
            expect.objectContaining({ name: 'Shield of Faith', effect: 'shield_of_faith' }),
        ], CAMPAIGN_NAME);
    });

    it('preserves pre-existing buffs when appending Shield of Faith', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Bless', effect: 'bless' }]);

        await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', [
            { name: 'Bless', effect: 'bless' },
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2, duration: 'Concentration, up to 10 minutes', sourceCharacter: PLAYER_NAME },
        ], CAMPAIGN_NAME);
    });

    it('defaults the buff duration to Concentration and names the popup from action.name when spell is absent', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyShieldOfFaith({ name: 'Shield of Faith' }, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result.payload.description).toBe('Ally1 gained +2 AC from Shield of Faith.');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', [
            expect.objectContaining({ duration: 'Concentration, up to 10 minutes' }),
        ], CAMPAIGN_NAME);
    });
});

// ─── isShieldOfFaithActive ───

describe('shieldOfFaithHandler.isShieldOfFaithActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when a Shield of Faith buff is present, alone or among others', () => {
        for (const buffs of [
            [{ name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 }],
            [{ name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Shield of Faith', effect: 'shield_of_faith' }, { name: 'Bless', effect: 'bless' }],
        ]) {
            runtimeState.getRuntimeValue.mockReturnValue(buffs);
            expect(isShieldOfFaithActive('Ally1', CAMPAIGN_NAME)).toBe(true);
        }
    });

    it('returns false when name and effect do not both match, or the store is empty, null, or not an array', () => {
        for (const stored of [
            null,
            [],
            'not-an-array',
            [{ name: 'Shield of Faith', effect: 'something_else' }],
            [{ name: 'Some Other Buff', effect: 'shield_of_faith' }],
        ]) {
            runtimeState.getRuntimeValue.mockReturnValue(stored);
            expect(isShieldOfFaithActive('Ally1', CAMPAIGN_NAME)).toBe(false);
        }
    });
});

// ─── getShieldOfFaithBonus ───

describe('shieldOfFaithHandler.getShieldOfFaithBonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the buff acBonus, falling back to 2 when the buff matches but acBonus is absent or zero', () => {
        for (const [buffs, expected] of [
            [[{ name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 }], 2],
            [[{ name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 5 }], 5],
            [[{ name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 3 }, { name: 'Bless', effect: 'bless' }], 3],
            [[{ name: 'Shield of Faith', effect: 'shield_of_faith' }], 2],
            [[{ name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 0 }], 2],
        ]) {
            runtimeState.getRuntimeValue.mockReturnValue(buffs);
            expect(getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME)).toBe(expected);
        }
    });

    it('returns 0 when no Shield of Faith buff matches (empty, null, non-array, or name/effect mismatch)', () => {
        for (const stored of [
            null,
            [],
            'not-an-array',
            [{ name: 'Shield of Faith', effect: 'something_else' }],
            [{ name: 'Some Other Buff', effect: 'shield_of_faith' }],
        ]) {
            runtimeState.getRuntimeValue.mockReturnValue(stored);
            expect(getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME)).toBe(0);
        }
    });
});
