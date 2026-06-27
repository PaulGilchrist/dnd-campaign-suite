// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    triggerSilence,
    isSilenceActive,
    getSilenceSource,
    isCreatureInSilenceZone,
} from './silenceService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const { executeHandler } = await import('../../automation/index.js');
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { getDistanceFeet } = await import('../combat/rangeValidation.js');

describe('silenceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerSilence', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Wizard' };

        it('returns null for non-Silence spells', async () => {
            const result = await triggerSilence({ name: 'Fire Bolt', level: 0 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('is case-sensitive and rejects lowercase "silence"', async () => {
            const result = await triggerSilence({ name: 'silence', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns the handler result for "Silence" spell', async () => {
            const handlerResult = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(handlerResult);

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toEqual(handlerResult);
        });

        it('passes null to the handler when executeHandler rejects', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
        });

        it('passes null to the handler when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
        });

        it('passes the original spell object to the handler', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const spell = { name: 'Silence', level: 2, school: 'Evocation' };

            await triggerSilence(spell, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.spell).toBe(spell);
        });

        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2 }, { slotLevel: 5 }, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(5);
            expect(action.automation.slotLevel).toBe(5);
        });

        it('falls back to spell.level when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 4 }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(4);
            expect(action.automation.slotLevel).toBe(4);
        });

        it('uses default level 2 when spell has no level and no metaCtx', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence' }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(2);
            expect(action.automation.slotLevel).toBe(2);
        });

        it('parses range from spell.range string like "60-foot"', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, range: '60-foot' }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.range).toBe(60);
        });

        it('defaults range to 120 when spell.range is missing', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.range).toBe(120);
        });

        it('defaults range to 120 when range string does not match pattern', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, range: 'invalid' }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.range).toBe(120);
        });

        it('parses aoe radius from area_of_effect.size like "30-foot-radius"', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, area_of_effect: { size: '30-foot-radius' } }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.aoeRadius).toBe(30);
        });

        it('defaults aoeRadius to 20 when area_of_effect is missing', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.aoeRadius).toBe(20);
        });

        it('defaults aoeRadius to 20 when area_of_effect.size is missing', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, area_of_effect: {} }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.aoeRadius).toBe(20);
        });

        it('defaults aoeRadius to 20 when size does not match pattern', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, area_of_effect: { size: 'invalid' } }, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation.aoeRadius).toBe(20);
        });

        it('passes correct campaignName and mapName to the handler', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('isSilenceActive', () => {
        it('returns true when runtime value is strictly true', () => {
            getRuntimeValue.mockReturnValue(true);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(true);
            expect(getRuntimeValue).toHaveBeenCalledWith('Caster', 'silenceCaster', 'TestCampaign');
        });

        it('returns false for any non-true value', () => {
            const falsyValues = [false, null, undefined, 0, '', 'yes', [], {}];

            for (const val of falsyValues) {
                getRuntimeValue.mockReturnValue(val);
                const result = isSilenceActive('Caster', 'TestCampaign');
                expect(result).toBe(false);
            }
        });
    });

    describe('getSilenceSource', () => {
        it('returns sourceCharacter from first matching silence buff', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence', sourceCharacter: 'Ally1' },
                { effect: 'invisibility', sourceCharacter: 'Ally2' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBe('Ally1');
        });

        it('returns the first silence source when multiple exist', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence', sourceCharacter: 'First' },
                { effect: 'silence', sourceCharacter: 'Second' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBe('First');
        });

        it('returns null when no silence buff exists', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'invisibility', sourceCharacter: 'Ally2' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when activeBuffs is null or empty', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(getSilenceSource('Target', 'TestCampaign')).toBeNull();

            getRuntimeValue.mockReturnValue([]);
            expect(getSilenceSource('Target', 'TestCampaign')).toBeNull();
        });

        it('returns null when silence buff lacks sourceCharacter', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'silence' }]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });
    });

    describe('isCreatureInSilenceZone', () => {
        function setupBase(casterActive, center, radius, combatSummary) {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return casterActive;
                if (key === 'silenceCenter') return typeof center === 'string' ? center : JSON.stringify(center);
                if (key === 'silenceRadius') return radius;
                if (key === 'combatSummary') return JSON.stringify(combatSummary);
                return undefined;
            });
        }

        it('returns false when silence is not active', () => {
            getRuntimeValue.mockReturnValue(false);

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when no silence center', () => {
            setupBase(true, null, 20, { players: [], creatures: [] });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when center has no gridX/gridY', () => {
            setupBase(true, { gridX: null, gridY: null }, 20, { players: [], creatures: [] });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when no combat summary', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when target not found in combat summary', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 20, {
                players: [{ name: 'Other', gridX: 1, gridY: 1 }],
                creatures: [],
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when target has no grid coordinates', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 20, {
                players: [],
                creatures: [{ name: 'Target' }],
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns true when target is within radius', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('returns false when target is outside radius', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 5, {
                players: [],
                creatures: [{ name: 'Target', gridX: 10, gridY: 10 }],
            });
            getDistanceFeet.mockReturnValue(35);

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns true when distance equals radius (boundary)', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 7, gridY: 5 }],
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('parses center from string JSON and handles object center', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return { gridX: 5, gridY: 5 };
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({ players: [], creatures: [] });
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('uses default radius 20 when radius is falsy', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, null, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('finds target in players array', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [{ name: 'Target', gridX: 6, gridY: 5 }],
                creatures: [],
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('finds target in creatures array', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });
    });
});
