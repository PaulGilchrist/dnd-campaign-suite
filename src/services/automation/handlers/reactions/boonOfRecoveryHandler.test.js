// @cleaned-by-ai
// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

import { handle, isLastStandAvailable, getLastStandUsed } from './boonOfRecoveryHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

describe('boonOfRecoveryHandler', () => {
    const campaignName = 'TestCampaign';
    const playerName = 'TestFighter';

    const mockPlayerStats = { name: playerName, hitPoints: { max: 40 } };
    const mockAction = {
        name: 'Boon Of Recovery',
        automation: {
            type: 'survive_and_heal',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healExpression: 'half_max_hp',
            recharge: 'long_rest',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('when last stand has already been used', () => {
            it('should return an info popup indicating the ability is unavailable', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return true;
                    return undefined;
                });

                const result = await handle(mockAction, mockPlayerStats, campaignName);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Boon Of Recovery');
                expect(result.payload.description).toContain('Last Stand has already been used');
                expect(result.payload.description).toContain('Long Rest');
                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
            });
        });

        describe('when last stand is available', () => {
            it('should mark last stand as used, set HP to half max, clear death saves, filter unconscious, and post logs', async () => {
                const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    if (key === 'deathSaves') return [true, false, true];
                    if (key === 'deathFailures') return [false, true, false];
                    if (key === 'activeConditions') return ['unconscious', 'poisoned'];
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                const result = await handle(mockAction, mockPlayerStats, campaignName);

                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
                dispatchSpy.mockRestore();
                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Boon Of Recovery');
                expect(result.payload.description).toContain('TestFighter');
                expect(result.payload.description).toContain('20 HP');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'boonOfRecoveryLastStandUsed', true, campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 20, campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'deathSaves', [false, false, false], campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'deathFailures', [false, false, false], campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'activeConditions', ['poisoned'], campaignName
                );
                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'hp_change',
                    targetName: playerName,
                    delta: 20,
                    currentHp: 20,
                    maxHp: 40,
                    isHealing: true,
                    isUnconscious: false,
                });
                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Boon Of Recovery',
                    description: expect.stringContaining('used Boon Of Recovery'),
                });
            });

            it('should floor the heal amount for odd max HP values', async () => {
                const oddStats = { name: playerName, hitPoints: { max: 47 } };
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                const result = await handle(mockAction, oddStats, campaignName);

                expect(result.payload.description).toContain('23');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 23, campaignName
                );
            });

            it('should clamp minimum HP to 1 when heal calculation would be 0', async () => {
                const lowMaxStats = { name: playerName, hitPoints: { max: 1 } };
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                const result = await handle(mockAction, lowMaxStats, campaignName);

                expect(result.payload.description).toContain('1 HP');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 1, campaignName
                );
            });

            it('should fall back to level, barbarianLevel, or 1 HP when hitPoints is missing', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                // fallback to level (10 -> 5)
                await handle(mockAction, { name: playerName, level: 10 }, campaignName);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 5, campaignName
                );
                vi.clearAllMocks();
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });

                // fallback to barbarianLevel (12 -> 6)
                await handle(mockAction, { name: playerName, barbarianLevel: 12 }, campaignName);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 6, campaignName
                );
                vi.clearAllMocks();
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });

                // no stat sources -> default to 1
                await handle(mockAction, { name: playerName }, campaignName);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 1, campaignName
                );
            });
        });
    });

    describe('isLastStandAvailable', () => {
        it('should return true when runtime value is undefined or falsy, false when true', () => {
            // undefined (never used) -> available
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            expect(isLastStandAvailable({ name: playerName }, campaignName)).toBe(true);

            vi.clearAllMocks();

            // false -> available
            runtimeState.getRuntimeValue.mockReturnValue(false);
            expect(isLastStandAvailable({ name: playerName }, campaignName)).toBe(true);

            vi.clearAllMocks();

            // true -> not available
            runtimeState.getRuntimeValue.mockReturnValue(true);
            expect(isLastStandAvailable({ name: playerName }, campaignName)).toBe(false);
        });
    });

    describe('getLastStandUsed', () => {
        it('should return the runtime value for the last stand key as-is', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);
            expect(getLastStandUsed({ name: playerName }, campaignName)).toBe(true);

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockReturnValue(false);
            expect(getLastStandUsed({ name: playerName }, campaignName)).toBe(false);

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            expect(getLastStandUsed({ name: playerName }, campaignName)).toBe(undefined);
        });
    });
});
