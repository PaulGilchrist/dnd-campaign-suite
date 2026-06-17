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

import { handle, handleConfirm } from './hypnoticPatternShake.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

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
        expect(result.payload.description).toContain('No combat context found');
    });

    it('returns popup with no eligible targets when combat has only caster', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Bard1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No eligible targets');
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

        expect(result.payload.targets).toContain('Ally1');
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

        expect(result.payload.targets).toContain('Goblin');
        expect(result.payload.targets).not.toContain('Orc');
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

    it('includes automation in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction({ customProp: 'value' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.automation).toEqual({ type: 'hypnotic_pattern_shake', customProp: 'value' });
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

        expect(result.payload.targets).toContain('Ally1');
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
            }),
        );
    });

    it('removes charmed/incapacitated from npc creature conditions', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [{ key: 'charmed' }, { key: 'incapacitated' }, { key: 'poisoned' }] }],
        });

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(result.type).toBe('popup');
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

    it('returns popup with correct description', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue(['charmed']);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ally1');

        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Hypnotic Pattern');
    });
});
