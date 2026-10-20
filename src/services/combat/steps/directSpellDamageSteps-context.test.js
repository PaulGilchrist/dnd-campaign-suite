// @maintained-by-ai
// Generic spellContext lane — directSpellDamageSteps.js steps[1] (direct-spell path):
// base-formula selection + the three adders this step folds (Empowered Evocation,
// Blessed Strikes, Elemental Affinity). spellContext only BUILDS formulas; it must
// never roll, log, or write runtime state — every such callee throws a sentinel here.
//
// directSpellDamageSteps family split (same module, other seams):
//   directSpellDamageSteps-cla120-empowered-evocation.test.js  pre-baked '[EE]' dedupe guard (CLA-120) — owned there
//   directSpellDamageSteps-radiantSoul.test.js                 CLA-279 '[Radiant Soul]' dedupe/append + consumption flag
//   directSpellDamageSteps-rolling.test.js                     spellRollDamage: roll dispatch + crit/overchannel lanes
//   directSpellDamageSteps-riders.test.js                      spellFeatureRiders: featureModules dispatch
//   directSpellDamageSteps-overchannel.test.js                 spellOverchannel + spellProceedToDamage
//   directSpellDamageSteps-structure.test.js                   step count/names/subscribe-emit chain (incl. 'spellContext' index)
//   THIS FILE                                                  spellContext condition, formula selection, EE/BS/EA append+skip arms
//
// PRESERVED cites (#1042 split-table, refreshed after fold):
//   old :142-152 '8d6'→'8d6 + 3 [Empowered Evocation]' PASS control  -> new EE truth-table row 1 (exact bytes kept)
//   old :166-176 Necromancy gate stays zero ('8d6')                      -> new EE truth-table row 3 (exact bytes kept)
//
// old -> new map (27 tests -> 7):
//   condition trio (:101-115)                          -> 1 it ('!!ctx.playerStats' is one operator; true + null + missing asserted together)
//   basic-formula trio (:119-138)                     -> formula-selection it.each (+ new '0' fallback arm)
//   EE append (:142-152) + lowercase (:154-164)       -> EE truth-table rows 1-2
//   EE necromancy (:166-176) + mod-0 (:178-188) + no-feature (:190-200) -> EE truth-table falsifier rows 3-5
//   BS append (:204-224) + default-Wisdom (:226-245)   -> BS table rows 1-2
//   BS mod-0/non-cantrip/no-feature/actions-null/ability-missing/negative (:247-390) -> BS table falsifier rows
//   BS pair EE+BS (:319-346) and EA pair EE+EA (:530-549) -> consolidated into full-chain order test (all three adders live, distinct +2/+3/+4)
//   EA append (:394-426)                               -> EA table rows 1-2 (cited bytes '8d6 + 3'/'4d6 + 2' kept)
//   EA skips (:428-528)                              -> EA table falsifier rows (+ new non-string-chosen arm)
//   NEW: upgraded-feature exclusion, Divine Strike-option exclusion, multi-option
//        campaign-keyed runtime gate, full-result toEqual, throwing lane sentinels
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Formula-build-only lane: any roll here is a lane violation (#1042 throwing rollers).
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => { throw new Error('spellContext must not roll — roll legs owned by directSpellDamageSteps-rolling.test.js'); }),
  rollExpressionDoubled: vi.fn(() => { throw new Error('spellContext must not roll'); }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('spellContext must not roll'); }),
}));

// Live riders read by applyEmpoweredEvocation; inert by default, armed per EE row.
vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => { throw new Error('spellContext must not log — log legs owned by directSpellDamageSteps-overchannel.test.js'); }),
}));

// Reached by applyBlessedStrikes on every cantrip call (optKey choice read).
// null keeps the adder live only on length-1 option lists. setRuntimeValue throws:
// consumption-flag writes are owned by the rolling/radiantSoul lanes.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => { throw new Error('spellContext must not write runtime state — consumption flags owned by the rolling lane'); }),
}));

// Read by applyElementalAffinity; undefined keeps the adder off by default.
vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

// Module-load dependency only — spellContext never reads the registry; riders lane owns it.
vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

const { buildDirectSpellDamageSteps } = await import('./directSpellDamageSteps.js');
const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');
const { getChosenRuntimeValue } = await import('../../../services/automation/common/choiceStorage.js');
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

const EE_FEATURE = [{ type: 'empowered_evocation', name: 'Empowered Evocation' }];
const POTENT = { type: 'damage_bonus', options: ['Potent Spellcasting (Spellcasting Ability)'], abilityName: 'Wisdom' };

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestWizard',
      abilities: [],
      automation: { actions: [], passives: [] },
    },
    campaignName: 'test-campaign',
    ...overrides,
  };
}

// Neutral playerStats so exactly one adder is live per table row (#948).
function stats(name, abilities, actions = []) {
  return { name, abilities, automation: { actions, passives: [] } };
}

describe('spellContext', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks(); // keeps factory impls; rows re-arm every input they depend on
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition runs the step only when ctx.playerStats exists', () => {
    expect(steps[1].condition(makeCtx({ playerStats: { name: 'Test' } }))).toBe(true);
    expect(steps[1].condition(makeCtx({ playerStats: null }))).toBe(false);
    const missing = makeCtx();
    delete missing.playerStats;
    expect(steps[1].condition(missing)).toBe(false);
  });

  describe('formula selection', () => {
    it.each([
      ['attack.damage wins over autoFormulaOverride', { attack: { damage: '8d6' }, autoFormulaOverride: '4d10' }, '8d6'],
      ['falls back to autoFormulaOverride when attack.damage is absent', { attack: {}, autoFormulaOverride: '4d10' }, '4d10'],
      ['defaults to "0" when neither channel supplies a formula', { attack: {} }, '0'],
    ])('%s', async (_label, overrides, expected) => {
      const result = await steps[1].handler(makeCtx(overrides));
      expect(result).toEqual({ data: { formula: expected } });
    });
  });

  describe('Empowered Evocation', () => {
    it.each([
      // PASS control (cited :142-152): unmarked '8d6' + live INT 3 evocation -> exact append.
      ['appends INT mod for Evocation school', 'Evocation', EE_FEATURE, 3, '8d6 + 3 [Empowered Evocation]'],
      ['school match is case-insensitive', 'evocation', EE_FEATURE, 2, '8d6 + 2 [Empowered Evocation]'],
      // Falsifiers — every other precondition stays live, so only the named guard can flip the byte (#948).
      ['Necromancy school gate stays zero (cited :166-176)', 'Necromancy', EE_FEATURE, 3, '8d6'],
      ['INT mod of 0 is not appended', 'Evocation', EE_FEATURE, 0, '8d6'],
      ['no Empowered Evocation feature means no append', 'Evocation', [], 3, '8d6'],
    ])('%s', async (_label, school, features, intMod, expected) => {
      vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(features);
      vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(intMod);
      const result = await steps[1].handler(makeCtx({
        attack: { damage: '8d6' },
        autoDamageSchool: school,
      }));
      expect(result).toEqual({ data: { formula: expected } });
    });
  });

  describe('Blessed Strikes (Potent Spellcasting cantrip adder)', () => {
    it.each([
      ['appends named Wisdom modifier on cantrips', true, [{ name: 'Wisdom', bonus: 4 }], [POTENT], '1d10 + 4 [Blessed Strikes]'],
      ['defaults to Wisdom when abilityName is unset', true, [{ name: 'Wisdom', bonus: 3 }], [{ type: 'damage_bonus', options: ['Potent Spellcasting (Spellcasting Ability)'] }], '1d10 + 3 [Blessed Strikes]'],
      ['upgraded feature rows are excluded (!a.upgrades guard)', true, [{ name: 'Wisdom', bonus: 4 }], [{ ...POTENT, name: 'Improved Blessed Strikes', upgrades: 'Blessed Strikes' }], '1d10'],
      ['Divine Strike-only options are ignored on the spell lane', true, [{ name: 'Wisdom', bonus: 4 }], [{ type: 'damage_bonus', options: ['Divine Strike'] }], '1d10'],
      ['non-cantrips never receive the adder', false, [{ name: 'Wisdom', bonus: 4 }], [POTENT], '1d10'],
      ['zero ability modifier is not appended', true, [{ name: 'Wisdom', bonus: 0 }], [POTENT], '1d10'],
      ['negative ability modifier clamps to zero (Math.max)', true, [{ name: 'Wisdom', bonus: -2 }], [POTENT], '1d10'],
      ['missing named ability yields no append', true, [{ name: 'Intelligence', bonus: 5 }], [{ ...POTENT, abilityName: 'Charisma' }], '1d10'],
      ['null automation.actions is handled without throwing', true, [{ name: 'Wisdom', bonus: 4 }], null, '1d10'],
    ])('%s', async (_label, isCantrip, abilities, actions, expected) => {
      const result = await steps[1].handler(makeCtx({
        isCantrip,
        attack: { damage: '1d10' },
        playerStats: stats('TestCleric', abilities, actions),
      }));
      expect(result).toEqual({ data: { formula: expected } });
    });

    it('multi-option features are gated on the campaign-keyed runtime choice (#1021)', async () => {
      const ctx = makeCtx({
        isCantrip: true,
        attack: { damage: '1d10' },
        playerStats: stats('TestCleric', [{ name: 'Wisdom', bonus: 3 }], [{ type: 'damage_bonus', options: ['Divine Strike', 'Potent Spellcasting'] }]),
      });

      // Unchosen: the divine-strike half could apply instead, so the spell lane must stay out.
      vi.mocked(getRuntimeValue).mockReturnValue(null);
      expect(await steps[1].handler(ctx)).toEqual({ data: { formula: '1d10' } });

      // Chosen 'Potent Spellcasting': appends, and the read is keyed to this campaign.
      vi.mocked(getRuntimeValue).mockReturnValue('Potent Spellcasting');
      expect(await steps[1].handler(ctx)).toEqual({ data: { formula: '1d10 + 3 [Blessed Strikes]' } });
      expect(getRuntimeValue).toHaveBeenCalledWith('TestCleric', '_PotentSpellcasting_option', 'test-campaign');
    });
  });

  describe('Elemental Affinity', () => {
    it.each([
      ['appends CHA mod on exact damage-type match', '8d6', 'Fire', 'Fire', [{ name: 'Charisma', bonus: 3 }], '8d6 + 3 [Elemental Affinity]'],
      ['damage-type match is case-insensitive', '4d6', 'Fire', 'fire', [{ name: 'Charisma', bonus: 2 }], '4d6 + 2 [Elemental Affinity]'],
      ['no chosen type means no append', '8d6', undefined, 'Fire', [{ name: 'Charisma', bonus: 3 }], '8d6'],
      ['non-string chosen value is ignored', '8d6', { type: 'Fire' }, 'Fire', [{ name: 'Charisma', bonus: 3 }], '8d6'],
      ['mismatched damage type is skipped', '8d6', 'Fire', 'Cold', [{ name: 'Charisma', bonus: 3 }], '8d6'],
      ['attack without damageType is skipped', '8d6', 'Fire', undefined, [{ name: 'Charisma', bonus: 3 }], '8d6'],
      ['zero CHA mod is not appended', '6d6', 'Lightning', 'Lightning', [{ name: 'Charisma', bonus: 0 }], '6d6'],
      ['negative CHA mod clamps to zero (Math.max)', '4d6', 'Acid', 'Acid', [{ name: 'Charisma', bonus: -2 }], '4d6'],
      ['missing Charisma ability yields no append', '3d6', 'Poison', 'Poison', [{ name: 'Intelligence', bonus: 3 }], '3d6'],
    ])('%s', async (_label, damage, chosen, damageType, abilities, expected) => {
      vi.mocked(getChosenRuntimeValue).mockReturnValue(chosen);
      const result = await steps[1].handler(makeCtx({
        attack: { damage, damageType },
        playerStats: stats('TestSorcerer', abilities),
      }));
      expect(result).toEqual({ data: { formula: expected } });
    });
  });

  it('folds Empowered Evocation, Blessed Strikes, then Elemental Affinity in fixed order', async () => {
    // All three adders live with distinct modifiers (2/3/4) — any reorder, drop,
    // or double-append breaks the exact full-formula bytes.
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(EE_FEATURE);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(2);
    vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');
    const result = await steps[1].handler(makeCtx({
      isCantrip: true,
      attack: { damage: '1d10', damageType: 'Fire' },
      autoDamageSchool: 'Evocation',
      playerStats: stats('TestWizard', [
        { name: 'Intelligence', bonus: 2 },
        { name: 'Wisdom', bonus: 3 },
        { name: 'Charisma', bonus: 4 },
      ], [POTENT]),
    }));
    expect(result).toEqual({ data: { formula: '1d10 + 2 [Empowered Evocation] + 3 [Blessed Strikes] + 4 [Elemental Affinity]' } });
  });
});
