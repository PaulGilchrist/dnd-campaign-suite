// @maintained-by-ai
// Deterministic unit tests for the Trance of Order handler (CLA-364): a stable
// state machine over the runtime store (free use → 0, 5 SP restore, refusals
// with zero spend) plus isActive/deactivate contracts. All dependencies mocked;
// no timers, DOM, or wall-clock coupling. Handler-level coverage lives only
// here — sibling suites (automationModifiers, sorcery info builder,
// trackedResources, UI) cover different seams and are not duplicated below.
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

        it('should return error popup and log a refusal when no uses remain and player lacks SP', async () => {
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
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'automation',
                    characterName: playerName,
                    description: expect.stringContaining('trance_of_order_refused no_uses'),
                }),
            );
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

        // CLA-364 BUG-A: null/unset stored uses mean the once-per-Long-Rest
        // free use is still available (warpingimplosionUses null-as-available
        // pattern — trackedResources no longer seeds 0 at feature grant; Long
        // Rest null-re-arm via restRules-constants LONG_REST_RESOURCES). Even
        // when the player could afford the 5 SP restore, the press is free.
        it('should activate free when stored uses are null/unset (first press or Long Rest re-arm, CLA-364 BUG-A)', async () => {
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

        // Shared contract of the .catch(e => console.error(...)) guards on
        // addEntry in both the free-activation and 5 SP restore paths.
        it('should still return the activation popup and log to console when addEntry rejects', async () => {
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);
            logService.addEntry.mockReturnValue(Promise.reject(new Error('log failed')));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Free-use activation path
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === usesKey) return 1;
                return null;
            });
            const freeResult = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(freeResult.type).toBe('popup');
            expect(freeResult.payload.description).toContain('activated');

            // 5 SP restore path
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === usesKey) return 0;
                return null;
            });
            const spendResult = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(spendResult.type).toBe('popup');
            expect(spendResult.payload.description).toContain('5 SP');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName, 10);

            expect(consoleSpy).toHaveBeenCalledWith('[tranceOfOrder] Error:', expect.any(Error));
            expect(consoleSpy).toHaveBeenCalledTimes(2);
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
