import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockReturnValue({ catch: (fn) => fn() }),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

describe('wardingBondService damage application', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('damage application', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWithinRange() {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;
        }

        it('subtracts wardDamage from caster currentHp', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(paladin.currentHp).toBe(5);
        });

        it('caps currentHp at 0 (no negative HP)', () => {
            setupWithinRange();
            paladin.currentHp = 3;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                10,
            );

            expect(paladin.currentHp).toBe(0);
        });

        it('uses the wardDamage parameter as the shared damage value', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                7,
            );

            expect(paladin.currentHp).toBe(3);
        });

        it('does not modify HP when caster already has 0 HP', () => {
            setupWithinRange();
            paladin.currentHp = 0;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(paladin.currentHp).toBe(0);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('works when warding bond target is an NPC and caster is a player (not in combatSummary)', () => {
            const npcAlly = { name: 'NPCAlly', currentHp: 15, maxHp: 15 };
            getRuntimeValue.mockReturnValueOnce([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ])
            .mockReturnValueOnce(10)
            .mockReturnValueOnce(20);
            getDistanceFeet.mockReturnValue(30);

            applyWardingBond(
                npcAlly,
                makeCombatSummary(npcAlly),
                campaignName,
                4,
            );

            // Caster not in combatSummary → reads HP from runtime store
            expect(setRuntimeValue).toHaveBeenCalledWith('Paladin', 'currentHitPoints', 6, campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
                targetName: 'Paladin',
                delta: -4,
                currentHp: 6,
                maxHp: 20,
                abilityName: 'Warding Bond',
            }));
        });

        it('works when warding bond caster is an NPC (HP read from combatSummary)', () => {
            const npcCaster = { name: 'NPCCaster', currentHp: 10, maxHp: 10 };
            const playerTarget = { name: 'Player1' };
            getRuntimeValue.mockReturnValueOnce([
                { effect: 'warding_bond', sourceCharacter: 'NPCCaster' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            applyWardingBond(
                playerTarget,
                makeCombatSummary(npcCaster, playerTarget),
                campaignName,
                3,
            );

            expect(npcCaster.currentHp).toBe(7);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'NPCCaster',
                delta: -3,
                currentHp: 7,
            }));
        });
    });
});
