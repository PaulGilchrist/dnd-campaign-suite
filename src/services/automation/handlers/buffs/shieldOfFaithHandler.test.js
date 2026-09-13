// @improved-by-ai
// @cleaned-by-ai
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
    });

    it('returns target selection popup with creature list from combat summary', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);
        combatData.getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Ally1' },
                { name: PLAYER_NAME },
                { name: 'Enemy1' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('shield_of_faith_target_selection');
        expect(result.payload.name).toBe('Shield of Faith');
        expect(result.payload.creatureTargets).toEqual(['Ally1', PLAYER_NAME, 'Enemy1']);
        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.rangeFt).toBe(60);
        expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('returns empty creature list when no combat summary', async () => {
        combatData.getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('shield_of_faith_target_selection');
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns empty creature list when combat summary has no creatures', async () => {
        combatData.getCombatSummary.mockReturnValue({});

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('resolves map positions when mapName is provided', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN_NAME, 'test-map', PLAYER_NAME);
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });
    });

    it('sets attackerPos to null when resolveMapPositions resolves to null', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses spell range/duration when present, falls back to defaults when absent', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle(makeAction({ spell: { range: '30 feet', duration: '1 minute' } }), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.range).toBe('30 feet');
        expect(result.payload.duration).toBe('1 minute');
    });

    it('uses defaults when action has no spell property', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle({ name: 'Shield of Faith' }, makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
    });

    it('uses defaults when action.spell is null', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle({ name: 'Shield of Faith', spell: null }, makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
    });

    it('defaults rangeFt to 0 when range string is unparseable', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);
        rangeValidation.rangeToFeet.mockReturnValue(0);

        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Enemy1' }],
        });

        const result = await handle(makeAction({ spell: { range: 'invalid' } }), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.rangeFt).toBe(0);
    });
});

// ─── applyShieldOfFaith ───

describe('shieldOfFaithHandler.applyShieldOfFaith', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
    });

    it('returns null when targetNames is null', async () => {
        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, null);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is an empty array', async () => {
        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, 'Ally1');
        expect(result).toBeNull();
    });

    it('applies shield of faith buff and sets expiration for each target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ally1 gained +2 AC from Shield of Faith.');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', CAMPAIGN_NAME);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Shield of Faith',
                    effect: 'shield_of_faith',
                    acBonus: 2,
                    duration: 'Concentration, up to 10 minutes',
                    sourceCharacter: PLAYER_NAME,
                }),
            ]),
            CAMPAIGN_NAME
        );

        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: 'Ally1', effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Shield of Faith',
                }),
            ]), campaignName: CAMPAIGN_NAME });

        expect(logService.addEntry).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({
                type: 'ability_use',
                characterName: PLAYER_NAME,
                abilityName: 'Shield of Faith',
                description: `${PLAYER_NAME} cast Shield of Faith on Ally1. Target's AC increases by 2.`,
            })
        );
    });

    it('skips adding buff when it already exists on target but still adds expiration and log', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
            return [];
        });

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ally1 gained +2 AC from Shield of Faith.');

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
    });

    it('applies to new targets and skips duplicates in multi-target call', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
            return [];
        });

        await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
    });

    it('reports correct target count in description for multiple targets', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['A', 'B', 'C']);

        expect(result.payload.description).toContain('3 targets gained +2 AC from Shield of Faith: A, B, C.');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
    });

    it('handles target with null activeBuffs value', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
            if (key === 'activeBuffs') return null;
            return null;
        });

        const result = await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ name: 'Shield of Faith' }),
            ]),
            CAMPAIGN_NAME
        );
    });

    it('uses action name in description when spell property is absent', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const action = { name: 'Shield of Faith' };

        const result = await applyShieldOfFaith(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(result.payload.description).toContain('Shield of Faith');
    });

    it('logs with correct description for single target vs multiple', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyShieldOfFaith(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

        const logCalls = logService.addEntry.mock.calls;
        expect(logCalls[0][1].description).toBe(`${PLAYER_NAME} cast Shield of Faith on Ally1. Target's AC increases by 2.`);
        expect(logCalls[1][1].description).toBe(`${PLAYER_NAME} cast Shield of Faith on Ally2. Target's AC increases by 2.`);
    });
});

// ─── isShieldOfFaithActive ───

describe('shieldOfFaithHandler.isShieldOfFaithActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when shield of faith buff is active', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
        ]);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(true);
    });

    it('returns false when no buffs stored', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when activeBuffs is an empty array', () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns true when shield of faith is among multiple buffs', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Mage Armor', effect: 'mage_armor' },
            { name: 'Shield of Faith', effect: 'shield_of_faith' },
            { name: 'Bless', effect: 'bless' },
        ]);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(true);
    });

    it('returns false when buff has same name but different effect', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'something_else' },
        ]);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when buff has same effect but different name', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Some Other Buff', effect: 'shield_of_faith' },
        ]);

        const result = isShieldOfFaithActive('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(false);
    });
});

// ─── getShieldOfFaithBonus ───

describe('shieldOfFaithHandler.getShieldOfFaithBonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the acBonus value when shield of faith buff is active', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(2);
    });

    it('returns default 2 when acBonus is missing from buff', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'shield_of_faith' },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(2);
    });

    it('returns 0 when no buffs stored', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(0);
    });

    it('returns 0 when activeBuffs is an empty array', () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(0);
    });

    it('returns custom acBonus when present on the buff', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 5 },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(5);
    });

    it('returns default 2 when acBonus is explicitly zero (falsy fallback)', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 0 },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(2);
    });

    it('returns 0 when buff has same effect but different name', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Some Other Buff', effect: 'shield_of_faith' },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(0);
    });

    it('finds shield of faith among multiple buffs and returns its bonus', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Mage Armor', effect: 'mage_armor' },
            { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 3 },
            { name: 'Bless', effect: 'bless' },
        ]);

        const result = getShieldOfFaithBonus('Ally1', CAMPAIGN_NAME);

        expect(result).toBe(3);
    });
});
