import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

import { handle, getEffectOptions } from './blindnessDeafnessHandler.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const mapName = 'dungeon-level-1';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Blindness/Deafness',
        automation: { type: 'blindness_deafness', saveDc: 15, ...automation },
    };
}

// ─── getEffectOptions ───

describe('getEffectOptions', () => {
    it('returns the two effect options', () => {
        const options = getEffectOptions();
        expect(options).toHaveLength(2);
    });

    it('includes blinded option', () => {
        const options = getEffectOptions();
        const blinded = options.find(o => o.key === 'blinded');
        expect(blinded).toBeDefined();
        expect(blinded.label).toBe('Blinded');
        expect(blinded.condition).toBe('blinded');
    });

    it('includes deafened option', () => {
        const options = getEffectOptions();
        const deafened = options.find(o => o.key === 'deafened');
        expect(deafened).toBeDefined();
        expect(deafened.label).toBe('Deafened');
        expect(deafened.condition).toBe('deafened');
    });
});

// ─── handle ───

describe('blindnessDeafnessHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildSaveDc.mockReturnValue(15);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
            players: [{ name: casterName, gridX: 5, gridY: 10 }],
        });
        rangeToFeet.mockReturnValue(120);
        loadMapData.mockResolvedValue(null);
    });

    describe('return type', () => {
        it('returns a modal type result', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.type).toBe('modal');
        });

        it('sets modalName to blindnessDeafness', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.modalName).toBe('blindnessDeafness');
        });

        it('includes combatSummary in payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.combatSummary).toEqual({
                creatures: [{ name: 'Goblin' }],
                players: [{ name: casterName, gridX: 5, gridY: 10 }],
            });
        });

        it('includes attackerName in payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.attackerName).toBe(casterName);
        });

        it('includes campaignName in payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('includes featureName from action.name', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.featureName).toBe('Blindness/Deafness');
        });

        it('uses custom action name in featureName', async () => {
            const customAction = { name: 'My Blindness Spell', automation: { type: 'blindness_deafness' } };
            const result = await handle(customAction, makePlayerStats(), campaignName, null);
            expect(result.payload.featureName).toBe('My Blindness Spell');
        });
    });

    describe('saveDc', () => {
        it('includes saveDc from buildSaveDc in payload', async () => {
            buildSaveDc.mockReturnValue(16);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.saveDc).toBe(16);
        });

        it('logs error when saveDc is null', async () => {
            buildSaveDc.mockReturnValue(null);
            const spy = vi.spyOn(console, 'error');
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('Could not compute spell save DC'),
            );
            spy.mockRestore();
        });

        it('logs error when saveDc is 10 (default)', async () => {
            buildSaveDc.mockReturnValue(10);
            const spy = vi.spyOn(console, 'error');
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('Could not compute spell save DC'),
            );
            spy.mockRestore();
        });

        it('does not log error for valid saveDc', async () => {
            buildSaveDc.mockReturnValue(15);
            const spy = vi.spyOn(console, 'error');
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('rangeFeet', () => {
        it('defaults to 120 when rangeToFeet returns null', async () => {
            rangeToFeet.mockReturnValue(null);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.rangeFeet).toBe(120);
        });

        it('uses rangeToFeet result when available', async () => {
            rangeToFeet.mockReturnValue(60);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.rangeFeet).toBe(60);
        });

        it('uses rangeToFeet result for custom range', async () => {
            rangeToFeet.mockReturnValue(150);
            const action = makeAction({ range: '150ft' });
            const result = await handle(action, makePlayerStats(), campaignName, null);
            expect(result.payload.rangeFeet).toBe(150);
        });

        it('passes automation.range to rangeToFeet', async () => {
            rangeToFeet.mockReturnValue(120);
            const action = makeAction({ range: '120ft' });
            await handle(action, makePlayerStats(), campaignName, null);
            expect(rangeToFeet).toHaveBeenCalledWith('120ft');
        });
    });

    describe('attackerPos', () => {
        it('is null when no mapName is provided', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.attackerPos).toBeNull();
        });

        it('is null when mapName is empty string', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, '');
            expect(result.payload.attackerPos).toBeNull();
        });

        it('is null when map is loaded but caster not found in players', async () => {
            loadMapData.mockResolvedValue({
                players: [{ name: 'OtherPlayer', gridX: 3, gridY: 7 }],
            });
            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.attackerPos).toBeNull();
        });

        it('includes grid position when caster found on map', async () => {
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'OtherPlayer', gridX: 3, gridY: 7 },
                    { name: casterName, gridX: 10, gridY: 20 },
                ],
            });
            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.attackerPos).toEqual({ gridX: 10, gridY: 20 });
        });

        it('calls loadMapData with campaignName and mapName', async () => {
            loadMapData.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 10 }],
            });
            await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(loadMapData).toHaveBeenCalledWith(campaignName, mapName);
        });

        it('handles map loading failure gracefully', async () => {
            loadMapData.mockRejectedValue(new Error('map not found'));
            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.attackerPos).toBeNull();
            expect(result.payload.mapData).toBeNull();
        });
    });

    describe('mapData', () => {
        it('is null when no mapName is provided', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.mapData).toBeNull();
        });

        it('is null when map loading fails', async () => {
            loadMapData.mockRejectedValue(new Error('map not found'));
            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.mapData).toBeNull();
        });

        it('includes mapData when successfully loaded', async () => {
            const mockMapData = { name: mapName, players: [], tiles: [] };
            loadMapData.mockResolvedValue(mockMapData);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.mapData).toBe(mockMapData);
        });
    });

    describe('playerStats variations', () => {
        it('uses playerStats name as attackerName', async () => {
            const ps = makePlayerStats({ name: 'WizardGirl' });
            const result = await handle(makeAction(), ps, campaignName, null);
            expect(result.payload.attackerName).toBe('WizardGirl');
        });

        it('handles playerStats with minimal properties', async () => {
            const ps = { name: 'MinimalCaster' };
            const result = await handle(makeAction(), ps, campaignName, null);
            expect(result.payload.attackerName).toBe('MinimalCaster');
        });
    });

    describe('action variations', () => {
        it('throws when action has no automation property', async () => {
            buildSaveDc.mockReturnValue(10);
            await expect(
                handle({ name: 'Blindness/Deafness' }, makePlayerStats(), campaignName, null),
            ).rejects.toThrow();
        });

        it('uses custom automation type in action', async () => {
            const customAction = {
                name: 'Blindness/Deafness',
                automation: { type: 'blindness_deafness', saveDc: 14, range: '60ft' },
            };
            rangeToFeet.mockReturnValue(60);
            buildSaveDc.mockReturnValue(14);
            const result = await handle(customAction, makePlayerStats(), campaignName, null);
            expect(result.payload.saveDc).toBe(14);
            expect(result.payload.rangeFeet).toBe(60);
        });
    });

    describe('combat context', () => {
        it('passes campaignName to getCombatContext', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
        });

        it('includes whatever combat context the server returns', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', currentHp: 5, maxHp: 7 },
                    { name: 'Orc', currentHp: 15, maxHp: 22 },
                ],
                players: [{ name: casterName, gridX: 1, gridY: 2 }],
                placedItems: [{ name: 'Crate' }],
            });
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.combatSummary.creatures).toHaveLength(2);
            expect(result.payload.combatSummary.placedItems).toHaveLength(1);
        });
    });
});
