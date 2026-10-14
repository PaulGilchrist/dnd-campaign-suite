import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    triggerSilence,
    isSilenceActive,
    getSilenceSource,
    isCreatureInSilenceZone,
    getSilencedTargets,
    addSilencedTarget,
    removeSilencedTargets,
} from './silenceService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

vi.mock('../combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
}));

const { executeHandler } = await import('../../automation/index.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
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

        it('returns the handler result for Silence spell', async () => {
            const handlerResult = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(handlerResult);

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toEqual(handlerResult);
        });

        it('returns null when executeHandler rejects', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
        });

        it('resolves spellSlotLevel from metaCtx slotLevel, spell.level, or defaults to 2', async () => {
            executeHandler.mockResolvedValue({ success: true });

            // metaCtx slotLevel takes precedence
            await triggerSilence({ name: 'Silence', level: 2 }, { slotLevel: 5 }, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(5);

            // falls back to spell.level
            await triggerSilence({ name: 'Silence', level: 4 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[1][0].spellSlotLevel).toBe(4);

            // defaults to 2 when neither is provided
            await triggerSilence({ name: 'Silence' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[2][0].spellSlotLevel).toBe(2);
        });

        it('parses range from spell.range string or defaults to 120', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, range: '60-foot' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[0][0].automation.range).toBe(60);

            await triggerSilence({ name: 'Silence', level: 2, range: 'invalid' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[1][0].automation.range).toBe(120);

            await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[2][0].automation.range).toBe(120);
        });

        it('parses aoe radius from area_of_effect.size or defaults to 20', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerSilence({ name: 'Silence', level: 2, area_of_effect: { size: '30-foot-radius' } }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[0][0].automation.aoeRadius).toBe(30);

            await triggerSilence({ name: 'Silence', level: 2, area_of_effect: { size: 'invalid' } }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[1][0].automation.aoeRadius).toBe(20);

            await triggerSilence({ name: 'Silence', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler.mock.calls[2][0].automation.aoeRadius).toBe(20);
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

        it('returns true when target is within or at boundary of radius', () => {
            // within radius
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockReturnValue(5);
            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(true);

            // at exact boundary
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 7, gridY: 5 }],
            });
            getDistanceFeet.mockReturnValue(10);
            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(true);

            // outside radius
            setupBase(true, { gridX: 5, gridY: 5 }, 5, {
                players: [],
                creatures: [{ name: 'Target', gridX: 10, gridY: 10 }],
            });
            getDistanceFeet.mockReturnValue(35);
            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(false);
        });

        it('uses default radius 20 when radius is falsy', () => {
            setupBase(true, { gridX: 5, gridY: 5 }, null, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign');
            expect(result).toBe(true);
        });

        it('finds target in players or creatures array', () => {
            // target in players array
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [{ name: 'Target', gridX: 6, gridY: 5 }],
                creatures: [],
            });
            getDistanceFeet.mockReturnValue(5);
            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(true);

            // target in creatures array
            setupBase(true, { gridX: 5, gridY: 5 }, 10, {
                players: [],
                creatures: [{ name: 'Target', gridX: 6, gridY: 5 }],
            });
            getDistanceFeet.mockReturnValue(5);
            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(true);
        });

        it('grants membership via silenced te from the caster (manual-picker model, no grid)', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'targetEffects') return [
                    { target: 'Target', effect: 'silenced', source: 'Caster', duration: 'concentration' },
                ];
                return undefined;
            });

            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(true);
        });

        it('does not grant te membership for a different caster or effect', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return null;
                if (key === 'targetEffects') return [
                    { target: 'Target', effect: 'silenced', source: 'OtherCaster', duration: 'concentration' },
                ];
                return undefined;
            });

            expect(isCreatureInSilenceZone('Target', 'Caster', 'TestCampaign')).toBe(false);
        });

        it('models the caster as standing at the zone center when no center is stored', () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'silenceCaster') return true;
                if (key === 'silenceCenter') return null;
                if (key === 'targetEffects') return [];
                return undefined;
            });

            expect(isCreatureInSilenceZone('Caster', 'Caster', 'TestCampaign')).toBe(true);
        });
    });

    describe('getSilencedTargets', () => {
        it('returns list of targets silenced by the specified caster', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Wizard', effect: 'silenced', source: 'OtherCaster' },
                { target: 'Goblin', effect: 'frightened', source: 'ClericBoy' },
            ]);

            const result = getSilencedTargets('ClericBoy', 'TestCampaign');
            expect(result).toEqual(['Goblin', 'Orc']);
        });

        it('returns empty array when no silenced targets', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'frightened', source: 'ClericBoy' },
            ]);

            const result = getSilencedTargets('ClericBoy', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('returns empty array when targetEffects is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getSilencedTargets('ClericBoy', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('returns empty array when targetEffects is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = getSilencedTargets('ClericBoy', 'TestCampaign');
            expect(result).toEqual([]);
        });

        it('filters only by effect and source', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Dragon', effect: 'silenced', source: 'WizardGirl' },
            ]);

            const result = getSilencedTargets('ClericBoy', 'TestCampaign');
            expect(result).toEqual(['Goblin', 'Orc']);
        });
    });

    describe('addSilencedTarget', () => {
        it('adds a new silenced target to targetEffects', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
            ]);

            addSilencedTarget('ClericBoy', 'Orc', 'TestCampaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
                    { target: 'Orc', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
                ],
                'TestCampaign',
            );
        });

        it('updates existing silenced target entry', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
            ]);

            addSilencedTarget('ClericBoy', 'Goblin', 'TestCampaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
                ],
                'TestCampaign',
            );
        });

        it('creates new array when targetEffects is null', () => {
            getRuntimeValue.mockReturnValue(null);

            addSilencedTarget('ClericBoy', 'Goblin', 'TestCampaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
                ],
                'TestCampaign',
            );
        });

        it('creates new array when targetEffects is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            addSilencedTarget('ClericBoy', 'Goblin', 'TestCampaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
                ],
                'TestCampaign',
            );
        });

        it('handles different sources correctly', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'WizardGirl' },
            ]);

            addSilencedTarget('ClericBoy', 'Goblin', 'TestCampaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'silenced', source: 'WizardGirl' },
                    { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
                ],
                'TestCampaign',
            );
        });
    });

    describe('removeSilencedTargets', () => {
        it('removes all silenced targets from the specified caster', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Wizard', effect: 'silenced', source: 'OtherCaster' },
            ]);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual(['Goblin', 'Orc']);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Wizard', effect: 'silenced', source: 'OtherCaster' },
                ],
                'TestCampaign',
            );
        });

        it('returns empty array when no silenced targets from caster', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'OtherCaster' },
            ]);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual([]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns all silenced targets when caster is the only one', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
                { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
            ]);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual(['Goblin', 'Orc']);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [],
                'TestCampaign',
            );
        });

        it('returns empty array when targetEffects is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual([]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns empty array when targetEffects is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual([]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not modify entries with different effect types', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'frightened', source: 'ClericBoy' },
                { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
            ]);

            const result = removeSilencedTargets('ClericBoy', 'TestCampaign');

            expect(result).toEqual(['Orc']);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [
                    { target: 'Goblin', effect: 'frightened', source: 'ClericBoy' },
                ],
                'TestCampaign',
            );
        });
    });
});
