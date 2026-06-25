// @improved-by-ai
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
        it('activates dragon wings and returns popup with fly speed info', async () => {
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

        it('deactivates dragon wings when already in activeBuffs', async () => {
            mockRuntimeGet({
                [usesKey]: 1,
                activeBuffs: [{ name: 'Dragon Wings', effect: 'dragon_wings' }],
            });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('deactivated');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [],
                campaignName,
            );
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

        it('restores dragon wings by spending sorcery points when uses are 0', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 10 } } });

            const result = await handle(makeAction(), stats, campaignName, null);

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

        it('returns error popup when no uses remaining and insufficient sorcery points', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 1 } } });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('uses restoreCost from automation config', async () => {
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

        it('uses default restoreCost of 3 when not specified in automation', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 10 } } });
            const action = makeAction({ automation: { restoreCost: undefined } });

            await handle(action, stats, campaignName, null);

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
                playerName,
                3,
                campaignName,
            );
        });

        it('uses default uses of 1 when not specified in automation', async () => {
            mockRuntimeGet({});

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const action = makeAction({ automation: { uses: undefined } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
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

        it('uses default flySpeed of 60 when not specified', async () => {
            mockRuntimeGet({ [usesKey]: 1 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const action = makeAction({ automation: { flySpeed: undefined } });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 60 }),
                ]),
                campaignName,
            );
        });

        it('uses default hover of false when not specified', async () => {
            mockRuntimeGet({ [usesKey]: 1 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const action = makeAction({ automation: { hover: undefined } });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ hover: false }),
                ]),
                campaignName,
            );
        });

        it('uses custom feature name from action', async () => {
            mockRuntimeGet({ [usesKey]: 1 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const action = makeAction({ name: 'Custom Wings' });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Custom Wings');
            expect(result.payload.description).toContain('Custom Wings');
        });

        it('returns popup with feature name when no uses remaining', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 1 } } });
            const action = makeAction({ name: 'Custom Wings' });

            const result = await handle(action, stats, campaignName, null);

            expect(result.payload.name).toBe('Custom Wings');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('uses current SP from playerStats when available', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 5 } } });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
        });

        it('falls back to maxSorceryPoints when playerStats has no sorcery_points resource', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
            const stats = makePlayerStats({ resources: {} });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
        });

        it('falls back to 0 SP when classFeatures returns nothing', async () => {
            mockRuntimeGet({ [usesKey]: 0 });

            classFeatures.getClassFeatures.mockReturnValue(undefined);
            const stats = makePlayerStats({ resources: { sorcery_points: { current: 1 } } });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('treats stored uses as number via comparison', async () => {
            mockRuntimeGet({ [usesKey]: '1' });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('deactivates when stored uses string equals "1"', async () => {
            mockRuntimeGet({
                [usesKey]: '1',
                activeBuffs: [{ name: 'Dragon Wings', effect: 'dragon_wings' }],
            });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('deactivated');
        });

        it('includes automation object in popup payload', async () => {
            mockRuntimeGet({ [usesKey]: 1 });

            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('dragon_wings');
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

        it('returns false when runtime value is a non-boolean truthy value', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            expect(isActive(playerName)).toBe(false);
        });

        it('uses player name to build the runtime key', () => {
            const stats = makePlayerStats({ name: 'Different Name' });

            isActive(stats.name);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                'Different Name',
                expect.stringContaining('dragonWingsActive'),
                null,
            );
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

        it('uses the correct player name for the runtime key', () => {
            const stats = makePlayerStats({ name: 'Another Player' });

            deactivate(stats.name, campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Another Player',
                expect.stringContaining('dragonWingsActive'),
                false,
                campaignName,
            );
        });
    });
});
