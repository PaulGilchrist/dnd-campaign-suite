// @maintained-by-ai
// natural20 + celestial lane: owns attackRollDamageSteps.js steps[13]/[14] (buildNatural20-
// BonusesStep / buildCelestialRevelationStep, attackRollBonuses.js:387/:426).
//
// PRESERVED cites (#1029: automationBonuses cut its n20 condition block because THIS file is
// the strict condition-superset owner — all 4 truth arms of `isNatural20 || d20Roll >= 20`
// plus missing-actions + both false-side arms, incl d20=19/9/undefined). Do not trim these.
//
// Applied recs:
//   #1029/#1022 applied (SUPERSEDED by #1035 FIX): same_as_attack / force / missing
//     legs were byte-identical ONLY because the step never read extraDamageType
//     (dead-metadata finding logged as #1035). Now consumed: force-X appends the
//     authored type, same_as_attack appends ctx.attack.damageType, missing is a
//     zero-extra gate with console.error. Fold replaced by one pin per shape.
//   #1029 fold-CANON cited: app/stamp exact legs here are CANON for dice riders (cla048 uses
//     REAL roller, constants-only resolve-first — NdM bytes are owned here, per cla048's own
//     lane-split header :9-13). automationBonuses' Inner Radiance app+stamp folded here:
//     its stamp is oncePerTurn:true — inert vs disk truth, so its app bytes are NOT canonical.
//   #1023 applied: two toBeGreaterThan range legs (:533/:715) and the duplicate '3' stamp
//     leg (:536, subsumed by the exact stamp on the app leg) removed/absorbed into exact
//     full-acc pins + exact stamp bytes (#973/#829); oncePerTurn latch-inert kept as the
//     ONLY falsifier of the stamp-guard (:449).
//   #1032 class dead-mock purge: rollExpressionDoubled/Maximized, attack-rider option,
//     bardic-prompt, resourceCheck, rangeValidation, savePrompt, mastery, automationService,
//     applyDamage mocks deleted — this lane provably never reaches them (cla048 runs the
//     real graph with a subset and passes; bare ctx needs no hit/distance/rider flags).
//   #1007 afterEach(vi.restoreAllMocks) added; #1026 stub made faithful (constants are
//     UNROLLABLE in the real roller -> null, flat `typeof expr === 'number'` branch :414
//     now honestly exercised; old stub fabricating total:6 for '5' removed); #1021
//     campaign-keyed stamp bytes pinned on every write; #815 mid-value math hand-derived once
//     in the stub (d8→5, d6→4, d4→3, d12→7); #842 multi-rider loop falsifier added.
//
// old->new map: cond t1-t7 -> c1-c6 (#6≡#5 false-side low-value fold);
// n20 handler t1 -> exact bytes; t2+t5+t6+t7 -> dice fold (byte-identical per #1022);
// t3 -> strengthened exact acc; t4 -> + zero-stamp pin.
// celestial t1/t3 -> fold (both feed the same riders.length/rider-filter guard :434-445);
// t5+t12 -> exact dice-app fold (CANON, cited); t6+t10+t8 -> one stamp-leg per rider name
// (all share code path :467; distinct names still covered: Wings/Radiance/Shroud);
// t7 -> dropped (rider-mismatch duplicate of automationBonuses :444, weaker there too);
// t9 -> renamed (roll-null = zero-guard); t11 -> + never-stamps pin.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

// #1035 census source: imported, NEVER retyped (drift-throw in the disk-row pin).
const feats2024 = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'));
const diskN20Automation = feats2024
  .find(f => f.index === 'boon-of-irresistible-offense')
  .benefits.find(b => b.name === 'Overwhelming Strike').automation;

// Faithful diceRoller stub (#1026/#815): NdM → each die floor(M/2)+1; constants are
// UNROLLABLE (real roller returns null) so flat-value paths are honestly exercised.
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const base = String(formula ?? '').replace(/\s*\[.*?\]\s*/g, '').trim();
    const match = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return null;
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
    return { total: rolls.reduce((s, r) => s + r, 0) + mod, rolls, modifier: mod };
  }),
  parseConstant: vi.fn((formula) => {
    if (!formula) return null;
    const stripped = String(formula).replace(/\s*\[.*?\]\s*/g, '').trim();
    return /^[+-]?\d+$/.test(stripped) ? parseInt(stripped, 10) : null;
  }),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
const { featureModules } = await import('./features/index.js');
const { getActiveBuffs } = await import('../../automation/common/buffToggle.js');

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 3 }],
      automation: { actions: [], passives: [] },
      level: 5,
      proficiency: 3,
    },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

// Minimal passives ctx for the celestial step (bare ctx suffices — targetName-gated).
function celCtx(passives, overrides = {}) {
  return makeCtx({
    playerStats: { name: 'TestChar', automation: { passives } },
    ...overrides,
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe('buildAttackRollDamageSteps - natural20Bonuses, celestialRevelation', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    featureModules.length = 0;
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ──────────────────────────────────────────────────────────────
  // natural20Bonuses (index 13) — PRESERVED condition superset (#1029)
  // ──────────────────────────────────────────────────────────────

  describe('natural20Bonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[13].condition(makeCtx(o));

      it('true when ctx.isNatural20', () => expect(cond({
        isNatural20: true,
        playerStats: { automation: { actions: [] } },
      })).toBe(true));

      it('true when isNatural20 is false but d20Roll is 20 (fallback threshold)', () => expect(cond({
        isNatural20: false,
        d20Roll: 20,
        playerStats: { automation: { actions: [] } },
      })).toBe(true));

      it('false when isNatural20 is false and no d20Roll was rolled', () => expect(cond({
        isNatural20: false,
        playerStats: { automation: { actions: [] } },
      })).toBe(false));

      it('false when d20Roll is 19 (below threshold)', () => expect(cond({
        isNatural20: false,
        d20Roll: 19,
        playerStats: { automation: { actions: [] } },
      })).toBe(false));

      it('false when d20Roll is 9 (below threshold)', () => expect(cond({
        isNatural20: false,
        d20Roll: 9,
        playerStats: { automation: { actions: [] } },
      })).toBe(false));

      it('false when automation.actions is missing', () => expect(cond({
        isNatural20: true,
        playerStats: { automation: {} },
      })).toBe(false));
    });

    describe('handler', () => {
      it('returns ctx data unchanged when no natural_20_attack_roll actions (exact bytes)', async () => {
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          playerStats: { automation: { actions: [] } },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });

      // #1035 FIXED: extraDamageType is consumed — force-X appends the authored
      // type lowercased (pre-fix dead byte here was '+ 1d6 [Overwhelming Strike]',
      // extraDamageType 'force' discarded). #1029's byte-identical three-shape fold
      // is VOID post-fix: same_as_attack / explicit / missing now diverge (pinned
      // below, mutually distinguishable #1348).
      it('dice bonus with extraDamageType=force rolls and appends + 1d6 [force] (exact acc)', async () => {
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '1d6',
                  extraDamageType: 'force',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [force]', total: 15, rolls: [8, 3, 4] });
        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      it('increased_ability_score flat + 5 appends authored type [thunder] (#1035: type consumed; flat branch :424-429)', async () => {
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          attack: { damageType: 'Slashing' },
          playerStats: {
            abilities: [{ name: 'Strength', bonus: 5 }],
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: 'increased_ability_score',
                  extraDamageType: 'thunder',
                  abilityIncreased: 'Strength',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        // Flat branch (:424-429): constants are unrollable → total gains expr itself (+5).
        // Pre-fix flip (#1035): label was the dead '[Overwhelming Strike]' name byte.
        expect(r.data).toEqual({ formula: '1d8+3 + 5 [thunder]', total: 16, rolls: [8, 3] });
      });

      it('increased_ability_score with unknown ability appends + 0 [cold] and total unchanged', async () => {
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: 5 }],
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: 'increased_ability_score',
                  extraDamageType: 'cold',
                  abilityIncreased: 'Strength',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 0 [cold]', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      // #1035 same_as_attack arm: resolves to the attack's own damage type
      // (byte-style mirrors frenzyDamageLabel :71-74 — attack-less ctx falls
      // back to 'Slashing', the same default the frenzy rider uses).
      it('extraDamageType=same_as_attack appends the attack type: + 2d8 [piercing] (exact acc)', async () => {
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          attack: { damageType: 'Piercing' },
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Mirror Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '2d8',
                  extraDamageType: 'same_as_attack',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 2d8 [piercing]', total: 21, rolls: [8, 3, 5, 5] });
        expect(rollExpression).toHaveBeenCalledWith('2d8');
      });

      // #1035 missing arm: no extraDamageType = unauthored row — ZERO extra,
      // ctx bytes byte-intact, loud console.error. Pre-fix this appended
      // ' + 5 [Overwhelming Strike]' on metadata whose type was discarded.
      it('missing extraDamageType appends ZERO extra and logs console.error (ctx byte-intact)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          playerStats: {
            abilities: [{ name: 'Strength', bonus: 5 }],
            automation: {
              actions: [
                {
                  name: 'Broken Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: 'increased_ability_score',
                  abilityIncreased: 'Strength',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(String(errSpy.mock.calls[0][0])).toContain('Broken Strike');
      });

      // #1348 distinguishability: two riders sharing one dice byte, differing ONLY
      // in extraDamageType, land mutually-exclusive type bytes (pre-fix both were
      // identical — every label was the action name, the defect fingerprint).
      it('#1348: same 1d4 dice, force vs same_as_attack land distinct type bytes', async () => {
        const act = (name, extraDamageType) => ({
          name, type: 'damage_bonus', trigger: 'natural_20_attack_roll',
          extraDamageExpression: '1d4', extraDamageType,
        });
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          attack: { damageType: 'Piercing' },
          playerStats: {
            automation: { actions: [act('Force Rider', 'force'), act('Mirror Rider', 'same_as_attack')] },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        expect(r.data.formula).toBe('1d8+3 + 1d4 [force] + 1d4 [piercing]');
        expect(r.data.total).toBe(17); // 11 + 3 + 3 (d4→3 stub)
        expect(r.data.formula).not.toMatch(/Force Rider|Mirror Rider/);
      });

      // #1035 real-disk-row pin (imported bytes, #1365 law): the ONLY natural_20
      // row in the corpus — 2024 feats.json Boon Of Irresistible Offense. These
      // three asserts are the drift-throw; if disk bytes change, this pin fails
      // BEFORE any expected-formula byte is trusted.
      it('DISK row boon-of-irresistible-offense: same_as_attack + increased_ability_score appends + 4 [slashing] (exact acc)', async () => {
        expect(diskN20Automation.trigger).toBe('natural_20_attack_roll');
        expect(diskN20Automation.extraDamageType).toBe('same_as_attack');
        expect(diskN20Automation.extraDamageExpression).toBe('increased_ability_score');
        const r = await steps[13].handler(makeCtx({
          isNatural20: true,
          attack: { damageType: 'Slashing' },
          playerStats: {
            abilities: [{ name: 'Strength', bonus: 4 }, { name: 'Dexterity', bonus: 3 }],
            automation: { actions: [{ name: 'Overwhelming Strike', ...diskN20Automation }] },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
        // increased_ability_score (no abilityIncreased) → max(STR 4, DEX 3) = 4 flat;
        // same_as_attack → the attack's [slashing]. Pre-fix capture (#1035, this same
        // imported row): '1d8+3 + 4 [Overwhelming Strike]' — type byte discarded.
        expect(r.data).toEqual({ formula: '1d8+3 + 4 [slashing]', total: 15, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // celestialRevelation (index 14) — dice-rider app/stamp CANON (cla048 cite: NdM
  // bytes are sibling-owned; cla048 owns flat proficiency-token resolve + buff→rider
  // pairing success, zero dice-app here). Guard suite is honest here: every guard leg
  // sets targetName so it REACHES its branch (the automationBonuses "CANON" guard legs
  // omit targetName and all short-circuit at the :433 target guard — fold-CANON claim
  // void, reported). Zero-guard and latch-inert kept per #1029.
  // ──────────────────────────────────────────────────────────────

  describe('celestialRevelation step', () => {
    const rider = (extra = {}) => ({
      type: 'attack_rider',
      trigger: 'hit',
      damageExpression: '1d8',
      damageType: 'radiant',
      name: 'Heavenly Wings',
      oncePerTurn: true, // disk truth per cla048 data lock :196-200
      ...extra,
    });

    it('returns empty data when no targetName is set (no roll, no stamp)', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      const r = await steps[14].handler(celCtx([rider()], { formula: '1d8+3', total: 11, rolls: [8, 3] }));
      expect(r.data).toEqual({});
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Each guard leg below sets targetName + buffs so it REACHES its named branch —
    // automationBonuses' sibling guard legs omit targetName and all short-circuit here.
    it('returns empty data when passives carry no hit-triggered attack_rider with an expression', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      const r = await steps[14].handler(celCtx([
        { type: 'passive_rule', effect: 'some-effect' },
        { type: 'attack_rider', name: 'Heavenly Wings', damageType: 'radiant' },
      ], { targetName: 'Goblin' }));
      expect(r.data).toEqual({});
      expect(getActiveBuffs).not.toHaveBeenCalled();
    });

    it('returns empty data when no active buff matches the celestial registry', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Bless' }]);
      const r = await steps[14].handler(celCtx([rider()], { targetName: 'Goblin' }));
      expect(r.data).toEqual({});
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('rider-mismatch: wings buff active but passives carry only Necrotic Shroud → empty data', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      const r = await steps[14].handler(celCtx(
        [rider({ name: 'Necrotic Shroud', damageType: 'necrotic' })],
        { targetName: 'Goblin' },
      ));
      expect(r.data).toEqual({});
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('oncePerTurn latch-inert: stamp equals round → empty data, no roll, no stamp', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      getCurrentCombatRound.mockReturnValue(2);
      getRuntimeValue.mockImplementation((_key, prop) => (prop === '_Heavenly_Wings_usedRound' ? 2 : null));
      const r = await steps[14].handler(celCtx([rider()], { targetName: 'Goblin' }));
      expect(r.data).toEqual({});
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Covers BOTH discard branches of :458-462: roller null + unparseable token.
    it('unresolvable expression (roller null, parseConstant null) → empty data, no fabricated bonus', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      const r = await steps[14].handler(celCtx(
        [rider({ damageExpression: 'not_a_dice' })],
        { targetName: 'Goblin' },
      ));
      expect(r.data).toEqual({});
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('Heavenly Wings rolls 1d8 and stamps at round 3; second rider skipped when buff inactive (exact acc)', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
      getCurrentCombatRound.mockReturnValue(3);
      const r = await steps[14].handler(celCtx([
        rider(),
        rider({ name: 'Inner Radiance', damageExpression: '1d6' }),
      ], { targetName: 'Goblin', formula: '1d8+3', total: 11, rolls: [8, 3] }));
      expect(r.data).toEqual({ formula: '1d8+3 + 1d8 [radiant]', total: 16, rolls: [8, 3, 5] });
      expect(rollExpression).toHaveBeenCalledTimes(1);
      expect(rollExpression).toHaveBeenCalledWith('1d8');
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_Heavenly_Wings_usedRound', 3, 'test-campaign');
    });

    it('Inner Radiance rolls 1d6 [radiant] (exact acc, CANON shared with automationBonuses)', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Inner Radiance' }]);
      const r = await steps[14].handler(celCtx(
        [rider({ name: 'Inner Radiance', damageExpression: '1d6' })],
        { targetName: 'Goblin', formula: '1d8', total: 5, rolls: [5] },
      ));
      expect(r.data).toEqual({ formula: '1d8 + 1d6 [radiant]', total: 9, rolls: [5, 4] });
    });

    it('Necrotic Shroud rolls 1d4 [necrotic] (exact acc)', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
      const r = await steps[14].handler(celCtx(
        [rider({ name: 'Necrotic Shroud', damageExpression: '1d4', damageType: 'necrotic' })],
        { targetName: 'Orc', formula: '1d6+2', total: 8, rolls: [6, 2] },
      ));
      expect(r.data).toEqual({ formula: '1d6+2 + 1d4 [necrotic]', total: 11, rolls: [6, 2, 3] });
    });
  });
});
