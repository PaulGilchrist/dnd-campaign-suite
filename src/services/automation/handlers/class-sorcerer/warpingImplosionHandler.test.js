// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyWarpingImplosion } from './warpingImplosionHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logService from '../../../ui/logService.js';
import * as savePrompt from '../../common/savePrompt.js';

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    getCurrentSorceryPoints: vi.fn(),
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

const makeAction = (overrides = {}) => ({
    name: 'Warping Implosion',
    automation: {
        action: 'action',
        casting_time: '1 action',
        damage: '3d10',
        damageType: 'Force',
        saveType: 'STR',
        saveDc: 'ability',
        saveAbility: 'CHA',
        shape: 'emanation_30ft',
        range: '30_ft',
        uses: 1,
        recharge: 'long_rest',
        resourceCost: 'sorcery_points',
        restoreCost: 5,
        hasOptions: true,
        optionDetails: {},
        ...overrides.automation,
    },
    ...overrides,
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    level: 18,
    proficiencyBonus: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    ...overrides,
});

describe('warpingImplosionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 27, rolls: [10, 10, 7], modifier: 0 });
        runtimeState.getRuntimeValue.mockReturnValue(1);
        metamagic.getCurrentSorceryPoints.mockReturnValue(10);
        metamagic.spendSorceryPoints.mockReturnValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        savePrompt.buildSaveDc.mockReturnValue(14);
    });

    describe('handle', () => {
        it('returns modal with correct payload for normal use', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('warpingImplosion');
            expect(result.payload.saveType).toBe('STR');
            expect(result.payload.saveDc).toBe(14);
            expect(result.payload.damageType).toBe('Force');
            expect(result.payload.teleportRange).toBe(120);
            expect(result.payload.canRestore).toBe(true);
            expect(result.payload.hasRemaining).toBe(true);
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('TestCampaign');
        });

        it('returns modal with range resolved from shape string when rangeToFeet returns null', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.mocked(diceRoller.rollExpression).mockReturnValue({ total: 27, rolls: [10, 10, 7], modifier: 0 });

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.payload.rangeFeet).toBe(30);
        });

        it('returns modal with range 10 as fallback for unknown shape', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { shape: 'unknown_shape' } });

            const result = await handle(action, makePlayerStats(), 'TestCampaign', null);

            expect(result.payload.rangeFeet).toBe(10);
        });

        it('returns modal with aquaticAffinity range override when available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'aquaticAffinityEmanationRange') return '60';
                return 1;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.payload.rangeFeet).toBe(60);
        });

        it('returns popup when no uses and cannot restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No remaining uses');
            expect(result.payload.description).toContain('cannot restore');
        });

        it('returns modal when no uses but can restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.canRestore).toBe(true);
            expect(result.payload.hasRemaining).toBe(false);
        });

        it('respects custom restoreCost from automation', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(4);
            const action = makeAction({ automation: { restoreCost: 5 } });

            const result = await handle(action, makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('popup');
        });

        it('defaults to max uses when no runtime value exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.hasRemaining).toBe(true);
        });

        it('includes mapData and attackerPos in payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'battlemap');

            expect(result.payload.mapData).toBeNull();
            expect(result.payload.attackerPos).toBeNull();
        });

        it('returns modal with custom restoreCost in payload', async () => {
            const action = makeAction({ automation: { restoreCost: 3 } });

            const result = await handle(action, makePlayerStats(), 'TestCampaign', null);

            expect(result.payload.restoreCost).toBe(3);
        });
    });

    describe('applyWarpingImplosion', () => {
        it('returns popup when no uses remaining and not restoring', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No remaining uses');
        });

        it('returns popup when not enough sorcery points to restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                true
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
        });

        it('spends sorcery points when restoring successfully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                true
            );

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
                'TestHero',
                5,
                'TestCampaign'
            );
        });

        it('decrements uses when not restoring', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'warpingimplosionUses',
                0,
                'TestCampaign'
            );
        });

        it('returns roll result with damage data', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.type).toBe('roll');
            expect(result.payload.rollType).toBe('damage');
            expect(result.payload.name).toBe('Warping Implosion');
            expect(result.payload.formula).toBe('3d10');
            expect(result.payload.total).toBe(27);
            expect(result.payload.rolls).toEqual([10, 10, 7]);
            expect(result.payload.modifier).toBe(0);
        });

        it('includes save configuration and notes in roll payload', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            savePrompt.buildSaveDc.mockReturnValue(15);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.contextConfig.damageType).toBe('Force');
            expect(result.payload.contextConfig.saveDc).toBe(15);
            expect(result.payload.contextConfig.saveType).toBe('STR');
            expect(result.payload.contextConfig.attackerName).toBe('TestHero');
            expect(result.payload.notes).toContain('Teleported to an unoccupied space within 120 feet');
            expect(result.payload.notes).toContain('30 feet');
            expect(result.payload.notes).toContain('STR saving throw');
            expect(result.payload.notes).toContain('DC 15');
            expect(result.payload.notes).toContain('27 Force damage');
        });

        it('adds campaign log entry for ability use', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Warping Implosion',
                timestamp: expect.any(Number),
            }));
        });

        it('includes restored note when using sorcery points', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                true
            );

            expect(result.payload.notes).toContain('Restored with 5 Sorcery Points');
        });

        it('dispels magical darkness when shape is an area shape', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { shape: 'sphere' } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.notes).toContain('Magical Darkness in the area is dispelled');
        });

        it('does not dispel darkness for non-area shapes', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { shape: 'single_target' } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.notes).not.toContain('Magical Darkness');
        });

        it('handles null damage result gracefully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await applyWarpingImplosion(
                makeAction(),
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.total).toBe(0);
            expect(result.payload.rolls).toEqual([]);
            expect(result.payload.modifier).toBe(0);
        });

        it('uses default damage expression when automation lacks damage', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { damage: undefined } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.formula).toBe('3d10');
        });

        it('uses custom action name when provided', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ name: 'Custom Warping Implosion' });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.name).toBe('Custom Warping Implosion');
            expect(result.payload.contextConfig.attackerName).toBe('TestHero');
        });

        it('uses default restoreCost of 5 when not specified', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);
            const action = makeAction({ automation: { restoreCost: undefined } });

            await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                true
            );

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
                'TestHero',
                5,
                'TestCampaign'
            );
        });

        it('uses custom saveType from automation', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: 'DEX' } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.contextConfig.saveType).toBe('DEX');
        });

        it('defaults saveType to STR when not specified', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { saveType: undefined } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.contextConfig.saveType).toBe('STR');
        });

        it('defaults damageType to Force when not specified', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { damageType: undefined } });

            const result = await applyWarpingImplosion(
                action,
                makePlayerStats(),
                'TestCampaign',
                [],
                { gridX: 5, gridY: 5 },
                false
            );

            expect(result.payload.contextConfig.damageType).toBe('Force');
        });
    });
});
