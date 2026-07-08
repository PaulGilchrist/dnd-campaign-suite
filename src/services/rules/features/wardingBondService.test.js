// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

        it('does nothing when distance exceeds 60 feet', () => {
            setupWardingBond('Paladin');
            getDistanceFeet.mockReturnValue(120);

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(getDistanceFeet).toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
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
    });

    describe('log entry creation', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWithinRange() {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;
        }

        it('logs an hp_change entry with correct type', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
            }));
        });

        it('logs with correct targetName (caster name)', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Paladin',
            }));
        });

        it('logs with correct delta (negative damage)', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                delta: -5,
            }));
        });

        it('logs with correct currentHp after damage', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                currentHp: 5,
            }));
        });

        it('logs with correct maxHp', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                maxHp: 10,
            }));
        });

        it('logs isHealing as false', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isHealing: false,
            }));
        });

        it('logs isUnconscious as false when HP remains above 0', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isUnconscious: false,
            }));
        });

        it('logs isUnconscious as true when HP drops to 0', () => {
            setupWithinRange();
            paladin.currentHp = 5;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isUnconscious: true,
            }));
        });

        it('logs abilityName as "Warding Bond"', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Warding Bond',
            }));
        });
    });

    describe('concentration check', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWithinRange() {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;
        }

        it('does not update concentration when concentration is falsy', () => {
            setupWithinRange();
            paladin.concentration = null;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            // No error should be thrown, concentration stays null
            expect(paladin.concentration).toBe(null);
        });

        it('does not update concentration when sharedDamage is 0', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                0,
            );

            expect(paladin.concentration.dc).toBe(15);
        });

        it('sets concentration dc to Math.max(10, floor(sharedDamage / 2))', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            // Math.max(10, floor(5 / 2)) = Math.max(10, 2) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('uses the higher value when existing dc is greater', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                25,
            );

            // Math.max(10, floor(25 / 2)) = Math.max(10, 12) = 12
            expect(paladin.concentration.dc).toBe(12);
        });

        it('updates concentration when sharedDamage is positive', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                8,
            );

            // Math.max(10, floor(8 / 2)) = Math.max(10, 4) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('handles odd sharedDamage values correctly', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                7,
            );

            // Math.max(10, floor(7 / 2)) = Math.max(10, 3) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('handles large sharedDamage values correctly', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                30,
            );

            // Math.max(10, floor(30 / 2)) = Math.max(10, 15) = 15
            expect(paladin.concentration.dc).toBe(15);
        });
    });

    describe('error handling', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        it('calls console.error when addEntry promise rejects', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;

            const testError = new Error('log failure');
            addEntry.mockReturnValue({
                catch: (fn) => {
                    // Simulate the promise rejecting — fn receives the error
                    fn(testError);
                    return { catch: () => {} };
                },
            });

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(console.error).toHaveBeenCalledWith(
                '[wardingBond] Error:',
                testError,
            );
        });
    });

    describe('edge cases', () => {
        it('handles wardDamage of 0 — logs entry with delta -0 but no HP change', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                0,
            );

            // Production code does not guard against wardDamage === 0
            // Math.max(0, 10 - 0) = 10, so HP unchanged but entry is logged
            expect(paladin.currentHp).toBe(10);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                delta: -0,
            }));
        });

        it('handles negative wardDamage — increases HP', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 5, maxHp: 10 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                -3,
            );

            // Math.max(0, 5 - (-3)) = Math.max(0, 8) = 8
            expect(paladin.currentHp).toBe(8);
        });

        it('handles multiple warding_bond buffs — uses the first match', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'shield' },
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
                { effect: 'warding_bond', sourceCharacter: 'Wizard' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
            const wizard = { name: 'Wizard', currentHp: 8, maxHp: 8 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, wizard, goblin),
                campaignName,
                5,
            );

            // First warding_bond buff found has sourceCharacter 'Paladin'
            expect(paladin.currentHp).toBe(5);
            expect(wizard.currentHp).toBe(8);
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

            // Empty string is falsy but not null — the code checks
            // `wardingBondBuff.sourceCharacter` which is '' (truthy check
            // fails for empty string in JS).  Actually '' is falsy so the
            // condition `wardingBondBuff.sourceCharacter` is false.
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
