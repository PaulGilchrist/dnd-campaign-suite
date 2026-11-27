// @maintained-by-ai 2026-11-26
// CLA-384: the confirm leg was unreachable dead code — locked contract is now
// resource spend (uses OR 5 SP restore) + teleport te marker + refusal logs.
// Modal payload and log descriptions are pinned full-shape; Date.now is frozen so
// refusal/ability_use timestamps are deterministic. Damage/save formula legs are
// owned by the modal + applyDamage lanes, not this handler.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, applyWarpingImplosion } from './warpingImplosionHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import { addEntry } from '../../../ui/logService.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as classFeatures from '../../../../services/character/classFeatures.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
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
const FROZEN_NOW = 1_700_000_000_000;

// Caster teleport marker (instant, 120 ft) registered on every successful commit.
const TELEPORT_MARKER_ARGS = [
    campaignName,
    playerName,
    'warping_implosion_teleport',
    'Warping Implosion',
    { duration: 'instant', value: 120 },
];

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

const makePlayerStats = () => ({
    name: playerName,
    level: 18,
    proficiencyBonus: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
});

const expectNothingSpent = () => {
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(metamagic.spendSorceryPoints.mock.calls).toEqual([]);
};

describe('warpingImplosionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        metamagic.getCurrentSorceryPoints.mockReturnValue(10);
        metamagic.spendSorceryPoints.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        savePrompt.buildSaveDc.mockReturnValue(13);
        mapsService.loadMapData.mockResolvedValue(null);
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });
        rangeValidation.rangeToFeet.mockReturnValue(undefined);
        getCombatContext.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handle', () => {
        it('opens the chooser with the exact payload and spends nothing at picker-open', async () => {
            runtimeState.getRuntimeValue.mockImplementation((name, key) =>
                key === 'aquaticAffinityEmanationRange' ? null : 1
            );
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName, null);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warpingImplosion',
                payload: {
                    action,
                    playerStats,
                    campaignName,
                    mapData: null,
                    attackerPos: null,
                    saveDc: 13,
                    saveType: 'STR',
                    shape: 'emanation_30ft',
                    rangeFeet: 30,
                    damageExpression: '3d10',
                    damageType: 'Force',
                    teleportRange: 120,
                    canRestore: true,
                    restoreCost: 5,
                    hasRemaining: true,
                },
            });
            expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(playerStats);
            expect(metamagic.getCurrentSorceryPoints).toHaveBeenCalledWith(playerName, 20);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, 'warpingImplosionUses', campaignName);
            expectNothingSpent();
        });

        it.each([
            {
                label: 'uses exhausted but restore affordable -> modal',
                uses: 0, sp: 10, type: 'modal', hasRemaining: false, canRestore: true,
            },
            {
                label: 'null runtime uses defaults to max -> modal',
                uses: null, sp: 10, type: 'modal', hasRemaining: true, canRestore: true,
            },
            {
                label: 'NaN runtime uses treated as exhausted -> modal via restore',
                uses: NaN, sp: 10, type: 'modal', hasRemaining: false, canRestore: true,
            },
            {
                label: 'custom restoreCost affordable flips canRestore',
                uses: 0, sp: 4, restoreCost: 3, type: 'modal', hasRemaining: false, canRestore: true,
            },
            {
                label: 'missing class features derives maxSP 0 (no crash)',
                uses: 1, sp: 10, features: null, maxSP: 0, type: 'modal', hasRemaining: true, canRestore: true,
            },
            {
                label: 'uses exhausted and restore unaffordable -> refusal popup',
                uses: 0, sp: 2, type: 'popup',
            },
            {
                label: 'custom restoreCost unaffordable -> refusal popup',
                uses: 0, sp: 2, restoreCost: 3, type: 'popup',
            },
        ])('$label', async ({ uses, sp, restoreCost, features, maxSP, type, hasRemaining, canRestore }) => {
            runtimeState.getRuntimeValue.mockReturnValue(uses);
            metamagic.getCurrentSorceryPoints.mockReturnValue(sp);
            if (features !== undefined) {
                classFeatures.getClassFeatures.mockReturnValue(features);
            }
            const action = restoreCost ? makeAction({ automation: { restoreCost } }) : makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe(type);
            expect(metamagic.getCurrentSorceryPoints).toHaveBeenCalledWith(playerName, maxSP ?? 20);
            if (type === 'modal') {
                expect(result.payload.hasRemaining).toBe(hasRemaining);
                expect(result.payload.canRestore).toBe(canRestore);
                expect(result.payload.restoreCost).toBe(restoreCost ?? 5);
            } else {
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Warping Implosion',
                        description: 'Warping Implosion: No remaining uses and cannot restore with Sorcery Points. Finish a Long Rest to regain.',
                        automation: action.automation,
                    },
                    logEntries: [{
                        type: 'automation',
                        automationType: 'warping_implosion_refused',
                        characterName: playerName,
                        name: 'Warping Implosion',
                        description: 'Warping Implosion refused — no remaining uses and not enough Sorcery Points to restore. Nothing spent.',
                        timestamp: FROZEN_NOW,
                    }],
                });
            }
            expectNothingSpent();
        });

        it.each([
            { label: 'rangeToFeet wins when truthy', shape: 'sphere_20ft', feet: 60, aquatic: null, expected: 60 },
            { label: 'rangeToFeet falsy: emanation_30ft fallback', shape: 'emanation_30ft', feet: undefined, aquatic: null, expected: 30 },
            { label: 'rangeToFeet falsy: unknown shape falls back to 10', shape: 'unknown_shape', feet: undefined, aquatic: null, expected: 10 },
            { label: 'aquaticAffinity range overrides fallback', shape: 'emanation_30ft', feet: undefined, aquatic: '60', expected: 60 },
            { label: 'unparseable aquaticAffinity falls back', shape: 'unknown_shape', feet: undefined, aquatic: 'abc', expected: 10 },
        ])('range resolution: $label', async ({ shape, feet, aquatic, expected }) => {
            rangeValidation.rangeToFeet.mockReturnValue(feet);
            if (aquatic != null) {
                runtimeState.getRuntimeValue.mockImplementation((name, key) =>
                    key === 'aquaticAffinityEmanationRange' ? aquatic : 1
                );
            }

            const result = await handle(makeAction({ automation: { shape } }), makePlayerStats(), campaignName, null);

            expect(result.payload.rangeFeet).toBe(expected);
        });

        it.each([
            {
                label: 'map loads: mapData and attackerPos flow into payload',
                load: () => Promise.resolve({ tiles: [] }),
                expectMapData: { tiles: [] },
                expectPos: { gridX: 0, gridY: 0 },
            },
            {
                label: 'map load rejects: mapData null, still confirmable',
                load: () => Promise.reject(new Error('map not found')),
                expectMapData: null,
                expectPos: { gridX: 0, gridY: 0 },
            },
        ])('map lane: $label', async ({ load, expectMapData, expectPos }) => {
            getCombatContext.mockResolvedValue({ attacker: {} });
            mapsService.loadMapData.mockImplementation(load);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battlemap');

            expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, 'battlemap');
            expect(result.payload.mapData).toEqual(expectMapData);
            expect(result.payload.attackerPos).toEqual(expectPos);
        });
    });

    describe('applyWarpingImplosion', () => {
        it.each([
            {
                label: 'no uses remaining without restore',
                restore: false, uses: 0, sp: 10,
                description: 'Warping Implosion: No remaining uses. Restore with 5 Sorcery Points or finish a Long Rest. Nothing spent.',
                logDescription: 'Warping Implosion refused — no remaining uses. Nothing spent.',
            },
            {
                label: 'not enough SP to restore',
                restore: true, uses: 0, sp: 2,
                description: 'Not enough Sorcery Points to restore Warping Implosion. Need 5 SP, you have 2. Nothing spent.',
                logDescription: 'Warping Implosion refused — 2 Sorcery Points is not enough to restore (needs 5). Nothing spent.',
            },
            {
                label: 'custom restoreCost unaffordable',
                restore: true, uses: 0, sp: 2, restoreCost: 3,
                description: 'Not enough Sorcery Points to restore Warping Implosion. Need 3 SP, you have 2. Nothing spent.',
                logDescription: 'Warping Implosion refused — 2 Sorcery Points is not enough to restore (needs 3). Nothing spent.',
            },
        ])('refuses with full-shape popup + refused log, spending nothing: $label', async ({ restore, uses, sp, restoreCost, description, logDescription }) => {
            runtimeState.getRuntimeValue.mockReturnValue(uses);
            metamagic.getCurrentSorceryPoints.mockReturnValue(sp);
            const action = restoreCost ? makeAction({ automation: { restoreCost } }) : makeAction();

            const result = await applyWarpingImplosion(action, makePlayerStats(), campaignName, restore);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Warping Implosion',
                    description,
                    automation: action.automation,
                },
                logEntries: [{
                    type: 'automation',
                    automationType: 'warping_implosion_refused',
                    characterName: playerName,
                    name: 'Warping Implosion',
                    description: logDescription,
                    timestamp: FROZEN_NOW,
                }],
            });
            expectNothingSpent();
            expect(teDefs.registerTargetEffect.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it.each([
            { label: 'default restoreCost 5', restoreCost: undefined, spent: 5 },
            { label: 'custom restoreCost honoured', restoreCost: 3, spent: 3 },
        ])('restore leg spends $spent SP, marks teleport, logs the restore: $label', async ({ restoreCost, spent }) => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);
            const action = restoreCost ? makeAction({ automation: { restoreCost } }) : makeAction();

            const result = await applyWarpingImplosion(action, makePlayerStats(), campaignName, true);

            expect(result).toEqual({ type: 'confirmed', restored: true });
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledTimes(1);
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, spent, campaignName, 20);
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(...TELEPORT_MARKER_ARGS);
            expect(addEntry.mock.calls[0][1].description).toContain(`Restored with ${spent} Sorcery Points.`);
        });

        it.each([
            { label: 'derived default key', resourceKey: undefined, expectedKey: 'warpingImplosionUses' },
            { label: 'explicit resourceKey override', resourceKey: 'customImplosionUses', expectedKey: 'customImplosionUses' },
        ])('uses leg reads and decrements $expectedKey exactly once: $label', async ({ resourceKey, expectedKey }) => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const action = resourceKey ? makeAction({ automation: { resourceKey } }) : makeAction();

            const result = await applyWarpingImplosion(action, makePlayerStats(), campaignName, false);

            expect(result).toEqual({ type: 'confirmed', restored: false });
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, expectedKey, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, expectedKey, 0, campaignName);
            expect(metamagic.spendSorceryPoints.mock.calls).toEqual([]);
            expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(...TELEPORT_MARKER_ARGS);
        });

        it('logs one full-shape ability_use entry with teleport, save, pull and darkness details', async () => {
            await applyWarpingImplosion(makeAction(), makePlayerStats(), campaignName, false);

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Warping Implosion',
                description: 'TestHero used Warping Implosion: teleported to an unoccupied space within 120 feet. Creatures within 30 feet of the space left make a STR save (DC 13) or take 3d10 Force damage, pulled toward that space. Magical Darkness in the area is dispelled.',
                timestamp: FROZEN_NOW,
            });
        });

        it.each([
            { label: 'sphere_15ft is an area shape', shape: 'sphere_15ft', dark: true },
            { label: 'shape casing is tolerated', shape: 'Emanation_30ft', dark: true },
            { label: 'single_target is not an area shape', shape: 'single_target', dark: false },
            { label: 'cone is not an area shape', shape: 'cone_90ft', dark: false },
        ])('darkness dispelled note for area shapes only: $label', async ({ shape, dark }) => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await applyWarpingImplosion(makeAction({ automation: { shape } }), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('confirmed');
            const description = addEntry.mock.calls[0][1].description;
            if (dark) {
                expect(description).toContain('Magical Darkness in the area is dispelled.');
            } else {
                expect(description).not.toContain('Magical Darkness');
            }
        });
    });
});
