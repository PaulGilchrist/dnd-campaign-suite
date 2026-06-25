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
    default: {
        set: vi.fn(),
    },
}));

import { handle, handleConfirm } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric1',
        level: 5,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Shake Asleep',
        automation: { type: 'sleep_shake', ...automation },
    };
}

// ─── handle ───

describe('sleepShakeHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with no combat context when getCombatContext returns null', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No combat context found.');
        expect(result.payload.automation).toEqual({ type: 'sleep_shake' });
    });

    it('returns popup with no combat context when getCombatContext returns object without creatures', async () => {
        getCombatContext.mockResolvedValue({});

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No combat context found.');
    });

    it('returns popup with no eligible targets when combat has only caster', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Cleric1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No eligible targets within range.');
    });

    it('returns popup with no eligible targets when combat has empty creatures array', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No eligible targets within range.');
    });

    it('returns popup with no eligible targets when only caster is in combat', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Cleric1', type: 'player', conditions: [] }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No eligible targets within range.');
    });

    it('returns modal with sleepShake modalName for eligible NPC target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sleepShake');
    });

    it('includes attackerName and campaignName in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerName).toBe('Cleric1');
        expect(result.payload.campaignName).toBe(campaignName);
    });

    it('includes targets list in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc' },
                { name: 'Cleric1', type: 'player' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
    });

    it('excludes caster from targets list', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Cleric1', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).not.toContain('Cleric1');
    });

    it('prefers incapacitated/unconscious player targets over eligible NPC targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'blinded' }] },
            ],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['unconscious'];
            return [];
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Ally1']);
    });

    it('prefers incapacitated/unconscious npc targets over eligible npc targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }] },
                { name: 'Orc', type: 'npc', conditions: [] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Goblin']);
    });

    it('falls back to eligible targets when no incapacitated/unconscious creatures exist', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [] },
                { name: 'Orc', type: 'npc', conditions: [] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Goblin');
        expect(result.payload.targets).toContain('Orc');
    });

    it('includes featureName in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.featureName).toBe('Shake Asleep');
    });

    it('uses custom action name when provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle({ name: 'Custom Shake', automation: {} }, makePlayerStats(), campaignName, mapName);

        expect(result.payload.featureName).toBe('Custom Shake');
    });

    it('includes rangeFeet in payload parsed from range string', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction({ range: '10 ft' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(10);
    });

    it('includes rangeFeet as default 5 when no range specified', async () => {
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

        expect(result.payload.automation).toEqual({ type: 'sleep_shake', customProp: 'value' });
    });

    it('handles player with incapacitated condition via getRuntimeValue', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'Goblin', type: 'npc', conditions: [] },
            ],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['incapacitated'];
            return [];
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Ally1']);
    });

    it('handles npc with unconscious condition using conditions.key format', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }] },
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

    it('skips resolveMapPositions when mapName is null', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(resolveMapPositions).not.toHaveBeenCalled();
    });

    it('calls resolveMapPositions when mapName is provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'Cleric1');
    });

    it('handles player target with non-sleep conditions (should not appear as sleep target)', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'Goblin', type: 'npc', conditions: [] },
            ],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['poisoned', 'blinded'];
            return [];
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toContain('Ally1');
        expect(result.payload.targets).toContain('Goblin');
    });

    it('handles npc with both unconscious and incapacitated conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }, { key: 'incapacitated' }, { key: 'poisoned' }] },
                { name: 'Orc', type: 'npc', conditions: [] },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.targets).toEqual(['Goblin']);
    });
});

// ─── handleConfirm ───

describe('sleepShakeHandler.handleConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when targetName is null', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null);

        expect(result).toBeNull();
    });

    it('returns null when targetName is undefined', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, undefined);

        expect(result).toBeNull();
    });

    it('returns null when targetName is empty string', async () => {
        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '');

        expect(result).toBeNull();
    });

    it('returns popup when target exists in combat context', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
    });

    it('returns popup when target does not exist in combat context', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'NonExistent');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('NonExistent is no longer affected by Sleep.');
    });

    it('returns popup when combat context has no creatures', async () => {
        getCombatContext.mockResolvedValue({});

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
    });

    it('removes incapacitated and unconscious conditions from player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['incapacitated', 'unconscious', 'poisoned'];
            return [];
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('does not call setRuntimeValue when no sleep conditions present on player', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['poisoned'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('posts condition log entry for removed incapacitated on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['incapacitated'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: 'Ally1',
                condition: 'Incapacitated',
            }),
        );
    });

    it('posts condition log entry for removed unconscious on player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['unconscious'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: 'Ally1',
                condition: 'Unconscious',
            }),
        );
    });

    it('posts two condition log entries when player has both incapacitated and unconscious', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['incapacitated', 'unconscious'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).toHaveBeenCalledTimes(2);
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Incapacitated' }),
        );
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Unconscious' }),
        );
    });

    it('posts no log entries when player has neither incapacitated nor unconscious', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['poisoned'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('returns popup with description naming the target for player target', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['unconscious'];
            return [];
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Sleep');
    });

    it('removes conditions from npc creature conditions array', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }, { key: 'incapacitated' }, { key: 'poisoned' }] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
    });

    it('removes only incapacitated/unconscious from npc, keeps other conditions', async () => {
        const combatSummary = {
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }, { key: 'incapacitated' }, { key: 'poisoned' }] }],
        };
        getCombatContext.mockResolvedValue(combatSummary);

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        const goblin = combatSummary.creatures[0];
        const remainingKeys = goblin.conditions.map(c => c.key);
        expect(remainingKeys).toContain('poisoned');
        expect(remainingKeys).not.toContain('unconscious');
        expect(remainingKeys).not.toContain('incapacitated');
    });

    it('posts condition log entries for npc with incapacitated and unconscious', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }, { key: 'incapacitated' }] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(postLogEntry).toHaveBeenCalledTimes(2);
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Incapacitated' }),
        );
        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({ condition: 'Unconscious' }),
        );
    });

    it('posts no log entries for npc with no sleep conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'poisoned' }] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('posts no log entries for npc with empty conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('posts no log entries for npc with null conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('posts ability_use log entry for both player and npc targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(addEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'ability_use',
                characterName: 'Cleric1',
                abilityName: 'Shake Asleep',
                targetName: 'Goblin',
            }),
        );
    });

    it('uses correct description format in ability_use log entry', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(addEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                description: 'Cleric1 used an action to shake Goblin out of its magical slumber.',
            }),
        );
    });

    it('calls storage.set for npc target to persist combatSummary', async () => {
        const storage = await import('../../../ui/storage.js');

        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'unconscious' }] }],
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(storage.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('does not call storage.set for player target', async () => {
        const storage = await import('../../../ui/storage.js');

        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockImplementation((name) => {
            if (name === 'Ally1') return ['unconscious'];
            return [];
        });

        await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(storage.default.set).not.toHaveBeenCalled();
    });
});
