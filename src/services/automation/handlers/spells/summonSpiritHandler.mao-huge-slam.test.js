// MA-0284 guard: Animated Object (Huge) actions[0] "Slam" is caster-dependent
// 2024 text ("+spell attack modifier", "2d12+3+spellcasting modifier").
// Verdict SKIPPED (no data/code change): a numeric authoring would fabricate
// the caster's modifier (EB direct-join has NO caster context — any fixed
// number mis-resolves for other casters), and actions[] rows have NO advisory
// affordance routing (advisory seams are legendary-only, MonsterCardModal.jsx
// resolveLegendaryRowMechanic, and lair-only, monsterLairActions.js) — an
// authored advisory would render zero affordance exactly as today.
// This test locks (1) the row stays byte-clean with NO fabricated numerics,
// (2) the honest caster-context consumer (resolveMonsterActions, the
// spellcast-summon path this monster is designed for) resolves BOTH legs
// from the caster — the residual gap is caster context at EB direct-join
// only (new subsystem: EB join inheriting summoner caster context).
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../../../public/data/monsters.json' with { type: 'json' };
import spells2024 from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import { canRollExpression } from '../../../dice/diceRoller.js';
import { attackRowMissingToHit } from '../../../../components/encounter/MonsterCardHelpers.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));
vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../buffs/tempHpService.js', () => ({
    setTempHpOnKey: vi.fn(),
}));
vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockReturnValue({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }),
}));

import { resolveMonsterActions } from './summonSpiritHandler.js';

const huge = monstersData.find(m => m.index === 'animated-object-huge');
const slam = huge.actions[0];

describe('MA-0284 data lock: Animated Object (Huge) Slam stays byte-clean', () => {
    it('row carries NO fabricated numeric — caster-dependent legs intact', () => {
        expect(slam.name).toBe('Slam');
        expect(slam.attack_bonus).toBeNull();
        expect(slam.damage_dice_primary).toBe('2d12+3+spellcasting modifier');
        expect(slam.damage_type_primary).toBe('force');
        expect(slam.description).toBe('Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d12+3+spellcasting modifier Force damage.');
        expect(huge.proficiency_bonus).toBeNull();
    });

    it('unrollable formula keeps the MA-0014 plain-text gate (EB direct-join inert by honesty, not by defect)', () => {
        expect(canRollExpression(slam.damage_dice_primary)).toBe(false);
    });

    it('NO advisory / spell_attack_bonus authored — neither routes on regular action rows', () => {
        expect(slam.advisory).toBeUndefined();
        expect(slam.advisory_message).toBeUndefined();
        expect(slam.spell_attack_bonus).toBeUndefined();
    });

    it('huge variant stays reachable through the 2024 animate-objects summon automation', () => {
        const spell = spells2024.find(s => s.index === 'animate-objects');
        expect(spell.automation.type).toBe('summon_spirit');
        expect(spell.automation.variants.map(v => v.monsterIndex)).toContain('animated-object-huge');
    });
});

// MA-0285 guard (byte-clean skip): Animated Object (Large) Slam is the same
// MA-0284 fingerprint — unparseable "+spellcasting modifier" legs, fully
// inert at EB direct-join, honest. The MA-0286 suppression gate
// (attackRowMissingToHit) additionally arms here, so even if the formula
// ever became parseable the null-attack_bonus attack row could not regain
// an auto-hit damage chip. No data change.
describe('MA-0285 data lock: Animated Object (Large) Slam sibling stays byte-clean', () => {
    const large = monstersData.find(m => m.index === 'animated-object-large');
    const largeSlam = large.actions[0];

    it('row carries NO fabricated numeric — caster-dependent legs byte-identical', () => {
        expect(largeSlam.name).toBe('Slam');
        expect(largeSlam.attack_bonus).toBeNull();
        expect(largeSlam.damage_dice_primary).toBe('2d6+3+spellcasting modifier');
        expect(largeSlam.damage_type_primary).toBe('force');
        expect(largeSlam.description).toBe('Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d6+3+spellcasting modifier Force damage.');
        expect(large.proficiency_bonus).toBeNull();
    });

    it('unrollable formula keeps the MA-0014 plain-text gate — fully inert, no affordance', () => {
        expect(canRollExpression(largeSlam.damage_dice_primary)).toBe(false);
    });

    it('MA-0286 suppression gate arms the null-bonus attack row — no auto-hit route even if formula became rollable', () => {
        expect(attackRowMissingToHit(largeSlam)).toBe(true);
    });

    it('NO advisory / spell_attack_bonus authored — neither routes on regular action rows', () => {
        expect(largeSlam.advisory).toBeUndefined();
        expect(largeSlam.advisory_message).toBeUndefined();
        expect(largeSlam.spell_attack_bonus).toBeUndefined();
    });

    it('large variant stays reachable through the 2024 animate-objects summon automation', () => {
        const spell = spells2024.find(s => s.index === 'animate-objects');
        expect(spell.automation.variants.map(v => v.monsterIndex)).toContain('animated-object-large');
    });
});

describe('MA-0285 caster-context consumer: Large resolves honestly on the summon path', () => {
    it('resolveMonsterActions folds caster modifiers into the Large authored text', () => {
        const large = monstersData.find(m => m.index === 'animated-object-large');
        const [resolved] = resolveMonsterActions(large, {
            slotLevel: 3, spellAttackMod: 10, spellSaveDc: 18, spellcastingModifier: 4,
        });
        expect(resolved.attack_bonus).toBe(10);
        expect(resolved.damage_dice_primary).toBe('2d6+3+4');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
    });
});

describe('MA-0284 caster-context consumer: spellcast-summon path resolves both legs honestly', () => {
    it('resolveMonsterActions folds the caster modifiers into the authored text', () => {
        const [resolved] = resolveMonsterActions(huge, {
            slotLevel: 5, spellAttackMod: 11, spellSaveDc: 19, wisModifier: -4, spellcastingModifier: 5,
        });
        expect(resolved.attack_bonus).toBe(11);
        expect(resolved.damage_dice_primary).toBe('2d12+3+5');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
        expect(resolved.description).toContain('+11');
        expect(resolved.description).not.toMatch(/spell attack modifier/);
        expect(resolved.description).not.toMatch(/spellcasting modifier/);
    });

    it('negative caster spellcasting modifier folds sign-normalized to "2d12+2" — chip stays rollable', () => {
        const [resolved] = resolveMonsterActions(huge, {
            slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: -4, spellcastingModifier: -1,
        });
        expect(resolved.attack_bonus).toBe(9);
        expect(resolved.damage_dice_primary).toBe('2d12+2');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
        expect(resolved.description).toContain('+9');
        expect(resolved.description).toContain('Hit: 2d12+2 Force');
    });

    it('negative spell attack modifier folds "+-3" to "-3" in description', () => {
        const [resolved] = resolveMonsterActions(huge, {
            slotLevel: 5, spellAttackMod: -3, spellSaveDc: 13, wisModifier: 0, spellcastingModifier: 0,
        });
        expect(resolved.attack_bonus).toBe(-3);
        expect(resolved.description).toContain('Attack: -3,');
        expect(resolved.description).not.toContain('+-3');
        expect(resolved.damage_dice_primary).toBe('2d12+3+0');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
    });

    it('negative modifier with no authored tail folds "1d8+-1" to "1d8-1"', () => {
        const [resolved] = resolveMonsterActions({ actions: [{ name: 'Strike', damage_dice_primary: '1d8+WIS modifier', description: 'Hit: 1d8+WIS modifier Piercing damage.' }] }, {
            slotLevel: 2, spellAttackMod: 7, spellSaveDc: 15, wisModifier: -1, spellcastingModifier: 0,
        });
        expect(resolved.damage_dice_primary).toBe('1d8-1');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
        expect(resolved.description).toContain('Hit: 1d8-1 Piercing');
    });

    it('sign-fold matrix: negative/zero/positive tails all rollable with correct arithmetic', () => {
        const fold = (spellcastingModifier) => resolveMonsterActions(huge, {
            slotLevel: 5, spellAttackMod: 8, spellSaveDc: 16, wisModifier: spellcastingModifier, spellcastingModifier,
        })[0];
        const pos = fold(5);
        expect(pos.damage_dice_primary).toBe('2d12+3+5');
        expect(canRollExpression(pos.damage_dice_primary)).toBe(true);
        const zero = fold(0);
        expect(zero.damage_dice_primary).toBe('2d12+3+0');
        expect(canRollExpression(zero.damage_dice_primary)).toBe(true);
        const neg = fold(-7);
        expect(neg.damage_dice_primary).toBe('2d12-4');
        expect(canRollExpression(neg.damage_dice_primary)).toBe(true);
    });
});

describe('summon path sign normalization: Bestial Spirit (Air) caster legs', () => {
    const air = monstersData.find(m => m.index === 'bestial-spirit-air');

    it('positive WIS folds to numeric rollable damage and numeric attack_bonus', () => {
        const [resolved] = resolveMonsterActions(air, {
            slotLevel: 2, spellAttackMod: 9, spellSaveDc: 17, wisModifier: 3, spellcastingModifier: 3,
        });
        expect(resolved.attack_bonus).toBe(9);
        expect(resolved.damage_dice_primary).toBe('1d8+2+3');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
        expect(resolved.description).toContain('+9');
        expect(resolved.description).toContain('1d8+2+3');
    });

    it('negative WIS collapses "1d8+2+-1" to "1d8+1" — chip stays rollable', () => {
        const [resolved] = resolveMonsterActions(air, {
            slotLevel: 2, spellAttackMod: 5, spellSaveDc: 13, wisModifier: -1, spellcastingModifier: -1,
        });
        expect(resolved.damage_dice_primary).toBe('1d8+1');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(true);
        expect(resolved.description).toContain('1d8+1 Piercing');
    });
});
