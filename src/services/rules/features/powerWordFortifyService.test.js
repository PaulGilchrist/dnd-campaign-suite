// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPowerWordFortify } from './powerWordFortifyService.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { rangeToFeet, getDistanceFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
    getDistanceFeet: vi.fn(),
}));

describe('powerWordFortifyService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const casterName = 'Wizard';

    const validSpell = {
        name: 'Power Word Fortify',
        level: 7,
        automation: {
            tempHpExpression: '8d8',
            maxTargets: 6,
            range: '60 feet',
        },
        range: '60 feet',
    };

    const combatSummary = {
        players: [{ name: casterName, gridX: 10, gridY: 10 }],
        creatures: [
            { name: 'Goblin', gridX: 12, gridY: 10 },
            { name: 'Orc', gridX: 15, gridY: 10 },
            { name: 'Troll', gridX: 25, gridY: 10 },
        ],
        placedItems: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerPowerWordFortify', () => {
        it('returns null for non-Power Word Fortify spells', async () => {
            const result = await triggerPowerWordFortify(
                { name: 'Fire Bolt', level: 0 },
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(getCombatContext).not.toHaveBeenCalled();
        });

        it('returns null when spell name is null', async () => {
            const result = await triggerPowerWordFortify(
                { level: 7 },
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerPowerWordFortify(
                {},
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('returns null when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(rollExpression).toHaveBeenCalledWith('8d8');
            expect(getCombatContext).not.toHaveBeenCalled();
        });

        it('returns null when getCombatContext resolves to null', async () => {
            rollExpression.mockReturnValue({ total: 32 });
            getCombatContext.mockResolvedValue(null);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('uses default tempHpExpression "120" when spell has no automation', async () => {
            rollExpression.mockReturnValue({ total: 120 });
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockReturnValue(0);

            const spell = { name: 'Power Word Fortify', level: 7 };

            const result = await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('120');
            expect(result).toEqual({
                targets: expect.any(Array),
                formula: '120',
                totalGranted: 120,
            });
        });

        it('uses default tempHpExpression "120" when automation exists but no tempHpExpression', async () => {
            rollExpression.mockReturnValue({ total: 120 });
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                name: 'Power Word Fortify',
                level: 7,
                automation: { maxTargets: 3 },
            };

            await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('120');
        });

        it('substitutes spellSlotLevel with spell.level when metaCtx has no slotLevel', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                name: 'Power Word Fortify',
                level: 5,
                automation: { tempHpExpression: '8d6+spellSlotLevel' },
            };

            await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('8d6+5');
        });

        it('substitutes spellSlotLevel with metaCtx slotLevel over spell.level', async () => {
            rollExpression.mockReturnValue({ total: 63 });
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                name: 'Power Word Fortify',
                level: 5,
                automation: { tempHpExpression: '9d7+spellSlotLevel' },
            };

            await triggerPowerWordFortify(
                spell,
                { slotLevel: 9 },
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('9d7+9');
        });

        it('falls back to default level 7 when no slotLevel and no spell.level', async () => {
            rollExpression.mockReturnValue({ total: 42 });
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                name: 'Power Word Fortify',
                automation: { tempHpExpression: '6d7+spellSlotLevel' },
            };

            await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('6d7+7');
        });

        it('returns {noTargets: true} when no creatures are within range', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue(combatSummary);
            rangeToFeet.mockReturnValue(10);
            getDistanceFeet.mockReturnValue(20);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(postLogEntry).not.toHaveBeenCalled();
        });

        it('returns {noTargets: true} when creatures array is empty', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 10, gridY: 10 }],
                creatures: [],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('grants temp HP to targets within range and excludes the caster', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'Goblin', gridX: 12, gridY: 10 },
                    { name: 'Orc', gridX: 15, gridY: 10 },
                    { name: 'Troll', gridX: 25, gridY: 10 },
                ],
                creatures: [
                    { name: 'Goblin' },
                    { name: 'Orc' },
                    { name: 'Troll' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 10);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
            expect(result.totalGranted).toBe(48);
            expect(result.formula).toBe('8d8');

            const targetNames = result.targets.map(t => t.targetName);
            expect(targetNames).not.toContain(casterName);
        });

        it('respects maxTargets limit from automation', async () => {
            rollExpression.mockReturnValue({ total: 200 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                    { name: 'C', gridX: 13, gridY: 10 },
                    { name: 'D', gridX: 14, gridY: 10 },
                    { name: 'E', gridX: 15, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                    { name: 'C' },
                    { name: 'D' },
                    { name: 'E' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(100);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                ...validSpell,
                automation: {
                    ...validSpell.automation,
                    maxTargets: 2,
                },
            };

            const result = await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(2);
        });

        it('distributes temp HP evenly when division is exact', async () => {
            rollExpression.mockReturnValue({ total: 10 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                    { name: 'C', gridX: 13, gridY: 10 },
                    { name: 'D', gridX: 14, gridY: 10 },
                    { name: 'E', gridX: 15, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                    { name: 'C' },
                    { name: 'D' },
                    { name: 'E' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            const amounts = result.targets.map(t => t.tempHpAmount);
            expect(amounts).toEqual([2, 2, 2, 2, 2]);
            expect(result.totalGranted).toBe(10);
        });

        it('distributes remainder one per target when division is not even', async () => {
            rollExpression.mockReturnValue({ total: 11 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                    { name: 'C', gridX: 13, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                    { name: 'C' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            const amounts = result.targets.map(t => t.tempHpAmount);
            expect(amounts).toEqual([4, 4, 3]);
            expect(result.totalGranted).toBe(11);
        });

        it('adds to existing temp HP on targets', async () => {
            rollExpression.mockReturnValue({ total: 12 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockImplementation((targetName) => (targetName === 'A' ? 5 : 0));

            await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            // 12 / 2 = 6 each, no remainder
            expect(setRuntimeValue).toHaveBeenCalledWith('A', 'tempHp', 11, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('B', 'tempHp', 6, campaignName);
        });

        it('targets are sorted by distance closest first', async () => {
            rollExpression.mockReturnValue({ total: 15 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'Far', gridX: 30, gridY: 10 },
                    { name: 'Near', gridX: 11, gridY: 10 },
                    { name: 'Mid', gridX: 20, gridY: 10 },
                ],
                creatures: [
                    { name: 'Far' },
                    { name: 'Near' },
                    { name: 'Mid' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(150);
            getDistanceFeet.mockImplementation((from, to) => {
                const dx = to.gridX - from.gridX;
                const dy = to.gridY - from.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            const names = result.targets.map(t => t.targetName);
            expect(names).toEqual(['Near', 'Mid', 'Far']);
        });

        it('uses grid positions from placedItems when creature name matches', async () => {
            rollExpression.mockReturnValue({ total: 15 });
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 10, gridY: 10 }],
                creatures: [{ name: 'Puppet', gridX: 99, gridY: 99 }],
                placedItems: [{ name: 'Puppet', gridX: 12, gridY: 10 }],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockReturnValue(10);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('Puppet');
        });

        it('filters out targets without grid positions', async () => {
            rollExpression.mockReturnValue({ total: 15 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'HasGrid', gridX: 12, gridY: 10 },
                ],
                creatures: [
                    { name: 'NoGrid' },
                    { name: 'HasGrid' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('HasGrid');
        });

        it('posts log entries with correct structure for each target', async () => {
            rollExpression.mockReturnValue({ total: 15 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(0);

            await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(postLogEntry).toHaveBeenCalledTimes(2);

            const firstLog = postLogEntry.mock.calls[0][1];
            expect(firstLog).toMatchObject({
                type: 'hp_change',
                targetName: 'A',
                delta: 8,
                isTempHp: true,
                sourceName: casterName,
                note: 'Power Word Fortify',
                formula: '8d8',
            });
            expect(firstLog).toHaveProperty('timestamp');

            const secondLog = postLogEntry.mock.calls[1][1];
            expect(secondLog).toMatchObject({
                type: 'hp_change',
                targetName: 'B',
                isTempHp: true,
                sourceName: casterName,
            });
        });

        it('uses spell.automation.range when available', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue(combatSummary);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(0);

            await triggerPowerWordFortify(
                {
                    ...validSpell,
                    automation: {
                        ...validSpell.automation,
                        range: '30 feet',
                    },
                    range: '60 feet',
                },
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        });

        it('falls back to spell.range when automation.range is absent', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue(combatSummary);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(0);

            await triggerPowerWordFortify(
                {
                    name: 'Power Word Fortify',
                    level: 7,
                    automation: { tempHpExpression: '6d8' },
                    range: '45 feet',
                },
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('45 feet');
        });

        it('targets all creatures without distance filtering when range is null', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue(combatSummary);
            rangeToFeet.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('targets all creatures when caster has no grid position', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue({
                players: [],
                creatures: [
                    { name: 'Goblin' },
                    { name: 'Orc' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: 'Wizard' },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(2);
        });

        it('uses default maxTargets of 6 when not specified in automation', async () => {
            rollExpression.mockReturnValue({ total: 100 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                    { name: 'B', gridX: 12, gridY: 10 },
                    { name: 'C', gridX: 13, gridY: 10 },
                    { name: 'D', gridX: 14, gridY: 10 },
                    { name: 'E', gridX: 15, gridY: 10 },
                    { name: 'F', gridX: 16, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                    { name: 'B' },
                    { name: 'C' },
                    { name: 'D' },
                    { name: 'E' },
                    { name: 'F' },
                    { name: 'G' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(100);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(0);

            const spell = {
                name: 'Power Word Fortify',
                level: 7,
                automation: { tempHpExpression: '10d10' },
            };

            const result = await triggerPowerWordFortify(
                spell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(6);
        });

        it('dispatches combat-summary-updated event on success', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'Goblin', gridX: 12, gridY: 10 },
                    { name: 'Orc', gridX: 15, gridY: 10 },
                    { name: 'Troll', gridX: 25, gridY: 10 },
                ],
                creatures: [
                    { name: 'Goblin' },
                    { name: 'Orc' },
                    { name: 'Troll' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 10);
            getRuntimeValue.mockReturnValue(0);

            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

            await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
            const event = dispatchEventSpy.mock.calls[0][0];
            expect(event.type).toBe('combat-summary-updated');

            dispatchEventSpy.mockRestore();
        });

        it('throws when creatures is null', async () => {
            rollExpression.mockReturnValue({ total: 48 });
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 10, gridY: 10 }],
                creatures: null,
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);

            await expect(triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            )).rejects.toThrow('Expected array, got null');
        });

        it('handles getRuntimeValue returning undefined as 0', async () => {
            rollExpression.mockReturnValue({ total: 12 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 11, gridY: 10 },
                ],
                creatures: [
                    { name: 'A' },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 5);
            getRuntimeValue.mockReturnValue(undefined);

            await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('A', 'tempHp', 12, campaignName);
        });

        it('handles metaCtx being null', async () => {
            rollExpression.mockReturnValue({ total: 42 });
            getCombatContext.mockResolvedValue(combatSummary);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(0);

            await triggerPowerWordFortify(
                validSpell,
                null,
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('8d8');
        });

        it('returns result with correct structure on success', async () => {
            rollExpression.mockReturnValue({ total: 24 });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: casterName, gridX: 10, gridY: 10 },
                    { name: 'A', gridX: 12, gridY: 10 },
                ],
                creatures: [{ name: 'A' }],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(60);
            getDistanceFeet.mockImplementation(() => 10);
            getRuntimeValue.mockReturnValue(0);

            const result = await triggerPowerWordFortify(
                validSpell,
                {},
                { name: casterName },
                campaignName,
                mapName,
            );

            expect(result).toHaveProperty('targets');
            expect(result).toHaveProperty('formula', '8d8');
            expect(result).toHaveProperty('totalGranted', 24);
            expect(Array.isArray(result.targets)).toBe(true);
            expect(result.targets[0]).toHaveProperty('targetName', 'A');
            expect(result.targets[0]).toHaveProperty('tempHpAmount', 24);
        });
    });
});
