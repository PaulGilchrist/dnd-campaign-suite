// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

describe('wardingBondService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('warding bond buff lookup', () => {
        it('does nothing when creature has no activeBuffs', () => {
            getRuntimeValue.mockReturnValue(null);

            applyWardingBond(
                { name: 'Goblin' },
                makeCombatSummary({ name: 'Paladin', currentHp: 10, maxHp: 10 }),
                campaignName,
                5,
            );

            expect(getDistanceFeet).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when activeBuffs is not an array', () => {
            getRuntimeValue.mockReturnValue({});

            applyWardingBond(
                { name: 'Goblin' },
                makeCombatSummary({ name: 'Paladin', currentHp: 10, maxHp: 10 }),
                campaignName,
                5,
            );

            expect(getDistanceFeet).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when no warding_bond buff exists', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'holy_aura' },
                { effect: 'shield' },
            ]);

            applyWardingBond(
                { name: 'Goblin' },
                makeCombatSummary({ name: 'Paladin', currentHp: 10, maxHp: 10 }),
                campaignName,
                5,
            );

            expect(getDistanceFeet).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when warding_bond buff has no sourceCharacter', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond' },
            ]);

            applyWardingBond(
                { name: 'Goblin' },
                makeCombatSummary({ name: 'Paladin', currentHp: 10, maxHp: 10 }),
                campaignName,
                5,
            );

            expect(getDistanceFeet).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when warding_bond sourceCharacter matches creature.name', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Goblin' },
            ]);

            applyWardingBond(
                { name: 'Goblin' },
                makeCombatSummary({ name: 'Paladin', currentHp: 10, maxHp: 10 }),
                campaignName,
                5,
            );

            expect(getDistanceFeet).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('handles warding_bond buff with empty string sourceCharacter', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: '' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            // Empty string is falsy so the condition
            // `wardingBondBuff.sourceCharacter` is false.
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('distance check', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWardingBond(sourceCharacter) {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter },
            ]);
        }

        // NOTE: Production code bug — line 14 uses `distance === null`
        // instead of `distance !== null`.  When positions are missing,
        // getDistanceFeet returns null and the `=== null` branch fires,
        // incorrectly applying damage.  The test documents the actual
        // behaviour; the production condition should read
        // `distance !== null && distance <= 60`.
        it('applies damage when distance is null (missing positions) — documents production bug', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(null);
            paladin.currentHp = 10;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(getDistanceFeet).toHaveBeenCalledWith(
                paladin.position,
                goblin.position,
            );
            // Because of the `=== null` bug, damage IS applied
            expect(paladin.currentHp).toBe(5);
            expect(addEntry).toHaveBeenCalled();
        });

        it('SP-125: ends the bond when separation exceeds 60 feet', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(120);
            paladin.currentHp = 10;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(getDistanceFeet).toHaveBeenCalled();
            // No mirror damage — the bond has ended instead.
            expect(paladin.currentHp).toBe(10);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Warding Bond',
                description: expect.stringContaining('more than 60 feet'),
            }));
            // Bond buffs stripped from both connected creatures.
            const buffStrips = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffStrips.map(c => c[0])).toEqual(expect.arrayContaining(['Goblin', 'Paladin']));
            buffStrips.forEach(c => expect(c[2].some(b => b.effect === 'warding_bond')).toBe(false));
        });

        it('SP-125: ends the bond when mirror damage drops the caster to 0 HP', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 2;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(paladin.currentHp).toBe(0);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Warding Bond',
                description: expect.stringContaining('dropped to 0 hit points'),
            }));
            const buffStrips = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffStrips.map(c => c[0])).toEqual(expect.arrayContaining(['Goblin', 'Paladin']));
        });

        it('triggers when distance is exactly 60 feet', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(60);
            paladin.currentHp = 10;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(getDistanceFeet).toHaveBeenCalled();
            expect(paladin.currentHp).toBe(5);
            expect(addEntry).toHaveBeenCalled();
        });

        it('triggers when distance is within 60 feet', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(paladin.currentHp).toBe(5);
            expect(addEntry).toHaveBeenCalled();
        });

        it('persists caster HP via setRuntimeValue when caster is a player (not in combatSummary)', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(30);
            getRuntimeValue.mockReturnValueOnce([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ])
            .mockReturnValueOnce(10);

            applyWardingBond(
                goblin,
                makeCombatSummary(goblin),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('Paladin', 'currentHitPoints', 5, campaignName);
        });

        it('does nothing when caster creature is not found in combatSummary', () => {
            setupWardingBond('UnknownPaladin');
            paladin.currentHp = 10;

            applyWardingBond(
                goblin,
                makeCombatSummary({ name: 'Goblin' }),
                campaignName,
                5,
            );

            // casterCreature is undefined, so `casterCreature && ...` is false
            expect(addEntry).not.toHaveBeenCalled();
            expect(paladin.currentHp).toBe(10);
        });

        it('applies damage when target creature is not found — distance is null due to missing position', () => {
            setupWardingBond('Paladin');
            // getDistanceFeet returns null when either position is missing
            getDistanceFeet.mockReturnValue(null);
            paladin.currentHp = 10;

            applyWardingBond(
                { name: 'UnknownGoblin' },
                makeCombatSummary(paladin),
                campaignName,
                5,
            );

            // Because of the `=== null` bug, damage IS applied when distance is null
            expect(paladin.currentHp).toBe(5);
        });
    });
});
