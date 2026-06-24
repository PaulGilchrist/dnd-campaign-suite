// @improved-by-ai
// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

import { handle, isLastStandAvailable, getLastStandUsed } from './boonOfRecoveryHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as logPoster from '../../../shared/logPoster.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js');
vi.mock('../../../shared/logPoster.js');

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
            });

            it('should not modify any runtime state when already used', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return true;
                    return undefined;
                });

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
                expect(logPoster.postLogEntry).not.toHaveBeenCalled();
            });
        });

        describe('when last stand is available', () => {
            it('should mark last stand as used, set HP to half max, and remove unconscious condition', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    if (key === 'activeConditions') return ['unconscious'];
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                const result = await handle(mockAction, mockPlayerStats, campaignName);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Boon Of Recovery');
                expect(result.payload.description).toContain('TestFighter');
                expect(result.payload.description).toContain('20 HP');
                expect(result.payload.description).toContain('20 hit points');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'boonOfRecoveryLastStandUsed', true, campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 20, campaignName
                );
            });

            it('should clear death saves and death failures', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    if (key === 'deathSaves') return [true, false, true];
                    if (key === 'deathFailures') return [false, true, false];
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'deathSaves', [false, false, false], campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'deathFailures', [false, false, false], campaignName
                );
            });

            it('should filter out unconscious condition from active conditions', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    if (key === 'activeConditions') return ['unconscious', 'poisoned'];
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'activeConditions', ['poisoned'], campaignName
                );
            });

            it('should handle empty active conditions array', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    if (key === 'activeConditions') return [];
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'activeConditions', [], campaignName
                );
            });

            it('should handle undefined active conditions', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'activeConditions', [], campaignName
                );
            });

            it('should post a heal log entry via logPoster', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'heal',
                    targetName: playerName,
                    delta: 20,
                    currentHp: 20,
                    maxHp: 40,
                    isHealing: true,
                    isUnconscious: false,
                    abilityName: 'Boon Of Recovery',
                });
            });

            it('should add an ability_use log entry via logService', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Boon Of Recovery',
                    description: expect.stringContaining('used Boon Of Recovery'),
                });
            });

            it('should dispatch combat-summary-updated event', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);
                const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

                await handle(mockAction, mockPlayerStats, campaignName);

                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
                dispatchSpy.mockRestore();
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

            it('should handle missing hitPoints by falling back to level', async () => {
                const fallbackStats = { name: playerName, level: 10 };
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, fallbackStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 5, campaignName
                );
            });

            it('should handle missing hitPoints by falling back to barbarianLevel', async () => {
                const fallbackStats = { name: playerName, barbarianLevel: 12 };
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, fallbackStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 6, campaignName
                );
            });

            it('should default to 1 HP when no stat sources are available', async () => {
                const minimalStats = { name: playerName };
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                logService.addEntry.mockResolvedValue(undefined);

                await handle(mockAction, minimalStats, campaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 1, campaignName
                );
            });
        });

        describe('fire-and-forget resilience', () => {
            it('should return popup and apply state even when logService.addEntry rejects', async () => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'boonOfRecoveryLastStandUsed') return undefined;
                    return undefined;
                });
                const logError = new Error('Log service unavailable');
                logService.addEntry.mockRejectedValue(logError);

                const result = await handle(mockAction, mockPlayerStats, campaignName);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'boonOfRecoveryLastStandUsed', true, campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName, 'currentHitPoints', 20, campaignName
                );
                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
            });
        });
    });

    describe('isLastStandAvailable', () => {
        it('should return true when runtime value is undefined (never used)', () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const result = isLastStandAvailable({ name: playerName }, campaignName);

            expect(result).toBe(true);
        });

        it('should return true when runtime value is falsy', () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);

            const result = isLastStandAvailable({ name: playerName }, campaignName);

            expect(result).toBe(true);
        });

        it('should return false when runtime value is true', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);

            const result = isLastStandAvailable({ name: playerName }, campaignName);

            expect(result).toBe(false);
        });
    });

    describe('getLastStandUsed', () => {
        it('should return the runtime value for the last stand key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);

            const result = getLastStandUsed({ name: playerName }, campaignName);

            expect(result).toBe(true);
        });

        it('should return false when runtime value is false', () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);

            const result = getLastStandUsed({ name: playerName }, campaignName);

            expect(result).toBe(false);
        });

        it('should return undefined when runtime value is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const result = getLastStandUsed({ name: playerName }, campaignName);

            expect(result).toBe(undefined);
        });
    });
});
