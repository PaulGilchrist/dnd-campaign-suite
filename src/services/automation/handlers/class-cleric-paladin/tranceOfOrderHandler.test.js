// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isActive, deactivate } from './tranceOfOrderHandler.js';
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
    getCurrentSorceryPoints: vi.fn(() => 10),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

function makeAction(name) {
    return {
        name: name || 'Trance of Order',
        automation: {
            type: 'trance_of_order',
            action: 'bonus_action',
            duration: '1_minute',
            restoreCost: 5,
        },
    };
}

function makePlayerStats(overrides) {
    return {
        name: 'Test Character',
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

describe('Trance of Order Handler', () => {
    const campaignName = 'test-campaign';
    const playerName = 'Test Character';
    const activeKey = 'tranceOfOrderActive';
    const usesKey = 'tranceOfOrderUses';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle()', () => {
        it('should activate Trance of Order when uses are available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Attack rolls against you can\'t benefit from Advantage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                true,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                0,
                campaignName,
            );
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Trance of Order',
                }),
            );
        });

        it('should restore and activate by spending 5 SP when no uses remain and player has enough SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('5 SP');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName, 10);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                true,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                0,
                campaignName,
            );
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    description: expect.stringContaining('spending 5 Sorcery Points'),
                }),
            );
        });

        it('should return error popup when no uses remain and player lacks SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats({
                resources: { sorcery_points: { current: 2 } },
            }), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should include automation config and use custom action name in the popup payload', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction('Custom Feature'), makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Custom Feature');
            expect(result.payload.description).toContain('Custom Feature');
            expect(result.payload.automation).toEqual({
                type: 'trance_of_order',
                action: 'bonus_action',
                duration: '1_minute',
                restoreCost: 5,
            });
        });

        it('should use default feature name when action.name is undefined', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle({ automation: makeAction().automation }, makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Trance of Order');
            expect(result.payload.description).toContain('Trance of Order');
        });

        it('should handle null getClassFeatures returning maxSorceryPoints=0', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should treat null stored value as having uses remaining (usesMax)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).not.toContain('5 SP');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                0,
                campaignName,
            );
        });

        // CLA-364 BUG-A: first use each Long Rest is free. The key is never
        // seeded at feature grant (trackedResources no longer writes 0 — the
        // warpingimplosionUses null-as-available pattern), so a first press
        // (uses unset) must not reach the 5 SP restore lane.
        it('should activate free on first press when uses were never seeded (CLA-364 BUG-A)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return null;
                if (key === usesKey) return null;
                return null;
            });
            metamagic.getCurrentSorceryPoints.mockReturnValue(20);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).not.toContain('5 SP');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                0,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                true,
                campaignName,
            );
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ type: 'ability_use' }),
            );
        });

        // CLA-364 BUG-B: re-click while tranceOfOrderActive refuses with zero
        // spend and zero state writes (mirrors sorceryHandler already_active /
        // stonecunning re-click refusal phrasing).
        it('should refuse re-press while already active with zero spend (CLA-364 BUG-B)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return true;
                if (key === usesKey) return 0;
                return null;
            });
            metamagic.getCurrentSorceryPoints.mockReturnValue(20);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already active');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'automation',
                    characterName: playerName,
                    description: expect.stringContaining('trance_of_order_refused already_active'),
                }),
            );
        });

        it('should log a refusal when no uses remain and SP is insufficient', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'automation',
                    description: expect.stringContaining('trance_of_order_refused no_uses'),
                }),
            );
        });

        // CLA-364: Long Rest null-re-arm (restRules-constants LONG_REST_RESOURCES)
        // restores the free use — a press with uses re-armed to null is free even
        // when the player could afford the 5 SP restore.
        it('should spend the free use (not 5 SP) after a Long Rest re-arm (CLA-364)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return null;
                if (key === usesKey) return null;
                return null;
            });
            metamagic.getCurrentSorceryPoints.mockReturnValue(20);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });

            const result = await handle(makeAction(), makePlayerStats({ level: 20 }), campaignName, null);

            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).not.toContain('5 SP');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                0,
                campaignName,
            );
        });

        it('should handle addEntry rejection in SP spend path', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);
            logService.addEntry.mockReturnValue(Promise.reject(new Error('log failed')));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('5 SP');
            expect(consoleSpy).toHaveBeenCalledWith('[tranceOfOrder] Error:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('should handle addEntry rejection in normal activation path', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            logService.addEntry.mockReturnValue(Promise.reject(new Error('log failed')));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(consoleSpy).toHaveBeenCalledWith('[tranceOfOrder] Error:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('isActive()', () => {
        it('should return true when the active flag is true, false otherwise', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);
            expect(isActive(playerName)).toBe(true);

            runtimeState.getRuntimeValue.mockReturnValue(false);
            expect(isActive(playerName)).toBe(false);

            runtimeState.getRuntimeValue.mockReturnValue(null);
            expect(isActive(playerName)).toBe(false);
        });
    });

    describe('deactivate()', () => {
        it('should set the active flag to false for the given player', () => {
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
