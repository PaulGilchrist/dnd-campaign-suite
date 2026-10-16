// @maintained-by-ai
// Handler suite for survive_and_heal dispatch lane (automation/index.js → handleBoonOfRecovery,
// fed by 2024 feats.json "Last Stand"). Pins this handler's own execution composition:
// direct currentHitPoints write (no applyHealing / no shared heal util), latch key
// boonOfRecoveryLastStandUsed, unconscious-filter + death-save clears + isDead reset,
// hp_change + ability_use logs, and the combat-summary-updated dispatch event.
// NOTE: isLastStandAvailable/getLastStandUsed are dead exports (grep-zero production callers;
// only index.js imports `handle`) — deliberately untested here; remove them from the source.
// Distinct from boonOfRecoveryService.test coverage in applyDamage.lastStand.test.js (that
// module intercepts applyDamage and logs type 'healing'; this handler logs 'hp_change').

import { handle } from './boonOfRecoveryHandler.js';
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

    // Latch unset (available); other keys default undefined via the auto-mock.
    const mockAvailable = () => runtimeState.getRuntimeValue.mockReturnValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns an info popup with no side effects when last stand has already been used', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'boonOfRecoveryLastStandUsed') return true;
                return undefined;
            });

            const result = await handle(mockAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Boon Of Recovery',
                    description: 'Boon Of Recovery: Last Stand has already been used. Recharges after a Long Rest.',
                    automation: mockAction.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
            dispatchSpy.mockRestore();
        });

        it('marks latch, heals to 1 + half max, clears unconscious/death saves/isDead, and logs', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'deathSaves') return [true, false, true];
                if (key === 'deathFailures') return [false, true, false];
                if (key === 'activeConditions') return ['unconscious', 'poisoned'];
                return undefined;
            });

            const result = await handle(mockAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Boon Of Recovery',
                    description: 'TestFighter uses Last Stand to drop to 21 HP instead of 0, regaining 20 hit points.',
                    automation: mockAction.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(6);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'boonOfRecoveryLastStandUsed', true, campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'currentHitPoints', 21, campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'activeConditions', ['poisoned'], campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'deathSaves', [false, false, false], campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'deathFailures', [false, false, false], campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'isDead', 0, campaignName
            );
            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'hp_change',
                targetName: playerName,
                delta: 21,
                currentHp: 21,
                maxHp: 40,
                isHealing: true,
                isUnconscious: false,
            });
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Boon Of Recovery',
                description: 'TestFighter used Boon Of Recovery (Last Stand) to drop to 21 HP instead of 0.',
            });
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
            dispatchSpy.mockRestore();
        });

        it('floors half max for odd max HP values', async () => {
            mockAvailable();

            const result = await handle(mockAction, { name: playerName, hitPoints: { max: 47 } }, campaignName);

            expect(result.payload.description).toContain('24 HP');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'currentHitPoints', 24, campaignName
            );
        });

        it('derives max HP from barbarianLevel, level, then floors at 1 HP', async () => {
            // barbarianLevel (12 -> 1 + 6)
            mockAvailable();
            await handle(mockAction, { name: playerName, barbarianLevel: 12 }, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'currentHitPoints', 7, campaignName
            );

            // level fallback (10 -> 1 + 5)
            vi.clearAllMocks();
            mockAvailable();
            await handle(mockAction, { name: playerName, level: 10 }, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'currentHitPoints', 6, campaignName
            );

            // no stat sources -> default 1 HP (heal calculation of 0 stays clamped at 1)
            vi.clearAllMocks();
            mockAvailable();
            await handle(mockAction, { name: playerName }, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'currentHitPoints', 1, campaignName
            );
        });
    });
});
