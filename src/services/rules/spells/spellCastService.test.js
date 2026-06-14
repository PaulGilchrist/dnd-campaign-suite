import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(),
  computeEffectiveSpellRange: vi.fn(),
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../combat/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(),
  getActiveBuffs: vi.fn().mockReturnValue([]),
}));

vi.mock('./postCastRiderService.js', () => ({
   triggerPostCastRiderSaves: vi.fn().mockResolvedValue(undefined),
   triggerSpellThief: vi.fn().mockResolvedValue(undefined),
   triggerBewitchingMagic: vi.fn().mockResolvedValue(undefined),
   triggerSoulstitchSpells: vi.fn().mockResolvedValue(undefined),
   hasEmpoweredEvocation: vi.fn().mockReturnValue(false),
   getEmpoweredEvocationIntModifier: vi.fn().mockReturnValue(0),
 }));

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn().mockResolvedValue(undefined),
  triggerPostCastAllyHeals: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { executeSpellCast } from './spellCastService.js';

import { rollExpression } from '../../dice/diceRoller.js';
import {
  computeRangeEffect,
  computeEffectiveSpellRange,
  getDistanceFeet,
  rangeToFeet,
} from '../combat/rangeValidation.js';
import * as useRuntimeState from '../../hooks/useRuntimeState.js';
import * as buffService from '../../combat/buffService.js';
import * as postCastRiderService from './postCastRiderService.js';
import * as postCastHealService from './postCastHealService.js';

// ── Helpers ─────────────────────────────────────────────────────

const makePlayerStats = (name = 'Aragorn', extra = {}) => ({
  name,
  spellAbilities: { toHit: 5, saveDc: 13 },
   ...extra,
});

function makeSpell(name = 'Fire Bolt', dmgFormula = '2d10', dmgType = 'fire') {
  return {
    name,
    damage: {
      damage_at_slot_level: { [dmgFormula]: dmgFormula },
      damage_type: dmgType,
     },
   };
}

function makeSpellWithDc(name = 'Burning Hands', dcType = 'dex', dcSuccess = 'half', dmgFormula = '2d10', dmgType = 'fire') {
  const spell = makeSpell(name, dmgFormula, dmgType);
  spell.dc = { dc_type: dcType, dc_success: dcSuccess };
  return spell;
}

// ── Tests ───────────────────────────────────────────────────────

describe('executeSpellCast', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseOptions = () => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn().mockResolvedValue({ name: 'Goblin' }),
   });

   // ── Early exit paths ────────────────────────────────────────

  it('returns undefined when spell has no damage formula', async () => {
    const options = baseOptions();
    const result = await executeSpellCast(
       { name: 'Cure Wounds' }, // no damage
        {},
        options,
     );
    expect(result).toBeUndefined();
   });

  it('returns undefined when damage object exists but is empty', async () => {
    const spell = { name: 'Harm', damage: {} };
    const options = baseOptions();
    const result = await executeSpellCast(spell, {}, options);
    expect(result).toBeUndefined();
   });

  it('returns undefined when damage_at_slot_level is empty object', async () => {
    const spell = {
       name: 'Magic Missile',
       damage: { damage_at_slot_level: {}, damage_type: 'force' },
     };
    const options = baseOptions();
    const result = await executeSpellCast(spell, {}, options);
    expect(result).toBeUndefined();
   });

  it('returns undefined when both slot and character level damage empty', async () => {
    const spell = {
       name: 'Light',
       damage: { damage_at_slot_level: {}, damage_at_character_level: {} },
     };
    const options = baseOptions();
    const result = await executeSpellCast(spell, {}, options);
    expect(result).toBeUndefined();
   });

  it('returns undefined when spell has no damage property at all', async () => {
    const options = baseOptions();
    const result = await executeSpellCast({ name: 'Shield' }, {}, options);
    expect(result).toBeUndefined();
   });

   // ── Attack path (no dc on spell) ────────────────────────────

  it('calls rollAttack when spell has no dc', async () => {
    const options = baseOptions();
    await executeSpellCast(makeSpell(), {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
       'Fire Bolt',
        5, // toHit
        expect.objectContaining({ autoDamageFormula: '2d10' }),
     );
   });

  it('passes spell name to rollAttack', async () => {
    const options = baseOptions();
    await executeSpellCast(makeSpell('Chromatic Orb'), {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
       'Chromatic Orb',
        expect.any(Number),
        expect.objectContaining({ autoDamageName: 'Chromatic Orb' }),
     );
   });

  it('passes player toHit to rollAttack', async () => {
    const options = baseOptions();
    options.playerStats.spellAbilities.toHit = 7;
    await executeSpellCast(makeSpell(), {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
        expect.any(String),
        7,
        expect.any(Object),
     );
   });

  it('passes autoDamageFormula to rollAttack context', async () => {
    const options = baseOptions();
    await executeSpellCast(makeSpell(), {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ autoDamageFormula: '2d10' }),
     );
   });

  it('uses damage_type in rollContext passed to rollAttack', async () => {
    const options = baseOptions();
    await executeSpellCast(makeSpell('Ice Knife', '2d8', 'cold'), {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ damageType: 'cold' }),
     );
   });

  it('uses damage_at_character_level when slot level is empty', async () => {
    const options = baseOptions();
    options.rollAttack.mockReset();
    const spell = {
       name: 'Eldritch Blast',
       damage: {
         damage_at_slot_level: {},
         damage_at_character_level: { '2d10': '2d10' },
         damage_type: 'force',
        },
     };
    await executeSpellCast(spell, {}, options);
    expect(options.rollAttack).toHaveBeenCalledWith(
        'Eldritch Blast',
        expect.any(Number),
        expect.objectContaining({ autoDamageFormula: '2d10' }),
     );
   });

  it('uses default empty string for damage_type when not present', async () => {
    const options = baseOptions();
    const spell = makeSpell();
    delete spell.damage.damage_type;
    await executeSpellCast(spell, {}, options);
    const ctxArg = options.rollAttack.mock.calls[0][2];
    expect(ctxArg.damageType).toBe('');
   });

  it('handles null metaCtx', async () => {
    const options = baseOptions();
    await executeSpellCast(makeSpell(), null, options);
    expect(options.rollAttack).toHaveBeenCalled();
   });

   // ── DC (save) path ───────────────────────────────────────────

  describe('DC-based spells', () => {
    const dcOptions = () => ({ ...baseOptions() });

    it('calls rollDamage when spell has a dc', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue({ total: 12, rolls: [6, 6], modifier: 0 });
       await executeSpellCast(makeSpellWithDc('Burning Hands'), {}, options);
       expect(options.rollDamage).toHaveBeenCalled();
     });

    it('passes correct arguments to rollDamage', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue({ total: 15, rolls: [9, 6], modifier: 0 });
       await executeSpellCast(
          makeSpellWithDc('Burning Hands', 'wis'),
           {},
           options,
        );
       expect(options.rollDamage).toHaveBeenCalledWith(
          'Burning Hands',
           '2d10', // formula
           15, // total
           [9, 6], // rolls
           0, // modifier
           expect.objectContaining({
             targetName: 'Goblin',
             saveDc: 13,
             saveType: 'wis',
             dcSuccess: 'half',
            }),
         );
     });

    it('includes attackerName from playerStats in rollDamage context', async () => {
       const options = dcOptions();
       options.playerStats = makePlayerStats('Legolas');
       rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
       await executeSpellCast(makeSpellWithDc(), {}, options);
       const ctx = options.rollDamage.mock.calls[0][5];
       expect(ctx.attackerName).toBe('Legolas');
     });

    it('includes damageType from spell in rollDamage context', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
       await executeSpellCast(
          makeSpellWithDc('Cone of Cold', 'con', 'none', '2d8', 'cold'),
           {},
           options,
        );
       const ctx = options.rollDamage.mock.calls[0][5];
       expect(ctx.damageType).toBe('cold');
     });

    it('passes dc_success to rollDamage context', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue({ total: 11, rolls: [5, 6], modifier: 0 });
       await executeSpellCast(
          makeSpellWithDc('Hold Person', 'wis', 'none'),
           {},
           options,
        );
       const ctx = options.rollDamage.mock.calls[0][5];
       expect(ctx.dcSuccess).toBe('none');
     });

    it('does not call rollDamage when rollExpression returns null', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue(null);
       await executeSpellCast(makeSpellWithDc(), {}, options);
       expect(options.rollDamage).not.toHaveBeenCalled();
     });

    it('does not call rollAttack when spell has dc (save path)', async () => {
       const options = dcOptions();
       rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
       await executeSpellCast(makeSpellWithDc(), {}, options);
       expect(options.rollAttack).not.toHaveBeenCalled();
     });

    it('calls getTargetInfo before rolling damage for DC spell', async () => {
       const spy = vi.fn().mockResolvedValue({ name: 'Orc' });
       const options = dcOptions();
       options.getTargetInfo = spy;
       rollExpression.mockReturnValue({ total: 12, rolls: [6, 6], modifier: 0 });
       await executeSpellCast(makeSpellWithDc(), {}, options);
       expect(spy).toHaveBeenCalled();
     });

    it('uses undefined targetName when getTargetInfo resolves to null', async () => {
        const options = dcOptions();
        options.getTargetInfo.mockResolvedValue(null);
        rollExpression.mockReturnValue({ total: 12, rolls: [6, 6], modifier: 0 });
        await executeSpellCast(makeSpellWithDc(), {}, options);
        const ctx = options.rollDamage.mock.calls[0][5];
        expect(ctx.targetName).toBeUndefined();
      });

    it('adds +1 to saveDc when innateSorceryActive is true (DC path)', async () => {
        buffService.isInnateSorceryActive.mockReturnValue(true);
        const options = dcOptions();
        rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
        await executeSpellCast(makeSpellWithDc(), {}, options);
        const ctx = options.rollDamage.mock.calls[0][5];
        // base saveDc is 13, +1 for innate sorcery = 14
        expect(ctx.saveDc).toBe(14);
      });

    it('keeps saveDc unchanged when innateSorceryActive is false (DC path)', async () => {
        buffService.isInnateSorceryActive.mockReturnValue(false);
        const options = dcOptions();
        rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
        await executeSpellCast(makeSpellWithDc(), {}, options);
        const ctx = options.rollDamage.mock.calls[0][5];
        expect(ctx.saveDc).toBe(13);
      });
    });

   // ── Range validation integration ─────────────────────────────

  describe('range validation', () => {
    it('skips range check when attackerPos is missing', async () => {
       const options = baseOptions();
       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: null, targetPos: { gridX: 3, gridY: 5 } },
         );
       expect(computeEffectiveSpellRange).not.toHaveBeenCalled();
       expect(options.rollAttack).toHaveBeenCalled();
     });

    it('skips range check when targetPos is missing', async () => {
       const options = baseOptions();
       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: { gridX: 0, gridY: 0 }, targetPos: null },
         );
       expect(computeEffectiveSpellRange).not.toHaveBeenCalled();
       expect(options.rollAttack).toHaveBeenCalled();
     });

    it('calls range functions when both positions provided', async () => {
       const options = baseOptions();
       const attackerPos = { gridX: 0, gridY: 0 };
       const targetPos = { gridX: 2, gridY: 3 };

       computeEffectiveSpellRange.mockReturnValue(120);
       getDistanceFeet.mockReturnValue(50);
       computeRangeEffect.mockReturnValue({ mode: 'normal' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos, targetPos },
         );
       expect(computeEffectiveSpellRange).toHaveBeenCalled();
       expect(getDistanceFeet).toHaveBeenCalledWith(attackerPos, targetPos);
     });

    it('skips range check when effectiveRange is null', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(null);

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       expect(getDistanceFeet).not.toHaveBeenCalled();
       expect(computeRangeEffect).not.toHaveBeenCalled();
     });

    it('passes spell.range and metaCtx to computeEffectiveSpellRange', async () => {
       const options = baseOptions();
       const metaCtx = { metamagicDistant: true };
       const spell = makeSpell();
       spell.range = '120 feet';

       computeEffectiveSpellRange.mockReturnValue(240);
       getDistanceFeet.mockReturnValue(50);
       computeRangeEffect.mockReturnValue({ mode: 'normal' });

       await executeSpellCast(
          spell,
           metaCtx,
           { ...options, attackerPos: {}, targetPos: {} },
         );
       expect(computeEffectiveSpellRange).toHaveBeenCalledWith('120 feet', metaCtx);
     });

    it('passes undefined range to computeEffectiveSpellRange when spell has no range', async () => {
       const options = baseOptions();
       const spell = makeSpell(); // no .range property set

       computeEffectiveSpellRange.mockReturnValue(30);
       getDistanceFeet.mockReturnValue(50);
       computeRangeEffect.mockReturnValue({ mode: 'normal' });

       await executeSpellCast(
          spell,
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       expect(computeEffectiveSpellRange).toHaveBeenCalledWith(undefined, {});
     });

    it('sets isAutoMiss when rangeResult mode is miss', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(30);
       getDistanceFeet.mockReturnValue(100);
       computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Target too far' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       // rollAttack was called but with isAutoMiss context
       const ctx = options.rollAttack.mock.calls[0][2];
       expect(ctx.isAutoMiss).toBe(true);
       expect(ctx.rangeReason).toBe('Target too far');
     });

    it('does NOT set isAutoMiss when range mode is normal', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(120);
       getDistanceFeet.mockReturnValue(50);
       computeRangeEffect.mockReturnValue({ mode: 'normal' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       const ctx = options.rollAttack.mock.calls[0][2];
       expect(ctx).not.toHaveProperty('isAutoMiss');
     });

    it('does NOT set isAutoMiss when range mode is disadvantage', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(120);
       getDistanceFeet.mockReturnValue(150);
       computeRangeEffect.mockReturnValue({ mode: 'disadvantage' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       const ctx = options.rollAttack.mock.calls[0][2];
       expect(ctx).not.toHaveProperty('isAutoMiss');
     });

    it('passes featEffects to computeRangeEffect', async () => {
       const options = baseOptions();
       const feats = { ignoresLongRangeDisadvantage: true };

       computeEffectiveSpellRange.mockReturnValue(100);
       getDistanceFeet.mockReturnValue(150);
       computeRangeEffect.mockReturnValue({ mode: 'disadvantage' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {}, featEffects: feats },
         );
       expect(computeRangeEffect).toHaveBeenCalledWith(100, 150, expect.any(Object));
     });

    it('passes empty object to computeRangeEffect when featEffects undefined', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(100);
       getDistanceFeet.mockReturnValue(150);
       computeRangeEffect.mockReturnValue({ mode: 'normal' });

       await executeSpellCast(
          makeSpell(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       expect(computeRangeEffect).toHaveBeenCalledWith(100, 150, {});
     });

    it('sets isAutoMiss for DC-based spell when out of range', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(30);
       getDistanceFeet.mockReturnValue(80);
       computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
       rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

       await executeSpellCast(
          makeSpellWithDc(),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       const ctx = options.rollDamage.mock.calls[0][5];
       expect(ctx.isAutoMiss).toBe(true);
       expect(ctx.rangeReason).toBe('Out of range');
     });

    it('still calls rollDamage with autoMiss context for DC spell', async () => {
       const options = baseOptions();
       computeEffectiveSpellRange.mockReturnValue(20);
       getDistanceFeet.mockReturnValue(50);
       computeRangeEffect.mockReturnValue({ mode: 'miss' });
       rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

       await executeSpellCast(
          makeSpellWithDc('Witch Bolt'),
           {},
           { ...options, attackerPos: {}, targetPos: {} },
         );
       expect(options.rollDamage).toHaveBeenCalled();
    });
  });

  // ── Casting time: setRuntimeValue for '1 action' ───────────────

  describe('casting_time side-effects', () => {
    it('calls setRuntimeValue when casting_time is "1 action"', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.casting_time = '1 action';
      await executeSpellCast(spell, {}, options);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Aragorn', 'lastActionSpellCast', 1, undefined,
      );
    });

    it('does not call setRuntimeValue when casting_time is not "1 action"', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.casting_time = '1 bonus action';
      await executeSpellCast(spell, {}, options);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not call setRuntimeValue when casting_time is undefined', async () => {
      const options = baseOptions();
      const spell = makeSpell(); // no casting_time set
      await executeSpellCast(spell, {}, options);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes campaignName to setRuntimeValue', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.casting_time = '1 action';
      await executeSpellCast(spell, {}, { ...options, campaignName: 'Forgotten Realms' });
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Aragorn', 'lastActionSpellCast', 1, 'Forgotten Realms',
      );
    });
  });

  // ── Blocked spellcasting ────────────────────────────────────────

  describe('blocked spellcasting', () => {
    it('returns undefined when a buff blocks spellcasting', async () => {
      buffService.getActiveBuffs.mockReturnValue([{ blocksSpellcasting: true }]);
      const options = baseOptions();
      const result = await executeSpellCast(makeSpell(), {}, options);
      expect(result).toBeUndefined();
      expect(options.rollAttack).not.toHaveBeenCalled();
    });

    it('does not block when no buffs are active', async () => {
      buffService.getActiveBuffs.mockReturnValue([]);
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      expect(options.rollAttack).toHaveBeenCalled();
    });

    it('does not block when active buff does not block spellcasting', async () => {
      buffService.getActiveBuffs.mockReturnValue([{ name: 'Haste' }]);
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      expect(options.rollAttack).toHaveBeenCalled();
    });
  });

  // ── Cantrip range bonus ─────────────────────────────────────────

  describe('cantrip range bonus', () => {
    it('adds cantripRangeBonus to effectiveRange for level 0 spell', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 0;
      spell.range = '30 feet';

      computeEffectiveSpellRange.mockReturnValue(30);
      rangeToFeet.mockReturnValue(30);
      getDistanceFeet.mockReturnValue(25);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {}, featEffects: { cantripRangeBonus: 30 } },
      );

      // rangeToFeet should have been called for the cantrip bonus logic
      expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
      // computeRangeEffect should be called with the boosted range (30 + 30 = 60)
      expect(computeRangeEffect).toHaveBeenCalledWith(60, 25, { cantripRangeBonus: 30 });
    });

    it('does not add cantripRangeBonus when spell level is not 0', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 1;
      spell.range = '30 feet';

      computeEffectiveSpellRange.mockReturnValue(30);
      rangeToFeet.mockReturnValue(30);
      getDistanceFeet.mockReturnValue(25);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {}, featEffects: { cantripRangeBonus: 30 } },
      );

      // rangeToFeet should NOT be called because level !== 0
      expect(rangeToFeet).not.toHaveBeenCalled();
      // computeRangeEffect should be called with the unboosted range (30)
      expect(computeRangeEffect).toHaveBeenCalledWith(30, 25, { cantripRangeBonus: 30 });
    });

    it('does not add cantripRangeBonus when cantripRangeBonus is 0', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 0;
      spell.range = '30 feet';

      computeEffectiveSpellRange.mockReturnValue(30);
      rangeToFeet.mockReturnValue(30);
      getDistanceFeet.mockReturnValue(25);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {}, featEffects: { cantripRangeBonus: 0 } },
      );

      expect(rangeToFeet).not.toHaveBeenCalled();
      expect(computeRangeEffect).toHaveBeenCalledWith(30, 25, { cantripRangeBonus: 0 });
    });

    it('does not add cantripRangeBonus when baseRange < 10', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 0;
      spell.range = '5 feet';

      computeEffectiveSpellRange.mockReturnValue(5);
      rangeToFeet.mockReturnValue(5);
      getDistanceFeet.mockReturnValue(3);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {}, featEffects: { cantripRangeBonus: 30 } },
      );

      // rangeToFeet IS called (the check runs), but the bonus is NOT applied
      expect(rangeToFeet).toHaveBeenCalledWith('5 feet');
      // effectiveRange stays at 5 (no bonus added)
      expect(computeRangeEffect).toHaveBeenCalledWith(5, 3, { cantripRangeBonus: 30 });
    });

    it('does not add cantripRangeBonus when baseRange is null', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 0;
      spell.range = 'touch';

      computeEffectiveSpellRange.mockReturnValue(5);
      rangeToFeet.mockReturnValue(null);
      getDistanceFeet.mockReturnValue(3);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {}, featEffects: { cantripRangeBonus: 30 } },
      );

      expect(rangeToFeet).toHaveBeenCalledWith('touch');
      // effectiveRange stays at 5 (no bonus added)
      expect(computeRangeEffect).toHaveBeenCalledWith(5, 3, { cantripRangeBonus: 30 });
    });

    it('does not add cantripRangeBonus when featEffects is undefined', async () => {
      const options = baseOptions();
      const spell = makeSpell();
      spell.level = 0;
      spell.range = '30 feet';

      computeEffectiveSpellRange.mockReturnValue(30);
      rangeToFeet.mockReturnValue(30);
      getDistanceFeet.mockReturnValue(25);
      computeRangeEffect.mockReturnValue({ mode: 'normal' });

      await executeSpellCast(
        spell, {}, { ...options, attackerPos: {}, targetPos: {} },
      );

      expect(rangeToFeet).not.toHaveBeenCalled();
      expect(computeRangeEffect).toHaveBeenCalledWith(30, 25, {});
    });
  });

  // ── Innate Sorcery advantage ────────────────────────────────────

  describe('innate sorcery advantage', () => {
    it('passes forcedMode: advantage when innateSorceryActive is true', async () => {
      buffService.isInnateSorceryActive.mockReturnValue(true);
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      const ctx = options.rollAttack.mock.calls[0][2];
      expect(ctx.forcedMode).toBe('advantage');
    });

    it('does not pass forcedMode when innateSorceryActive is false', async () => {
      buffService.isInnateSorceryActive.mockReturnValue(false);
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      const ctx = options.rollAttack.mock.calls[0][2];
      expect(ctx.forcedMode).toBeUndefined();
    });

    it('preserves existing forcedMode when innateSorceryActive is true', async () => {
      buffService.isInnateSorceryActive.mockReturnValue(true);
      const options = baseOptions();
      await executeSpellCast(makeSpell(), { forcedMode: 'disadvantage' }, options);
      const ctx = options.rollAttack.mock.calls[0][2];
      // forcedMode from metaCtx is preserved (not overridden)
      expect(ctx.forcedMode).toBe('disadvantage');
    });
  });

  // ── Post-cast error handling ────────────────────────────────────

  describe('post-cast error handling', () => {
    it('handles rejection from triggerPostCastRiderSaves', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      postCastRiderService.triggerPostCastRiderSaves.mockRejectedValue(new Error('rider save failed'));
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      // Wait for the .catch() to fire (it's async)
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith('[spellCast] Post-cast rider save failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles rejection from triggerPostCastSelfHeals', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      postCastHealService.triggerPostCastSelfHeals.mockRejectedValue(new Error('self-heal failed'));
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      // Wait for the .catch() to fire (it's async)
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith('[spellCast] Post-cast self-heal failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles rejections from both post-cast services', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      postCastRiderService.triggerPostCastRiderSaves.mockRejectedValue(new Error('rider failed'));
      postCastHealService.triggerPostCastSelfHeals.mockRejectedValue(new Error('heal failed'));
      const options = baseOptions();
      await executeSpellCast(makeSpell(), {}, options);
      // Wait for both .catch() handlers to fire
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith('[spellCast] Post-cast rider save failed:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('[spellCast] Post-cast self-heal failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
