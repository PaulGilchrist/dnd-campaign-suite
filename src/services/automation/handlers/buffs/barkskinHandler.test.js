// @improved-by-ai
// @cleaned-by-ai
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
        expect(result.payload).toHaveProperty('rangeFt');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses custom spell range and duration when provided', async () => {
        const result = await handle(makeAction({ spell: { range: '60 feet', duration: '8 hours' } }), makePlayerStats(), campaignName, null);
        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('8 hours');
    });

    it('defaults range to Touch and duration to Up to 1 hour when spell is missing', async () => {
        const result = await handle({ name: 'Barkskin', automation: { type: 'barkskin' } }, makePlayerStats(), campaignName, null);
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('Up to 1 hour');
    });

    it('includes attackerPos when mapName is provided', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestWizard');
    });

    it('returns empty creature list when no combat summary', async () => {
        combatData.getCombatSummary.mockReturnValue(null);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns popup with empty creature targets when combat has no creatures', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('barkskin_target_selection');
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns attackerPos as null when resolveMapPositions returns no position', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: null });
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
        expect(result.payload.attackerPos).toBeNull();
    });

    it('passes spell.range to rangeToFeet for rangeFt calculation', async () => {
        await handle(makeAction({ spell: { range: '30 feet' } }), makePlayerStats(), campaignName, null);
        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30 feet');
    });
});

// ─── applyBarkskin ───

describe('barkskinHandler.applyBarkskin', () => {
    beforeEach(defaultApplyMocks);

    it('returns null when targetNames is null', async () => {
        expect(await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: null,
            characters: [],
        })).toBeNull();
    });

    it('returns null when targetNames is an empty array', async () => {
        expect(await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: [],
            characters: [],
        })).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        expect(await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: 'not-an-array',
            characters: [],
        })).toBeNull();
    });

    it('applies barkskin buff to a target with AC below 17', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]);
        const characters = [{ name: 'Ally1', computedStats: { armorClass: 14 } }];
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: characters,
        });

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin', sourceCharacter: 'TestWizard' })]), campaignName);
        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'Ally1', effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_active_buff', buffName: 'Barkskin' })]), campaignName });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally1') });
    });

    it('skips targets with AC >= 17', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 18 } }],
        });
        expect(result.payload.description).toContain('Barkskin failed on all 1 target(s)');
        expect(result.payload.description).toContain('AC 18');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('skips targets with AC exactly 17', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 17 } }],
        });
        expect(result.payload.description).toContain('Barkskin failed on all 1 target(s)');
        expect(result.payload.description).toContain('AC 17');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses fallback AC from armorClass when computedStats is missing', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', armorClass: 15 }],
        });
        expect(result.payload.description).toContain('1 target(s)');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('uses default AC of 10 when no armorClass info available', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1' }],
        });
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('does not apply buff if Barkskin already active on target', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Barkskin', effect: 'barkskin' }]).mockReturnValueOnce([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not apply buff if Barkskin exists with different effect value', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Barkskin', effect: 'other_effect' }]).mockReturnValueOnce([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('applies barkskin to multiple targets, skipping those with high AC', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]).mockReturnValueOnce([]);
        const characters = [{ name: 'Ally1', computedStats: { armorClass: 14 } }, { name: 'Ally2', computedStats: { armorClass: 20 } }, { name: 'Ally3', computedStats: { armorClass: 15 } }];
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1', 'Ally2', 'Ally3'],
            characters: characters,
        });
        expect(result.payload.description).toContain('2 target(s) gained Barkskin');
        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Ally3');
        expect(result.payload.description).toContain('Barkskin would not improve');
        expect(result.payload.description).toContain('Ally2');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.any(Array), campaignName);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally3', 'activeBuffs', expect.any(Array), campaignName);
    });

    it('applies barkskin to targets not found in characters map (AC defaults to 10)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['UnknownTarget'],
            characters: [],
        });
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(result.payload.description).toContain('UnknownTarget');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('UnknownTarget', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('posts a log entry for each applied target', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1', 'Ally2'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }, { name: 'Ally2', computedStats: { armorClass: 15 } }],
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally1') });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, { type: 'ability_use', characterName: 'TestWizard', abilityName: 'Barkskin', description: expect.stringContaining('TestWizard cast Barkskin on Ally2') });
    });

    it('does not post log entries for skipped targets', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 20 } }],
        });
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('preserves existing buffs when adding Barkskin', async () => {
        const existingBuffs = [{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13 }, { name: 'Shield', effect: 'shield' }];
        useRuntimeState.getRuntimeValue.mockReturnValueOnce(existingBuffs).mockReturnValueOnce([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Mage Armor', effect: 'mage_armor' }));
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Shield', effect: 'shield' }));
        expect(buffsArg).toContainEqual(expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' }));
    });

    it('uses custom duration from spell object', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        await applyBarkskin({
            action: { name: 'Barkskin', spell: { duration: 'Custom duration' }, automation: { type: 'barkskin' } },
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg.find((b) => b.name === 'Barkskin').duration).toBe('Custom duration');
    });

    it('handles activeBuffs being null (not set)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(result).not.toBeNull();
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin' })]), campaignName);
    });

    it('handles characters array being null/undefined (AC defaults to 10)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: null,
        });
        expect(result.payload.description).toContain('1 target(s) gained Barkskin');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ name: 'Barkskin', effect: 'barkskin' })]), campaignName);
    });

    it('handles all targets being skipped (all high AC)', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1', 'Ally2'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 18 } }, { name: 'Ally2', computedStats: { armorClass: 20 } }],
        });
        expect(result.payload.description).toContain('Barkskin failed on all 2 target(s)');
        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Ally2');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup with automation info payload type', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: makeAction({ automation: { customField: 'value' } }),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.automation).toEqual({ customField: 'value', type: 'barkskin' });
    });

    it('uses default action name when action.name is missing', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
        const result = await applyBarkskin({
            action: { spell: { range: 'Touch', duration: '1 hour' }, automation: {} },
            playerStats: makePlayerStats(),
            campaignName: campaignName,
            targetNames: ['Ally1'],
            characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        });
        expect(result.payload.name).toBeUndefined();
    });

    it('handles duplicate target names by applying to each occurrence', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce([]);
        await applyBarkskin({
            action: makeAction(),
            playerStats: makePlayerStats(),
            campaignName: campaignName,
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

    it('returns true when Barkskin buff with barkskin effect exists', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Barkskin', effect: 'barkskin', duration: '1_hour' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(true);
    });

    it('returns false when buff has wrong name', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Stone Skin', effect: 'barkskin' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when buff has wrong effect', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Barkskin', effect: 'mage_armor' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is a string', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue('not-an-array');
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns true when multiple buffs include Barkskin', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Barkskin', effect: 'barkskin' }, { name: 'Shield', effect: 'shield' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(true);
    });

    it('returns true when Barkskin appears among many buffs', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([{ name: 'Shield', effect: 'shield' }, { name: 'Mage Armor', effect: 'mage_armor' }, { name: 'Resist Energy', effect: 'resist_energy' }, { name: 'Barkskin', effect: 'barkskin' }, { name: 'Haste', effect: 'haste' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(true);
    });

    it('returns false when activeBuffs contains non-object items', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(['string', 42, { name: 'Shield', effect: 'shield' }]);
        expect(isBarkskinActive('Ally1', campaignName)).toBe(false);
    });
});
