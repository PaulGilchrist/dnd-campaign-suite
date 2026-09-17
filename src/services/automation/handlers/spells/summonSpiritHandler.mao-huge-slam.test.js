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

    it('negative caster spellcasting modifier folds to "2d12+3+-1" (documented consumer quirk: double-sign string fails canRollExpression — sanitizer lives in the summon-path consumer, separate subsystem)', () => {
        const [resolved] = resolveMonsterActions(huge, {
            slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: -4, spellcastingModifier: -1,
        });
        expect(resolved.attack_bonus).toBe(9);
        expect(resolved.damage_dice_primary).toBe('2d12+3+-1');
        expect(canRollExpression(resolved.damage_dice_primary)).toBe(false);
    });
});
