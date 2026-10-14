import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyDeathWard, isDeathWardActive } from './deathWardHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../../services/ui/logService.js';
import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as combatData from '../../../../services/encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

const PLAYER_NAME = 'Cleric1';
const CAMPAIGN_NAME = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Death Ward',
        spell: {
            name: 'Death Ward',
            range: 'Touch',
            duration: '8 hours',
            ...overrides.spell,
        },
        automation: {
            type: 'death_ward',
            target: 'willing_creature',
            duration: '8 hours',
            casting_time: '1 action',
            range: 'Touch',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// ─── handle ───

describe('deathWardHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeValidation.rangeToFeet.mockReturnValue(0);
        targetResolver.resolveMapPositions.mockResolvedValue(null);
    });

    it('returns a popup with type death_ward_target_selection', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(undefined);
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('death_ward_target_selection');
        expect(result.payload.name).toBe('Death Ward');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('8 hours');
        expect(result.payload.rangeFt).toBe(0);
        expect(result.payload.attackerPos).toBeNull();
    });

    it('includes creature targets from combat summary', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Cleric1' },
                { name: 'Fighter1' },
                { name: 'Goblin' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.creatureTargets).toEqual(['Cleric1', 'Fighter1', 'Goblin']);
    });

    it('returns empty creature list when no combat summary', async () => {
        combatData.getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns empty creature list when combat summary has no creatures property', async () => {
        combatData.getCombatSummary.mockReturnValue({});

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('resolves map positions when mapName is provided', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN_NAME, 'test-map', PLAYER_NAME);
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });
    });

    it('sets attackerPos to null when resolveMapPositions resolves to null', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue(null);
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses spell range/duration when present, falls back to defaults when absent', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle(
            makeAction({ spell: { range: '60 feet', duration: '1 minute' } }),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            [],
        );

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('1 minute');
    });

    it('uses defaults when action has no spell property', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle({ name: 'Death Ward' }, makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('8 hours');
    });

    it('uses defaults when action.spell is null', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle({ name: 'Death Ward', spell: null }, makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('8 hours');
    });

    it('defaults rangeFt to 0 when range string is unparseable', async () => {
        rangeValidation.rangeToFeet.mockReturnValue(0);
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await handle(makeAction({ spell: { range: 'invalid' } }), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.payload.rangeFt).toBe(0);
    });
});

// ─── applyDeathWard ───

describe('deathWardHandler.applyDeathWard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
    });

    it('returns null when targetNames is null', async () => {
        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, null);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is undefined', async () => {
        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, undefined);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is an empty array', async () => {
        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, 'Fighter1');
        expect(result).toBeNull();
    });

    it('adds death_ward buff to target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Death Ward');
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter1', 'activeBuffs', CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Death Ward',
                    effect: 'death_ward',
                    duration: '8 hours',
                    sourceCharacter: PLAYER_NAME,
                }),
            ]),
            CAMPAIGN_NAME,
        );
    });

    it('logs ability_use entry for each target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(logService.addEntry).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({
                type: 'ability_use',
                characterName: PLAYER_NAME,
                abilityName: 'Death Ward',
                description: expect.stringContaining('Death Ward'),
            }),
        );
    });

    it('does not add duplicate buff if already active', async () => {
        const existingBuff = {
            name: 'Death Ward',
            effect: 'death_ward',
            duration: '8 hours',
            sourceCharacter: 'OtherCleric',
        };
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [existingBuff];
            return undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles target with null activeBuffs value', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return null;
            return undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ name: 'Death Ward' })]),
            CAMPAIGN_NAME,
        );
    });

    it('handles target with non-array activeBuffs value', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return 'invalid';
            return undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ name: 'Death Ward' })]),
            CAMPAIGN_NAME,
        );
    });

    it('applies to new targets and skips duplicates in multi-target call', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name) => {
            if (name === 'Fighter1') return [{ name: 'Death Ward', effect: 'death_ward' }];
            return [];
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1', 'Ranger1']);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('2 targets');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ranger1', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
    });

    it('reports correct target count in description for multiple targets', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1', 'Ranger1']);

        expect(result.payload.description).toContain('2 targets');
        expect(result.payload.description).toContain('Fighter1');
        expect(result.payload.description).toContain('Ranger1');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'activeBuffs', expect.anything(), CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ranger1', 'activeBuffs', expect.anything(), CAMPAIGN_NAME);
    });

    it('uses action name in description when spell property is absent', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const action = { name: 'Death Ward' };

        const result = await applyDeathWard(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(result.payload.description).toContain('Death Ward');
    });

    it('uses duration from spell when present', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        await applyDeathWard(
            makeAction({ spell: { duration: '1 hour' } }),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Fighter1'],
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ duration: '1 hour' })]),
            CAMPAIGN_NAME,
        );
    });

    it('logs with correct description for each target individually', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1', 'Ranger1']);

        const logCalls = logService.addEntry.mock.calls;
        expect(logCalls[0][1].description).toBe(`${PLAYER_NAME} cast Death Ward on Fighter1. Target is protected from death.`);
        expect(logCalls[1][1].description).toBe(`${PLAYER_NAME} cast Death Ward on Ranger1. Target is protected from death.`);
    });
});

// ─── isDeathWardActive ───

describe('deathWardHandler.isDeathWardActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when death_ward buff is active', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Death Ward', effect: 'death_ward', duration: '8 hours' },
        ]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(true);
    });

    it('returns false when no death_ward buff exists', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Mage Armor', effect: 'mage_armor' },
        ]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when buff has different effect type', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Death Ward', effect: 'shield_of_faith' },
        ]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when buff has same effect but different name', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Some Other Buff', effect: 'death_ward' },
        ]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when no buffs exist', () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns false when activeBuffs is a non-array value', () => {
        runtimeState.getRuntimeValue.mockReturnValue('invalid');

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(false);
    });

    it('returns true when death_ward is among multiple buffs', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Mage Armor', effect: 'mage_armor' },
            { name: 'Death Ward', effect: 'death_ward', duration: '8 hours' },
            { name: 'Bless', effect: 'bless' },
        ]);

        const result = isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME);

        expect(result).toBe(true);
    });
});
