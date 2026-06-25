// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        if (typeof r === 'number') return r;
        const m = String(r).match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 5;
    }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

import { handle, handleConfirm } from './hypnoticPatternShake.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import storage from '../../../ui/storage.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Bard1',
        level: 5,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Shake Out Stupor',
        automation: { type: 'hypnotic_pattern_shake', ...automation },
    };
}

// ─── handle ───

describe('hypnoticPatternShake.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with no combat context', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Shake Out Stupor');
        expect(result.payload.description).toBe('No combat context found.');
        expect(result.payload.automation).toEqual({ type: 'hypnotic_pattern_shake' });
    });

    it('returns popup with no eligible targets when combat has only caster', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Bard1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No eligible targets within range.');
    });

    it('returns modal with hypnoticPatternShake modalName', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('hypnoticPatternShake');
    });

    it('includes targets list in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc' },
                { name: 'Bard1', type: 'player' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
    });

    it('excludes caster from targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Bard1', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).not.toContain('Bard1');
    });

    it('prefers charmed/incapacitated player targets over eligible targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'blinded' }] },
            ],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Ally1']);
        expect(result.payload.targets).not.toContain('Goblin');
    });

    it('prefers charmed/incapacitated npcs over eligible targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'charmed' }] },
                { name: 'Orc', type: 'npc', conditions: [] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Goblin']);
        expect(result.payload.targets).not.toContain('Orc');
    });

    it('returns no eligible targets popup when only caster is charmed/incapacitated', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Bard1', type: 'player' },
            ],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No eligible targets within range.');
    });

    it('includes featureName in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.featureName).toBe('Shake Out Stupor');
    });

    it('uses custom action name when provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle({ name: 'Custom Shake', automation: {} }, makePlayerStats(), campaignName, mapName);

        expect(result.payload.featureName).toBe('Custom Shake');
    });

    it('includes rangeFeet in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction({ range: '5 ft' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(5);
    });

    it('defaults rangeFeet to 5 when range not specified', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(5);
    });

    it('includes automation in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction({ customProp: 'value' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.automation).toEqual({ type: 'hypnotic_pattern_shake', customProp: 'value' });
    });

    it('includes attackerName and campaignName in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerName).toBe('Bard1');
        expect(result.payload.campaignName).toBe('TestCampaign');
    });

    it('handles player with incapacitated condition', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'Goblin', type: 'npc', conditions: [] },
            ],
        });
        getRuntimeValue.mockReturnValue(['incapacitated']);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Ally1']);
    });

    it('handles npc with charmed condition using conditions.key format', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'charmed' }] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
    });

    it('handles npc with incapacitated condition using conditions.key format', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'incapacitated' }] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
    });

    it('uses eligible targets when no charmed/incapacitated targets exist', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.targets).toContain('Goblin');
    });

    it('calls resolveMapPositions when mapName is provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'Bard1');
    });

    it('handles missing conditions array on npc gracefully', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
    });
});

// ─── handleConfirm ───

describe('handleConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no targetName provided', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null);

        expect(result).toBeNull();
    });

    it('returns null when empty string targetName provided', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '');

        expect(result).toBeNull();
    });

    it('removes charmed and incapacitated conditions from player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('removes speed_zero along with charmed/incapacitated from player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed', 'speed_zero', 'poisoned']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('posts condition log entry for removed charmed on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: 'Ally1',
                condition: 'Charmed',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
            }),
        );
    });

    it('posts condition log entry for removed incapacitated on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['incapacitated']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: 'Ally1',
                condition: 'Incapacitated',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
            }),
        );
    });

    it('posts condition log entries for charmed, incapacitated, and speed_zero on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledTimes(3);
        expect(postLogEntry).toHaveBeenNthCalledWith(
            1,
            campaignName,
            expect.objectContaining({ condition: 'Charmed' }),
        );
        expect(postLogEntry).toHaveBeenNthCalledWith(
            2,
            campaignName,
            expect.objectContaining({ condition: 'Incapacitated' }),
        );
        expect(postLogEntry).toHaveBeenNthCalledWith(
            3,
            campaignName,
            expect.objectContaining({ condition: 'Speed_zero' }),
        );
    });

    it('does not call setRuntimeValue when no removable conditions exist on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['poisoned']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('posts log entries for all tracked conditions when charmed is the only condition on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledTimes(3);
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Charmed' }),
        );
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Incapacitated' }),
        );
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Speed_zero' }),
        );
    });

    it('removes charmed/incapacitated from npc creature conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'charmed' }, { key: 'incapacitated' }, { key: 'poisoned' }] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('posts condition log entries for npc with charmed and incapacitated', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'charmed' }, { key: 'incapacitated' }] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(postLogEntry).toHaveBeenCalledTimes(2);
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Charmed' }),
        );
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Incapacitated' }),
        );
    });

    it('does not post log entries when npc has no removable conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'poisoned' }] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('removes speed_zero from npc conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'speed_zero' }, { key: 'poisoned' }] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(storage.set).toHaveBeenCalledWith(
            'combatSummary',
            expect.objectContaining({
                creatures: [expect.objectContaining({
                    conditions: [{ key: 'poisoned' }]
                })]
            }),
            campaignName,
        );
    });

    it('returns popup with correct description', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Hypnotic Pattern');
    });

    it('returns popup with correct description for npc target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.payload.description).toContain('Goblin');
        expect(result.payload.description).toContain('Hypnotic Pattern');
    });

    it('posts ability_use log entry via addEntry', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'Bard1',
            abilityName: 'Shake Out Stupor',
            targetName: 'Ally1',
        }));
    });

    it('does not call setRuntimeValue or postLogEntry when player target has no conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue([]);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('returns popup with correct description when target not found in combat', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Other', type: 'npc' }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'MissingTarget');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('MissingTarget');
    });
});
