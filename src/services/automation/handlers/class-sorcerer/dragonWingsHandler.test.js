// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isActive, deactivate } from './dragonWingsHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'Test Character';
const usesKey = 'testcharacter_dragonWingsUses';
const activeKey = 'testcharacter_dragonWingsActive';

function makeAction(overrides = {}) {
    return {
        name: 'Dragon Wings',
        automation: {
            type: 'dragon_wings',
            action: 'bonus_action',
            duration: '1_hour',
            flySpeed: 60,
            hover: true,
            uses: 1,
            recharge: 'long_rest',
            resourceCost: 'sorcery_points',
            restoreCost: 3,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 14,
        class: {
            name: 'Sorcerer',
            class_levels: [{ level: 14 }],
        },
        resources: {
            sorcery_points: { current: 10 },
        },
        ...overrides,
    };
}

function mockRuntimeGet(mapping) {
    runtimeState.getRuntimeValue.mockImplementation((_name, storedKey, _campaign) => {
        return mapping[storedKey] ?? null;
    });
}

describe('dragonWingsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        describe('activation', () => {
            it('returns popup with activated description and fly speed info', async () => {
                mockRuntimeGet({ [usesKey]: 1 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Dragon Wings');
                expect(result.payload.description).toContain('activated');
                expect(result.payload.description).toContain('Fly Speed 60');
            });

            it('sets activeBuffs with dragon_wings effect on activation', async () => {
                mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    activeKey,
                    true,
                    campaignName,
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Dragon Wings',
                            effect: 'dragon_wings',
                            flySpeed: 60,
                            hover: true,
                        }),
                    ]),
                    campaignName,
                );
            });

            it('adds campaign log entry on activation', async () => {
                mockRuntimeGet({ [usesKey]: 1 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Dragon Wings',
                }));
            });

            it('uses custom feature name in popup and buff entry', async () => {
                mockRuntimeGet({ [usesKey]: 1 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
                const action = makeAction({ name: 'Custom Wings' });

                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.name).toBe('Custom Wings');
                expect(result.payload.description).toContain('Custom Wings');
            });

            it('uses custom duration from automation in description', async () => {
                mockRuntimeGet({ [usesKey]: 1 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
                const action = makeAction({ automation: { duration: '10_minutes' } });

                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('10_minutes');
            });

            it('uses custom flySpeed from automation in buff entry', async () => {
                mockRuntimeGet({ [usesKey]: 1 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
                const action = makeAction({ automation: { flySpeed: 90 } });

                await handle(action, makePlayerStats(), campaignName, null);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ flySpeed: 90 }),
                    ]),
                    campaignName,
                );
            });
        });

        describe('deactivation', () => {
            it('returns popup with deactivated description when already active', async () => {
                mockRuntimeGet({
                    [usesKey]: 1,
                    activeBuffs: [{ name: 'Dragon Wings', effect: 'dragon_wings' }],
                });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('deactivated');
            });

            it('removes only the matching buff from activeBuffs during deactivation', async () => {
                mockRuntimeGet({
                    [usesKey]: 1,
                    activeBuffs: [
                        { name: 'Dragon Wings', effect: 'dragon_wings' },
                        { name: 'Other Buff', effect: 'other' },
                    ],
                });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Other Buff' }),
                    ]),
                    campaignName,
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.not.arrayContaining([
                        expect.objectContaining({ name: 'Dragon Wings' }),
                    ]),
                    campaignName,
                );
            });

            it('adds campaign log entry on deactivation', async () => {
                mockRuntimeGet({
                    [usesKey]: 1,
                    activeBuffs: [{ name: 'Dragon Wings', effect: 'dragon_wings' }],
                });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Dragon Wings',
                    description: 'Dragon Wings deactivated.',
                }));
            });
        });

        describe('restoration', () => {
            it('restores dragon wings by spending sorcery points when uses are 0', async () => {
                mockRuntimeGet({ [usesKey]: 0 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('restored');
                expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
                    playerName,
                    3,
                    campaignName,
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    usesKey,
                    1,
                    campaignName,
                );
            });

            it('uses custom restoreCost from automation config', async () => {
                mockRuntimeGet({ [usesKey]: 0 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
                const stats = makePlayerStats({ resources: { sorcery_points: { current: 10 } } });
                const action = makeAction({ automation: { restoreCost: 5 } });

                await handle(action, stats, campaignName, null);

                expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
                    playerName,
                    5,
                    campaignName,
                );
            });

            it('returns error popup when no uses remaining and insufficient sorcery points', async () => {
                mockRuntimeGet({ [usesKey]: 0 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
                const stats = makePlayerStats({ resources: { sorcery_points: { current: 1 } } });

                const result = await handle(makeAction(), stats, campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('no uses remaining');
                expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            });

            it('returns error popup with custom feature name when no uses remaining', async () => {
                mockRuntimeGet({ [usesKey]: 0 });
                classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
                const stats = makePlayerStats({ resources: { sorcery_points: { current: 1 } } });
                const action = makeAction({ name: 'Custom Wings' });

                const result = await handle(action, stats, campaignName, null);

                expect(result.payload.name).toBe('Custom Wings');
                expect(result.payload.description).toContain('no uses remaining');
            });
        });
    });

    describe('isActive', () => {
        it('returns true when runtime value is true', () => {
            mockRuntimeGet({ [activeKey]: true });
            expect(isActive(playerName)).toBe(true);
        });

        it('returns false when runtime value is false', () => {
            mockRuntimeGet({ [activeKey]: false });
            expect(isActive(playerName)).toBe(false);
        });

        it('returns false when runtime value is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            expect(isActive(playerName)).toBe(false);
        });

        it('returns false for non-boolean truthy values', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            expect(isActive(playerName)).toBe(false);
        });
    });

    describe('deactivate', () => {
        it('sets runtime value to false for the player', () => {
            deactivate(playerName, campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                false,
                campaignName,
            );
        });
    });
});
