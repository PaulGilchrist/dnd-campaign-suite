// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// CLA-384: the confirm leg was unreachable dead code — locked contract is now
// resource spend (uses OR 5 SP restore) + teleport te marker + refusal logs.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyWarpingImplosion } from './warpingImplosionHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import { addEntry } from '../../../ui/logService.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as classFeatures from '../../../../services/character/classFeatures.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as teDefs from '../../../combat/conditions/targetEffectDefinitions.js';

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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getEffectDefinition: vi.fn(),
}));

const campaignName = 'TestCampaign';
const playerName = 'TestHero';

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
    name: playerName,
    level: 18,
    proficiencyBonus: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    ...overrides,
});

describe('warpingImplosionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        metamagic.getCurrentSorceryPoints.mockReturnValue(10);
        metamagic.spendSorceryPoints.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        savePrompt.buildSaveDc.mockReturnValue(13);
        mapsService.loadMapData.mockResolvedValue(null);
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });
        rangeValidation.rangeToFeet.mockReturnValue(undefined);
    });

    describe('handle', () => {
        it('returns modal with correct payload for normal use', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('warpingImplosion');
            expect(result.payload.saveType).toBe('STR');
            expect(result.payload.saveDc).toBe(13);
            expect(result.payload.damageType).toBe('Force');
            expect(result.payload.damageExpression).toBe('3d10');
            expect(result.payload.shape).toBe('emanation_30ft');
            expect(result.payload.teleportRange).toBe(120);
            expect(result.payload.restoreCost).toBe(5);
            expect(result.payload.canRestore).toBe(true);
            expect(result.payload.hasRemaining).toBe(true);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('opens the chooser WITHOUT consuming the use at picker-open', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('refuses with popup + warping_implosion_refused log when no uses and cannot restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No remaining uses');
            expect(result.payload.description).toContain('cannot restore');
            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0]).toEqual(expect.objectContaining({
                type: 'automation',
                automationType: 'warping_implosion_refused',
                characterName: playerName,
            }));
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('returns modal when no uses but can restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.canRestore).toBe(true);
            expect(result.payload.hasRemaining).toBe(false);
        });

        it('defaults to max uses when runtime value is null or NaN', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.type).toBe('modal');
            expect(result.payload.hasRemaining).toBe(true);

            runtimeState.getRuntimeValue.mockReturnValue(NaN);
            result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.payload.hasRemaining).toBe(false);
        });

        it('returns modal with range resolved from shape string when rangeToFeet is falsy', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.rangeFeet).toBe(30);
        });

        it('returns modal with range 10 as fallback for unknown shape', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { shape: 'unknown_shape' } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.rangeFeet).toBe(10);
        });

        it('returns modal with aquaticAffinity range override when available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'aquaticAffinityEmanationRange') return '60';
                return 1;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.rangeFeet).toBe(60);
        });

        it('includes mapData and attackerPos in payload when no map provided', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.mapData).toBeNull();
            expect(result.payload.attackerPos).toBeNull();
        });

        it('includes mapData and attackerPos when mapName is provided', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ attacker: {} });
            mapsService.loadMapData.mockResolvedValue({ tiles: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battlemap');

            expect(result.payload.mapData).toEqual({ tiles: [] });
            expect(result.payload.attackerPos).toEqual({ gridX: 0, gridY: 0 });
        });

        it('handles map loading failure gracefully', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ attacker: {} });
            mapsService.loadMapData.mockRejectedValue(new Error('map not found'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battlemap');

            expect(result.payload.mapData).toBeNull();
            expect(result.payload.attackerPos).toEqual({ gridX: 0, gridY: 0 });
        });

        it('uses custom restoreCost in payload', async () => {
            const action = makeAction({ automation: { restoreCost: 3 } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.restoreCost).toBe(3);
        });

        it('uses custom resourceKey for uses tracking', async () => {
            const action = makeAction({ automation: { resourceKey: 'customUses' } });
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.hasRemaining).toBe(true);
        });

        it('handles null getClassFeatures without crashing', async () => {
            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.canRestore).toBe(true);
        });

        it('handles negative currentUses with canRestore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(-1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.hasRemaining).toBe(false);
        });
    });

    describe('applyWarpingImplosion', () => {
        it('refuses with popup + refused log when no uses remaining and not restoring', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No remaining uses');
            expect(result.logEntries[0].automationType).toBe('warping_implosion_refused');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(teDefs.registerTargetEffect).not.toHaveBeenCalled();
        });

        it('refuses with popup + refused log when not enough sorcery points to restore', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sorcery Points');
            expect(result.logEntries[0].automationType).toBe('warping_implosion_refused');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(teDefs.registerTargetEffect).not.toHaveBeenCalled();
        });

        it('spends 5 sorcery points and writes the teleport marker when restoring', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, true);

            expect(result.type).toBe('confirmed');
            expect(result.restored).toBe(true);
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName, 20);
            expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(
                campaignName,
                playerName,
                'warping_implosion_teleport',
                'Warping Implosion',
                expect.objectContaining({ duration: 'instant', value: 120 })
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('decrements uses when not restoring and writes the teleport marker', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('confirmed');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'warpingimplosionUses', 0, campaignName);
            expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(
                campaignName,
                playerName,
                'warping_implosion_teleport',
                'Warping Implosion',
                expect.objectContaining({ duration: 'instant', value: 120 })
            );
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('uses custom resourceKey for uses tracking', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { resourceKey: 'customImplosionUses' } });

            await applyWarpingImplosion(action, makePlayerStats(), campaignName, false);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'customImplosionUses', 0, campaignName);
        });

        it('respects custom restoreCost when spending SP', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);
            const action = makeAction({ automation: { restoreCost: 3 } });

            await applyWarpingImplosion(action, makePlayerStats(), campaignName, true);

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 3, campaignName, 20);
        });

        it('logs an ability_use entry with teleport, save and pull details', async () => {
            runtimeState.getRuntimeValue.mockImplementation((name, key) => (key === 'warpingimplosionUses' ? 1 : null));

            await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, false);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Warping Implosion',
                timestamp: expect.any(Number),
            }));
            const description = addEntry.mock.calls[0][1].description;
            expect(description).toContain('teleported to an unoccupied space within 120 feet');
            expect(description).toContain('30 feet');
            expect(description).toContain('STR');
            expect(description).toContain('DC 13');
            expect(description).toContain('pulled toward');
        });

        it('notes the SP restore in the ability_use log', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, true);

            const description = addEntry.mock.calls[0][1].description;
            expect(description).toContain('Restored with 5 Sorcery Points');
        });

        it('notes magical darkness dispelled for area shapes only', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            let result = null;
            await applyWarpingImplosion(makeAction({ automation: { shape: 'sphere' } }), makePlayerStats(), campaignName, false);
            expect(addEntry.mock.calls[0][1].description).toContain('Magical Darkness in the area is dispelled');

            addEntry.mockClear();
            result = await applyWarpingImplosion(makeAction({ automation: { shape: 'single_target' } }), makePlayerStats(), campaignName, false);
            expect(result.type).toBe('confirmed');
            expect(addEntry.mock.calls[0][1].description).not.toContain('Magical Darkness');
        });
    });
});
