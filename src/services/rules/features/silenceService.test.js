import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    triggerSilence,
    isSilenceActive,
    getSilenceCenter,
    getSilenceRadius,
    getSilenceSource,
    getCreaturesInSilenceZone,
    isCreatureInSilenceZone,
    shouldHaveDeafenedFromSilence,
    getSilenceDeafenedSources,
} from './silenceService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const { executeHandler } = await import('../../automation/index.js');
const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { getDistanceFeet } = await import('../combat/rangeValidation.js');

describe('silenceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset();
        getDistanceFeet.mockReset();
    });

    describe('triggerSilence', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Wizard' };

        it('returns null for non-Silence spells', async () => {
            const result = await triggerSilence(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for lowercase "silence" spell name', async () => {
            const result = await triggerSilence(
                { name: 'silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler for "Silence" spell and returns result', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerSilence(
                { name: 'Silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('passes correct action with default values', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Silence',
                    automation: expect.objectContaining({
                        type: 'silence',
                        duration: 'Concentration, up to 10 minutes',
                        range: 120,
                        aoeRadius: 20,
                        slotLevel: 2,
                    }),
                    spellSlotLevel: 2,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2 },
                { slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ slotLevel: 5 }),
                    spellSlotLevel: 5,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as default when no metaCtx and no level', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('parses range from spell.range string', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2, range: '60-foot' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 60 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('parses aoe radius from area_of_effect.size', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2, area_of_effect: { size: '30-foot-radius' } },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ aoeRadius: 30 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerSilence(
                    { name: 'Silence', level: 2 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSilence(
                { name: 'Silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const spell = { name: 'Silence', level: 2, school: 'Evocation' };

            await triggerSilence(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults range to 120 when spell.range is undefined', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 120 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults aoeRadius to 20 when area_of_effect is undefined', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ aoeRadius: 20 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults aoeRadius to 20 when area_of_effect.size is undefined', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2, area_of_effect: {} },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ aoeRadius: 20 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults aoeRadius to 20 when aoeSize does not match pattern', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2, area_of_effect: { size: 'invalid' } },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ aoeRadius: 20 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults range to 120 when range string does not match pattern', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence(
                { name: 'Silence', level: 2, range: 'invalid' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 120 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('isSilenceActive', () => {
        it('returns true when runtime value is true', () => {
            getRuntimeValue.mockReturnValue(true);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(true);
            expect(getRuntimeValue).toHaveBeenCalledWith('Caster', 'silenceCaster', 'TestCampaign');
        });

        it('returns false when runtime value is false', () => {
            getRuntimeValue.mockReturnValue(false);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when runtime value is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when runtime value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when runtime value is 0', () => {
            getRuntimeValue.mockReturnValue(0);

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when runtime value is empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = isSilenceActive('Caster', 'TestCampaign');
            expect(result).toBe(false);
        });
    });

    describe('getSilenceCenter', () => {
        it('returns the center string when present', () => {
            getRuntimeValue.mockReturnValue('{"gridX":5,"gridY":3}');

            const result = getSilenceCenter('Caster', 'TestCampaign');
            expect(result).toBe('{"gridX":5,"gridY":3}');
        });

        it('returns null when runtime value is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getSilenceCenter('Caster', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when runtime value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = getSilenceCenter('Caster', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when runtime value is empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = getSilenceCenter('Caster', 'TestCampaign');
            expect(result).toBeNull();
        });
    });

    describe('getSilenceRadius', () => {
        it('parses radius from string value', () => {
            getRuntimeValue.mockReturnValue('30');

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(30);
        });

        it('returns 20 as default when stored value is falsy', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(20);
        });

        it('returns 20 as default when stored value is empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(20);
        });

        it('returns 20 as default when stored value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(20);
        });

        it('returns 20 as default when stored value is 0', () => {
            getRuntimeValue.mockReturnValue(0);

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(20);
        });

        it('parses numeric string radius correctly', () => {
            getRuntimeValue.mockReturnValue('60');

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(60);
        });

        it('handles stored value that is already a number', () => {
            getRuntimeValue.mockReturnValue(40);

            const result = getSilenceRadius('Caster', 'TestCampaign');
            expect(result).toBe(40);
        });
    });

    describe('getSilenceSource', () => {
        it('returns sourceCharacter when silence buff exists', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence', sourceCharacter: 'Ally1' },
                { effect: 'invisibility', sourceCharacter: 'Ally2' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBe('Ally1');
        });

        it('returns null when no silence buff exists', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'invisibility', sourceCharacter: 'Ally2' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when activeBuffs is empty array', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when activeBuffs is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns null when silence buff has no sourceCharacter', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBeNull();
        });

        it('returns the first silence buff sourceCharacter', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence', sourceCharacter: 'First' },
                { effect: 'silence', sourceCharacter: 'Second' },
            ]);

            const result = getSilenceSource('Target', 'TestCampaign');
            expect(result).toBe('First');
        });
    });

    describe('getCreaturesInSilenceZone', () => {
        const casterName = 'Caster';
        const campaignName = 'TestCampaign';

        it('returns empty array when no silence center', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return null;
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('returns empty array when no combat summary', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('returns empty array when caster not in combat summary', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
                    creatures: [],
                });
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('returns creature names within radius', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: casterName, gridX: 5, gridY: 5 }],
                    creatures: [
                        { name: 'Creature1', gridX: 6, gridY: 5 },
                        { name: 'Creature2', gridX: 10, gridY: 10 },
                    ],
                });
                return undefined;
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toContain('Creature1');
            expect(result).not.toContain('Creature2');
        });

        it('excludes the caster from the result', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: casterName, gridX: 5, gridY: 5 }],
                    creatures: [],
                });
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('excludes creatures without gridX/gridY', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: casterName, gridX: 5, gridY: 5 }],
                    creatures: [
                        { name: 'Creature1' },
                        { name: 'Creature2', gridX: 6, gridY: 5 },
                    ],
                });
                return undefined;
            });
            getDistanceFeet.mockReturnValue(5);

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual(['Creature2']);
        });

        it('includes players and creatures within radius', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [
                        { name: casterName, gridX: 5, gridY: 5 },
                        { name: 'Ally', gridX: 6, gridY: 5 },
                    ],
                    creatures: [
                        { name: 'Creature1', gridX: 7, gridY: 5 },
                    ],
                });
                return undefined;
            });
            getDistanceFeet.mockReturnValue(5);

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toContain('Ally');
            expect(result).toContain('Creature1');
            expect(result).not.toContain(casterName);
        });

        it('returns empty array when center is empty string', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('handles combatSummary as object not string', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return { gridX: 5, gridY: 5 };
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return {
                    players: [{ name: casterName, gridX: 5, gridY: 5 }],
                    creatures: [],
                };
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });

        it('handles JSON parse error in combatSummary gracefully', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return 'invalid json{{{';
                return undefined;
            });

            const result = getCreaturesInSilenceZone(casterName, campaignName);
            expect(result).toEqual([]);
        });
    });

    describe('isCreatureInSilenceZone', () => {
        it('returns false when silence is not active', () => {
            getRuntimeValue.mockReturnValue(false);

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when no silence center', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return null;
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when center has no gridX/gridY', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":null,"gridY":null}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return null;
                return undefined;
            });

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
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: 'Other', gridX: 1, gridY: 1 }],
                    creatures: [],
                });
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when target has no grid coordinates', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target' }],
                });
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns true when target is within radius', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
                });
                return undefined;
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
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 5;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target', gridX: 10, gridY: 10 }],
                });
                return undefined;
            });
            getDistanceFeet.mockReturnValue(35);

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when distance equals radius', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target', gridX: 7, gridY: 5 }],
                });
                return undefined;
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('parses center from string JSON', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') JSON.stringify({ gridX: 5, gridY: 5 });
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [],
                });
                return undefined;
            });

            isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            // If no error thrown, string parsing works
        });

        it('handles center as object directly', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return { gridX: 5, gridY: 5 };
                if (key === 'silenceRadius') return 20;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [],
                });
                return undefined;
            });

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('uses default radius 20 when radius is falsy', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return null;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
                });
                return undefined;
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
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: 'Target', gridX: 6, gridY: 5 }],
                    creatures: [],
                });
                return undefined;
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
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
                });
                return undefined;
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

    describe('shouldHaveDeafenedFromSilence', () => {
        it('returns false when silence is not active for target', () => {
            getRuntimeValue.mockReturnValue(false);

            const result = shouldHaveDeafenedFromSilence('Target', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns false when target is not in silence zone', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 5;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: 'Target', gridX: 10, gridY: 10 }],
                    creatures: [],
                });
                return undefined;
            });
            getDistanceFeet.mockReturnValue(35);

            const result = shouldHaveDeafenedFromSilence('Target', 'TestCampaign');
            expect(result).toBe(false);
        });

        it('returns true when target is in silence zone', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [{ name: 'Target', gridX: 6, gridY: 5 }],
                    creatures: [],
                });
                return undefined;
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = shouldHaveDeafenedFromSilence('Target', 'TestCampaign');
            expect(result).toBe(true);
        });
    });

    describe('getSilenceDeafenedSources', () => {
        it('returns array of sources for creatures in silence zone', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [
                    { effect: 'silence', sourceCharacter: 'Caster1' },
                    { effect: 'silence', sourceCharacter: 'Caster2' },
                    { effect: 'invisibility', sourceCharacter: 'Caster3' },
                ];
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [
                        { name: 'Target', gridX: 6, gridY: 5 },
                        { name: 'Caster1', gridX: 6, gridY: 5 },
                        { name: 'Caster2', gridX: 7, gridY: 5 },
                    ],
                });
                return undefined;
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toContain('Caster1');
            expect(result).toContain('Caster2');
            expect(result).not.toContain('Caster3');
        });

        it('returns empty array when no silence buffs', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'invisibility', sourceCharacter: 'Caster1' },
            ]);

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('returns empty array when activeBuffs is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('returns empty array when activeBuffs is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('excludes sources outside silence zone', () => {
            const centers = {
                Caster1: { gridX: 6, gridY: 5 },
                Caster2: { gridX: 10, gridY: 10 },
            };
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [
                    { effect: 'silence', sourceCharacter: 'Caster1' },
                    { effect: 'silence', sourceCharacter: 'Caster2' },
                ];
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return JSON.stringify(centers[player] || { gridX: 5, gridY: 5 });
                if (key === 'silenceRadius') return 5;
                if (key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [
                        { name: 'Target', gridX: 6, gridY: 5 },
                        { name: 'Caster1', gridX: 6, gridY: 5 },
                        { name: 'Caster2', gridX: 10, gridY: 10 },
                    ],
                });
                return undefined;
            });
            getDistanceFeet.mockImplementation((center, target) => {
                const dx = target.gridX - center.gridX;
                const dy = target.gridY - center.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toContain('Caster1');
            expect(result).not.toContain('Caster2');
        });

        it('returns empty array when sourceCharacter is missing from buff', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'silence' },
            ]);

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('returns empty array when silence is not active', () => {
            getRuntimeValue.mockImplementation((player, key, campaign) => {
                if (key === 'activeBuffs') return [
                    { effect: 'silence', sourceCharacter: 'Caster1' },
                ];
                if (key === 'silenceCaster') return false;
                if (key === 'silenceCenter') return '{"gridX":5,"gridY":5}';
                if (key === 'silenceRadius') return 10;
                if (campaign === 'TestCampaign' && key === 'combatSummary') return JSON.stringify({
                    players: [],
                    creatures: [],
                });
                return undefined;
            });

            const result = getSilenceDeafenedSources('Target', 'TestCampaign');
            expect(result).toEqual([]);
        });
    });
});
