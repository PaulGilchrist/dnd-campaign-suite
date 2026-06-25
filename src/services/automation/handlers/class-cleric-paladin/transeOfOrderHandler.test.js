// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isActive, deactivate } from './transeOfOrderHandler.js';
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

function makeAction(name) {
    return {
        name: name || 'Transe of Order',
        automation: {
            type: 'transe_of_order',
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

function getRuntimeKey(playerName, key) {
    return playerName.toLowerCase().replace(/\s+/g, '') + '_' + key;
}

describe('Transe of Order Handler', () => {
    const campaignName = 'test-campaign';
    const playerName = 'Test Character';
    const activeKey = getRuntimeKey(playerName, 'transeOfOrderActive');
    const usesKey = getRuntimeKey(playerName, 'transeOfOrderUses');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle()', () => {
        it('should activate Transe of Order when not active and player has enough SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return null;
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
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Transe of Order',
                }),
            );
        });

        it('should activate when stored uses exist and active flag is false (re-activation after deactivation)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 1;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                true,
                campaignName,
            );
        });

        it('should restore uses by spending 5 SP when no uses remain and player has enough SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                usesKey,
                1,
                campaignName,
            );
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            const [logCampaign, logEntry] = logService.addEntry.mock.calls[0];
            expect(logCampaign).toBe(campaignName);
            expect(logEntry.type).toBe('ability_use');
            expect(logEntry.description).toContain('spending 5 Sorcery Points');
        });

        it('should return error popup when no uses remain, active is false, and player lacks SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });

            const result = await handle(makeAction(), makePlayerStats({
                resources: { sorcery_points: { current: 2 } },
            }), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should restore when no uses remain, active is false, and getClassFeatures returns null but player has SP', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName);
        });

        it('should use maxSorceryPoints as fallback when playerStats.resources.sorcery_points is missing', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats({
                resources: undefined,
            }), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName);
        });

        it('should use current SP from playerStats when available instead of maxSorceryPoints', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats({
                resources: { sorcery_points: { current: 3 } },
            }), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should restore when no uses remain, maxSorceryPoints is 0, but player has SP in resources', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 0 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName);
        });

        it('should return error popup when no uses remain, no resources, and maxSorceryPoints is 0', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return 0;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 0 });

            const result = await handle(makeAction(), makePlayerStats({
                resources: undefined,
            }), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should use custom action name from the action object', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return null;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction('Custom Feature'), makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Custom Feature');
            expect(result.payload.description).toContain('Custom Feature');
        });

        it('should include automation config in the popup payload', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === activeKey) return false;
                if (key === usesKey) return null;
                return null;
            });
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual({
                type: 'transe_of_order',
                action: 'bonus_action',
                duration: '1_minute',
                restoreCost: 5,
            });
        });
    });

    describe('isActive()', () => {
        it('should return true when the active flag is true', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);
            expect(isActive(playerName)).toBe(true);
        });

        it('should return false when the active flag is false', () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);
            expect(isActive(playerName)).toBe(false);
        });

        it('should return false when the active flag is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            expect(isActive(playerName)).toBe(false);
        });
    });

    describe('deactivate()', () => {
        it('should set the active flag to false', () => {
            deactivate(playerName, campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                false,
                campaignName,
            );
        });

        it('should use the correct runtime key for the player', () => {
            deactivate('Other Player', campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Other Player',
                getRuntimeKey('Other Player', 'transeOfOrderActive'),
                false,
                campaignName,
            );
        });
    });
});
