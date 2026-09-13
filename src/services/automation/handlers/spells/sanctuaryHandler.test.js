// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import {
    handle,
    isSanctuaryActive,
    endSanctuary,
    getSanctuaryTarget,
} from './sanctuaryHandler.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'Cleric1';
const targetName = 'Rogue1';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        level: 5,
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(automation = {}, metaCtx = {}) {
    return {
        name: 'Sanctuary',
        automation: { type: 'sanctuary', ...automation },
        metaCtx,
    };
}

// ─── handle ───

describe('sanctuaryHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup with correct structure', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { targetName }), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sanctuary');
        expect(result.payload.targetName).toBe(targetName);
        expect(result.payload.automationType).toBe('sanctuary');
    });

    it('uses metaCtx.targetName when provided, falls back to Unknown', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { targetName: 'Barbarian1' }), makePlayerStats(), campaignName, null);

        expect(result.payload.targetName).toBe('Barbarian1');
        expect(result.payload.description).toContain('Barbarian1');
    });

    it('uses "Unknown" as targetName when no metaCtx provided', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.targetName).toBe('Unknown');
        expect(result.payload.description).toContain('Unknown');
    });

    it('uses spellAbilities.saveDc when available', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats({ spellAbilities: { saveDc: 13 } }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2][0].saveDc).toBe(13);
    });

    it('computes saveDc from proficiency when spellAbilities.saveDc is missing', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats({ proficiency: 3 }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2][0].saveDc).toBe(11);
    });

    it('stores sanctuary effect with correct properties', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats({ spellAbilities: { saveDc: 13 } }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        const effect = effectCall[2][0];
        expect(effect.target).toBe(targetName);
        expect(effect.effect).toBe('sanctuary');
        expect(effect.source).toBe(casterName);
        expect(effect.duration).toBe('1 minute');
        expect(effect.saveDc).toBe(13);
    });

    it('replaces existing sanctuary effect when caster re-casts on same target', async () => {
        const existingEffect = {
            target: targetName,
            effect: 'sanctuary',
            source: casterName,
            duration: '1 minute',
            saveDc: 10,
        };
        getRuntimeValue.mockReturnValue([existingEffect]);

        await handle(makeAction({}, { targetName }), makePlayerStats({ spellAbilities: { saveDc: 15 } }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2]).toHaveLength(1);
        expect(effectCall[2][0].saveDc).toBe(15);
    });

    it('does not replace sanctuary from a different caster', async () => {
        const otherCasterEffect = {
            target: targetName,
            effect: 'sanctuary',
            source: 'Cleric2',
            duration: '1 minute',
            saveDc: 12,
        };
        getRuntimeValue.mockReturnValue([otherCasterEffect]);

        await handle(makeAction(), makePlayerStats({ spellAbilities: { saveDc: 15 } }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2]).toHaveLength(2);
    });

    it('pushes sanctuary effect when none exists for target+source combo', async () => {
        getRuntimeValue.mockReturnValue([{ target: 'Goblin', effect: 'sanctuary', source: 'Cleric2' }]);

        await handle(makeAction(), makePlayerStats({ spellAbilities: { saveDc: 13 } }), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2]).toHaveLength(2);
    });

    it('calls addExpiration with correct parameters', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats(), campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName, effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_target_effect',
                    effectKey: 'sanctuary',
                    source: casterName,
                }),
            ]), campaignName, rounds: undefined, expireOnCreatureName: targetName });
    });

    it('calls addEntry with ability_use log entry', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Sanctuary',
            description: expect.stringContaining(`Cleric1 casts Sanctuary on ${targetName}`),
            timestamp: expect.any(Number),
        }));
    });

    it('includes WIS save info in log description', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('WIS save'),
        }));
    });

    it('includes popup description with mechanics explanation', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { targetName }), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('creatures targeting Rogue1 with attacks or damaging spells must succeed on a WIS save');
        expect(result.payload.description).toContain('Spell ends if Rogue1 attacks, casts a spell, or deals damage');
    });

    it('passes automation object through to payload', async () => {
        getRuntimeValue.mockReturnValue([]);
        const auto = { type: 'sanctuary', duration: '1 minute' };

        const result = await handle(makeAction(auto), makePlayerStats(), campaignName, null);

        expect(result.payload.automation).toEqual(auto);
    });

    it('handles action with no automation object', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle({ name: 'Sanctuary' }, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.automationType).toBeUndefined();
    });

    it('handles action with empty automation object', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle({ name: 'Sanctuary', automation: {} }, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.automationType).toBeUndefined();
    });

    it('uses playerStats.name as source in effect', async () => {
        getRuntimeValue.mockReturnValue([]);

        const customStats = makePlayerStats({ name: 'Priest2' });
        await handle(makeAction(), customStats, campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2][0].source).toBe('Priest2');
    });

    it('passes campaignName to setRuntimeValue', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[3]).toBe(campaignName);
    });
});

// ─── isSanctuaryActive ───

describe('isSanctuaryActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when no targetEffects exist', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns false when targetEffects is null', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns false when sanctuary effect is absent', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'shield', source: casterName },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns true when sanctuary is active on target from caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(true);
    });

    it('returns false when sanctuary is on different target', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'sanctuary', source: casterName },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns false when sanctuary is from different caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: 'Cleric2' },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns false when sanctuary is on different target AND different caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'sanctuary', source: 'Cleric2' },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(false);
    });

    it('returns true among multiple effects when sanctuary matches', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: targetName, effect: 'bless', source: casterName },
        ]);

        const result = isSanctuaryActive(targetName, casterName, campaignName);

        expect(result).toBe(true);
    });
});

// ─── endSanctuary ───

describe('endSanctuary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when sanctuary is not active', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'test reason');

        expect(result).toBeNull();
    });

    it('returns null when targetEffects is null', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = endSanctuary(casterName, targetName, campaignName, 'test reason');

        expect(result).toBeNull();
    });

    it('removes sanctuary effect and returns popup', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sanctuary');
    });

    it('filters only the matching sanctuary effect', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: targetName, effect: 'bless', source: 'Cleric2' },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2]).toHaveLength(2);
        expect(effectCall[2].some(te => te.effect === 'faerie_fire')).toBe(true);
        expect(effectCall[2].some(te => te.effect === 'bless')).toBe(true);
        expect(effectCall[2].some(te => te.effect === 'sanctuary')).toBe(false);
    });

    it('does not remove sanctuary from a different caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: 'Cleric2' },
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[2]).toHaveLength(1);
        expect(effectCall[2][0].source).toBe('Cleric2');
    });

    it('passes campaignName to setRuntimeValue with sync flag true', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        const setCalls = setRuntimeValue.mock.calls;
        const effectCall = setCalls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(effectCall[3]).toBe(campaignName);
        expect(effectCall[4]).toBe(true);
    });

    it('calls addEntry with condition removed log entry', async () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Sanctuary',
            reason: 'Sanctuary ended',
            note: 'Target attacked',
            timestamp: expect.any(Number),
        }));
    });

    it('includes reason in popup description', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'Target dealt damage');

        expect(result.payload.description).toContain('Target dealt damage');
    });

    it('includes target name in popup description', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'Expired');

        expect(result.payload.description).toContain(targetName);
        expect(result.payload.description).toContain('no longer warded by Sanctuary');
    });

    it('returns null when sanctuary effect is absent (no change)', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'sanctuary', source: 'Cleric2' },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'test');

        expect(result).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup with automation_info type', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'test');

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sanctuary');
        expect(result.payload.targetName).toBe(targetName);
    });
});

// ─── getSanctuaryTarget ───

describe('getSanctuaryTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no targetEffects exist', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when targetEffects is null', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when caster has no sanctuary effect', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'shield', source: casterName },
        ]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the target when caster has sanctuary active', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBe(targetName);
    });

    it('returns null when sanctuary is from a different caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: 'Cleric2' },
        ]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the first sanctuary target found for the caster', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: 'Orc', effect: 'sanctuary', source: casterName },
        ]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBe(targetName);
    });

    it('finds sanctuary among many other effects', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: 'Goblin', effect: 'bless', source: casterName },
            { target: 'Goblin', effect: 'shield', source: casterName },
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: 'Goblin', effect: 'hex', source: casterName },
        ]);

        const result = getSanctuaryTarget(casterName, campaignName);

        expect(result).toBe(targetName);
    });
});
