// @maintained-by-ai
// Barkskin handler contract: selection popup shape, AC<17 gate, activeBuffs
// registration, rounds clock, and log entries. Fully mocked and deterministic.
// AC-floor arithmetic lives in targetAcComputation.test.js (which points back
// here for buff application); confirm-lane wiring in useCustomHandlers.barkskin.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyBarkskin, isBarkskinActive } from './barkskinHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
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
    rangeToFeet: vi.fn((r) => (r === 'Touch' ? 5 : 30)),
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

const campaignName = 'test-campaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
    return { name: 'TestWizard', level: 5, ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Barkskin',
        spell: { range: 'Touch', duration: 'Up to 1 hour', ...overrides.spell },
        automation: { type: 'barkskin', ...overrides.automation },
    };
}

function applyFor({ action = makeAction(), targetNames, characters }) {
    return applyBarkskin({
        action,
        playerStats: makePlayerStats(),
        campaignName,
        targetNames,
        characters,
    });
}

function defaultApplyMocks() {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    expirations.addExpiration.mockReset();
    logService.addEntry.mockReset();
    combatData.getCombatSummary.mockReset();
}

// ─── handle ───

describe('barkskinHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }] });
    });

    it('returns target selection popup with creature list and barkskin_target_selection type', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }, { name: 'Ally2' }, { name: 'TestWizard' }],
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('barkskin_target_selection');
        expect(result.payload.name).toBe('Barkskin');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2', 'TestWizard']);
        expect(result.payload.duration).toBe('Up to 1 hour');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.rangeFt).toBe(5);
        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses provided spell range/duration and passes spell.range to rangeToFeet', async () => {
        const result = await handle(makeAction({ spell: { range: '60 feet', duration: '8 hours' } }), makePlayerStats(), campaignName, null);
        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('8 hours');
        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60 feet');
        expect(result.payload.rangeFt).toBe(30);
    });

    it('defaults range to Touch and duration to Up to 1 hour when spell is missing', async () => {
        const result = await handle({ name: 'Barkskin', automation: { type: 'barkskin' } }, makePlayerStats(), campaignName, null);
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('Up to 1 hour');
    });

    it('resolves attackerPos when mapName is provided, null when unresolved', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestWizard');

        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: null });
        const unresolved = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(unresolved.payload.attackerPos).toBeNull();
    });

    it('returns empty creatureTargets when combat summary is missing or has no creatures', async () => {
        for (const summary of [null, { creatures: [] }]) {
            combatData.getCombatSummary.mockReturnValue(summary);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('barkskin_target_selection');
            expect(result.payload.creatureTargets).toEqual([]);
        }
    });
});

// ─── applyBarkskin ───

describe('barkskinHandler.applyBarkskin', () => {
    beforeEach(defaultApplyMocks);

    it('returns null for null, empty, or non-array targetNames', async () => {
        for (const targetNames of [null, [], 'not-an-array']) {
            expect(await applyFor({ targetNames, characters: [] })).toBeNull();
        }
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('applies barkskin buff to a target with AC below 17 (registers buff, expiration, log)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin', sourceCharacter: 'TestWizard' })]), campaignName);
        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'Ally1', effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_active_buff', buffName: 'Barkskin' })]), campaignName, rounds: 600 });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally1') });
    });

    it('skips targets with AC >= 17 (boundary inclusive) with no side effects', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyFor({
            targetNames: ['Ally1', 'Ally2'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 17 } }, { name: 'Ally2', computedStats: { armorClass: 20 } }],
        });
        expect(result.payload.description).toContain('Barkskin failed on all 2 target(s)');
        expect(result.payload.description).toContain('Ally1 (AC 17)');
        expect(result.payload.description).toContain('Ally2 (AC 20)');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('uses fallback AC from armorClass when computedStats is missing', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', armorClass: 15 }],
        });
        expect(result.payload.description).toContain('1 target(s)');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('defaults AC to 10 when target has no armorClass info', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1' }],
        });
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('applies when target is absent from characters (empty or null list, AC defaults to 10)', async () => {
        for (const characters of [[], null]) {
            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            const result = await applyFor({ targetNames: ['Ally1'], characters });
            expect(result.payload.description).toContain('1 target(s) gained Barkskin');
            expect(result.payload.description).toContain('Ally1');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
        }
    });

    it('does not re-apply buff if Barkskin already active on target', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Barkskin', effect: 'barkskin' }]);
        await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('blocks re-application on name match regardless of effect value', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Barkskin', effect: 'other_effect' }]);
        await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('applies to multiple targets, skips high AC, logs each applied target only', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]).mockReturnValueOnce([]);
        const result = await applyFor({
            targetNames: ['Ally1', 'Ally2', 'Ally3'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }, { name: 'Ally2', computedStats: { armorClass: 20 } }, { name: 'Ally3', computedStats: { armorClass: 15 } }],
        });
        expect(result.payload.description).toContain('2 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Ally3');
        expect(result.payload.description).toContain('Barkskin would not improve');
        expect(result.payload.description).toContain('Ally2 (AC 20)');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.any(Array), campaignName);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally3', 'activeBuffs', expect.any(Array), campaignName);
        // One log entry per applied target; nothing for skipped targets.
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally1') });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally3') });
    });

    it('preserves existing buffs when appending Barkskin', async () => {
        const existingBuffs = [{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13 }, { name: 'Shield', effect: 'shield' }];
        useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);
        await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Mage Armor', effect: 'mage_armor' }));
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Shield', effect: 'shield' }));
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' }));
    });

    it('stamps duration text on the buff and parses the rounds clock (hours x600, minutes x10, unparseable undefined)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        for (const [duration, expectedRounds] of [
            ['1 hour', 600],
            ['Up to 1 hour', 600],
            ['10 minutes', 100],
            ['Custom duration', undefined],
        ]) {
            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            await applyFor({
                action: { name: 'Barkskin', spell: { duration }, automation: { type: 'barkskin' } },
                targetNames: ['Ally1'],
                characters: [{ name: 'Ally1', computedStats: { armorClass: 9 } }],
            });
            expect(expirations.addExpiration).toHaveBeenLastCalledWith(expect.objectContaining({ targetName: 'Ally1', rounds: expectedRounds }));
            const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.at(-1)[2];
            expect(buffsArg.find((b) => b.name === 'Barkskin').duration).toBe(duration);
        }
    });

    it('SP-013: skips an EB-joined combatant with cs AC >= 17 absent from characters', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Knight', type: 'npc', ac: 18 }] });
        const result = await applyFor({ targetNames: ['Knight'], characters: [] });
        expect(result.payload.description).toContain('Barkskin failed on all 1 target(s)');
        expect(result.payload.description).toContain('Knight (AC 18)');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('handles activeBuffs being null (not set)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        const result = await applyFor({
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(result).not.toBeNull();
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin' })]), campaignName);
    });

    it('payload carries action name and automation passthrough (empty defaults when missing)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyFor({
            action: makeAction({ automation: { customField: 'value' } }),
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Barkskin');
        expect(result.payload.automation).toEqual({ customField: 'value', type: 'barkskin' });

        const bare = await applyFor({
            action: { spell: { range: 'Touch', duration: '1 hour' }, automation: {} },
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(bare.payload.name).toBeUndefined();
    });

    it('handles duplicate target names by applying to each occurrence', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]);
        await applyFor({
            targetNames: ['Ally1', 'Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
    });
});

// ─── isBarkskinActive ───

describe('barkskinHandler.isBarkskinActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReset();
    });

    it('returns true when a Barkskin/barkskin buff is present, alone or among others', () => {
        for (const buffs of [
            [{ name: 'Barkskin', effect: 'barkskin', duration: '1_hour' }],
            [{ name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Barkskin', effect: 'barkskin' }, { name: 'Shield', effect: 'shield' }],
            [{ name: 'Shield', effect: 'shield' }, { name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Resist Energy', effect: 'resist_energy' }, { name: 'Barkskin', effect: 'barkskin' }, { name: 'Haste', effect: 'haste' }],
        ]) {
            useRuntimeState.getRuntimeValue.mockReturnValue(buffs);
            expect(isBarkskinActive('Ally1', campaignName)).toBe(true);
        }
    });

    it('returns false when name or effect does not match', () => {
        for (const buffs of [
            [{ name: 'Stone Skin', effect: 'barkskin' }],
            [{ name: 'Barkskin', effect: 'mage_armor' }],
        ]) {
            useRuntimeState.getRuntimeValue.mockReturnValue(buffs);
            expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
        }
    });

    it('returns false when activeBuffs is empty, null, or not an array', () => {
        for (const stored of [[], null, 'not-an-array']) {
            useRuntimeState.getRuntimeValue.mockReturnValue(stored);
            expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
        }
    });

    it('returns false when activeBuffs contains non-object items', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(['string', 42, { name: 'Shield', effect: 'shield' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });
});
