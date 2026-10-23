// @maintained-by-ai
// #1241-family silent-zero sweep (fix#241 census): the six flagged rider branches of
// attackRollBonuses.js now decline UNRECOGNIZED shapes LOUD with zero contribution
// instead of vanishing at rollExpression-null. Mirrors the fix#241 frenzy lane shape
// (pre-roll shape gate + loud decline + decline-without-crash) at each own lane; the
// already-loud in-file precedents supply the vocabulary (brutalStrike :270 '— no
// grant', natural20 ':450-family — zero extra damage', celestial ':505-family
// Unresolvable…', frenzy :101/:106 '— zero contribution, latch untouched').
// Strict diceRoller stub (#829 deterministic; junk → NULL, never a fabricated roll):
// the fold-host automationBonuses lane mocks fallback {total:6} for ANY junk
// (mock :63) — it structurally cannot falsify these loud arms, so they live here
// (fix#241 ledger law: 'lane mock leniency cannot mask it').
//
// Disk census bytes (READ-ONLY quotes, this lane pins them):
//   2024/classes.json Radiant Strikes  melee_weapon_hit '1d8'              → silent dice apply
//   classes.json      Divine Smite     melee_weapon_hit '2d8 + (spell_slot_level - 1)d8'
//       resourceType 'spell_slot', casting_time '1 action' → OPT-IN exemption:
//       honest zero, quiet BY DESIGN (auto-rolling would fabricate free smite per hit;
//       loud here would be false-positive spam on every paladin attack).
//   2024/classes.json Elemental Strike monk_weapon_or_unarmed_hit '1d6'   → silent dice apply
//   2024/feats.json   Heavy Weapon Mastery melee_heavy_weapon_hit 'proficiency_bonus' → eval→finite
//   2024/classes.json Divine Fury first_hit_while_raging '1d6 + barbarian_level / 2'
//       feature text: "extra damage equal to 1d6 plus half your Barbarian level
//       (round down)" → Math.floor halving MATCHES RAW (flat stays flat, dice stay dice).
//   2024/feats.json   Overwhelming Strike natural_20_attack_roll
//       extraDamageExpression 'increased_ability_score' → flat numeric leg kept.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => {
  const rollOne = (part) => {
    const cleaned = String(part).trim().replace(/\s+/g, '');
    const m = cleaned.match(/^(\d*)d([1-9]\d*)((?:[+-]\d+)*)$/i);
    if (!m) return null;
    const c = parseInt(m[1] || '1', 10), s = parseInt(m[2], 10);
    const mod = (m[3].match(/[+-]\d+/g) || []).reduce((a, b) => a + parseInt(b, 10), 0);
    const rolls = Array(c).fill(Math.floor(s / 2) + 1);
    return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, modifier: mod };
  };
  return {
    rollExpression: vi.fn((f) => {
      if (!f) return null;
      const base = String(f).replace(/\s*\[.*?\]\s*/g, '').trim();
      if (!base) return null;
      // ' or ' alternation mirrors REAL rollExpression (:49-55 first rollable part
      // wins) — disk-canonical Divine Fury hits it after the dt modal resolves.
      if (base.includes(' or ')) {
        for (const part of base.split(/\s+or\s+/i)) { const rr = rollOne(part); if (rr) return rr; }
        return null;
      }
      return rollOne(base); // junk/flat STRICT-null: mirrors the REAL parseExpression (:46) grammar.
    }),
    rollExpressionDoubled: vi.fn(),
    rollExpressionMaximized: vi.fn(),
    parseConstant: vi.fn((f) => {
      const n = String(f || '').replace(/\s*\[.*?\]\s*/g, '').trim().match(/^[+-]?\d+$/);
      return n ? parseInt(n[1], 10) : null;
    }),
  };
});

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
// Controlled token evaluator mirroring automationExpressions.js return contract:
// numbers for arithmetic tokens, STRINGS for dice formulas (:249) and unresolved
// tokens (:259) — the exact shapes the heavy-lane NaN gate must survive.
vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr, ps) => {
    if (expr === 'proficiency_bonus') return ps?.proficiency ?? 3;
    if (expr === 'rage_damage_d6') return '4d6';       // dice STRING leg (:249 shape)
    if (expr === 'true_zero') return 0;                 // honest-zero leg
    return expr;                                         // unresolved → string passthrough (:259)
  }),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({ getActiveBuffs: vi.fn(() => []) }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn(() => []) }));

const { buildAutomationBonusesStep, buildWeaponHitBonusesStep, buildNatural20BonusesStep } = await import('./attackRollBonuses.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

function ctx(overrides = {}) {
  return {
    playerStats: { name: 'TestChar', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }], automation: { actions: [], passives: [] } },
    campaignName: 'test-campaign',
    attack: { name: 'Longsword', damageType: 'Slashing', abilityName: 'Strength', properties: ['Heavy'] },
    isMeleeOrUnarmed: true,
    hit: true,
    formula: '1d8+3', total: 11, rolls: [8, 3],
    ...overrides,
  };
}
const rider = (extra) => ({ type: 'damage_bonus', name: 'Broken Rider', damageType: 'radiant', ...extra });
const withActions = (actions, o = {}) => ctx({ playerStats: { name: 'TestChar', level: 5, proficiency: 3, abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }], automation: { actions, passives: [] } }, ...o });
const ragingImpl = (_name, key) => (key === 'activeBuffs' ? [{ damageBonusExpression: 'rage_damage' }] : null);

describe('#1241-family silent-zero sweep — unrecognized shapes decline LOUD, zero contribution', () => {
  let errSpy;
  beforeEach(() => { errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  // ── site 1: applyMeleeWeaponHitBonuses — shape-gate + loud ────────────────────
  it.each([
    { label: 'flat token', expr: 'radiance_bonus' },
    { label: 'bare constant', expr: '4' },
    { label: 'empty string', expr: '' },
  ])('melee lane $label "$expr" → console.error, zero bytes, no roll', async ({ expr }) => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_weapon_hit', damageExpression: expr })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unrecognized melee weapon-hit rider "Broken Rider"'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('zero contribution'));
  });

  it('melee canonical Radiant Strikes 1d8 applies silently (exact bytes, disk 2024/classes.json)', async () => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' })]));
    expect(r.data).toEqual({ formula: '1d8+3 + 1d8 [radiant]', total: 16, rolls: [8, 3, 5] });
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('melee Divine Smite exemption: spell_slot_level row stays inert QUIET — no roll, no bytes, no console.error', async () => {
    // disk classes.json verbatim: '2d8 + (spell_slot_level - 1)d8', resourceType
    // 'spell_slot', casting_time '1 action' — opt-in smite adjudicated on the rider-
    // modal lane; this passive lane must contribute zero WITHOUT screaming every hit.
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_weapon_hit', name: 'Divine Smite', damageExpression: '2d8 + (spell_slot_level - 1)d8', damageType: 'Radiant' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── site 2: applyMonkWeaponHitBonuses — shape-gate + roll-null loud ───────────
  it('monk lane flat token → console.error, zero bytes, no roll', async () => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'monk_weapon_or_unarmed_hit', damageExpression: 'elemental_bonus' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unrecognized monk weapon-hit rider'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('zero contribution'));
  });

  it('monk lane roll-null (dice-shaped, roller fails) → LOUD, zero bytes (attunement never consulted)', async () => {
    const c = withActions([rider({ trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6' })]);
    rollExpression.mockReturnValueOnce(null);
    const r = await buildAutomationBonusesStep().handler(c);
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('failed to roll dice expression "1d6"'));
  });

  it('monk canonical Elemental Strike 1d6 applies silently [fire] default (disk 2024/classes.json)', async () => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6' })]));
    expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [fire]', total: 15, rolls: [8, 3, 4] });
    expect(errSpy).not.toHaveBeenCalled();
  });

  // ── site 3: applyHeavyWeaponHitBonusEntry — NaN-on-string map ─────────────────
  it('heavy dice-string from eval re-rolls honestly: + 4d6 [name] with rolls carried', async () => {
    // eval returns the STRING '4d6' (:249 dice-formula shape) — the old code fed the
    // string to acc.total → NaN poison; now it re-rolls the resolved bytes.
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_heavy_weapon_hit', name: 'Hammer Rage', damageExpression: 'rage_damage_d6', damageType: 'same_as_weapon' })]));
    expect(r.data.formula).toBe('1d8+3 + 4d6 [Hammer Rage]');
    expect(r.data.total).toBe(27);
    expect(r.data.rolls).toEqual([8, 3, 4, 4, 4, 4]);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('heavy unresolved string → console.error, total stays NUMBER (NaN-poison guard)', async () => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_heavy_weapon_hit', damageExpression: 'frost_bite' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(typeof r.data.total).toBe('number');
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('did not resolve to a finite number (evaluated: "frost_bite")'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('zero contribution'));
  });

  it('heavy honest-zero (eval→0) stays quiet and adds no bytes', async () => {
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_heavy_weapon_hit', damageExpression: 'true_zero' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('heavy disk-canonical Heavy Weapon Mastery: proficiency_bonus → + 3 [Heavy Weapon Mastery] flat (finite gate no regression)', async () => {
    // 2024/feats.json verbatim expr 'proficiency_bonus' dt 'same_as_weapon' → eval→
    // number 3; label byte = a.name verbatim per the :93 same_as_weapon house branch.
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'melee_heavy_weapon_hit', name: 'Heavy Weapon Mastery', damageExpression: 'proficiency_bonus', damageType: 'same_as_weapon' })]));
    expect(r.data.formula).toBe('1d8+3 + 3 [Heavy Weapon Mastery]');
    expect(r.data.total).toBe(14);
    expect(errSpy).not.toHaveBeenCalled();
  });

  // ── site 4: applyDivineFuryBonuses — finite-level gate + roll-null loud ──────
  it('divine fury RAW-canonical disk bytes roll + append + stamp (halving flat, dice intact)', async () => {
    getRuntimeValue.mockImplementation(ragingImpl);
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'first_hit_while_raging', name: 'Divine Fury', damageExpression: '1d6 + barbarian_level / 2', damageType: 'radiant' })]));
    // lv5 → floor(5/2)=2 → '1d6 + 2' → dice 4 + 2. Math.floor matches RAW "round down".
    expect(r.data.formula).toBe('1d8+3 + 1d6 + 2 [radiant]');
    expect(r.data.total).toBe(17);
    expect(r.data.rolls).toEqual([8, 3, 4]);
    expect(errSpy).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_divineFuryUsedRound', 1, 'test-campaign');
  });

  it('divine fury non-finite level → LOUD pre-roll, zero bytes, latch untouched (NaN-bake guard)', async () => {
    getRuntimeValue.mockImplementation(ragingImpl);
    const c = withActions([rider({ trigger: 'first_hit_while_raging', name: 'Divine Fury', damageExpression: '1d6 + barbarian_level / 2', damageType: 'radiant' })]);
    delete c.playerStats.level;
    const r = await buildAutomationBonusesStep().handler(c);
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('no finite character level'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('latch untouched'));
  });

  it('divine fury roll-null → LOUD with authored+resolved bytes, zero contribution, latch untouched', async () => {
    getRuntimeValue.mockImplementation(ragingImpl);
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'first_hit_while_raging', name: 'Divine Fury', damageExpression: 'not_a_dice', damageType: 'radiant' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('failed to roll expression "not_a_dice" (authored "not_a_dice")'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('zero contribution, latch untouched'));
  });

  it('divine fury disk-canonical modal leg unchanged: "Necrotic or Radiant" opens modal, zero writes', async () => {
    getRuntimeValue.mockImplementation(ragingImpl);
    const r = await buildAutomationBonusesStep().handler(withActions([rider({ trigger: 'first_hit_while_raging', name: 'Divine Fury', damageExpression: '1d6 + barbarian_level / 2', damageType: 'Necrotic or Radiant' })]));
    expect(r.modal.type).toBe('divineFury');
    expect(r.modal.props).toEqual({ damageType: 'Necrotic or Radiant' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  // ── site 5: applyWeaponHitBonus — shape-gate + roll-null loud ─────────────────
  it('weapon-hit lane unrecognized token → LOUD, zero bytes, uses untouched', async () => {
    const r = await buildWeaponHitBonusesStep().handler(withActions([rider({ trigger: 'weapon_attack_hit', name: 'Blessed Touch', damageExpression: 'blessed_touch' })]));
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unrecognized weapon-hit rider "Blessed Touch"'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('uses untouched'));
  });

  it('weapon-hit lane roll-null → LOUD, no consume/stamp (frenzy :105 vocabulary)', async () => {
    const c = withActions([rider({ trigger: 'weapon_attack_hit', name: 'Dreadful Strikes', damageExpression: '1d4', oncePerTurn: true })]);
    rollExpression.mockReturnValueOnce(null);
    const r = await buildWeaponHitBonusesStep().handler(c);
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('failed to roll dice expression "1d4"'));
  });

  it('weapon-hit canonical Blessed Strikes 1d8 applies + oncePerTurn stamp silently', async () => {
    const c = withActions([rider({ trigger: 'weapon_attack_hit', name: 'Blessed Strikes', damageExpression: '1d8', damageType: 'radiant', oncePerTurn: true })]);
    const r = await buildWeaponHitBonusesStep().handler(c);
    expect(r.data.formula).toBe('1d8+3 + 1d8 [radiant]');
    expect(r.data.total).toBe(16);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_Blessed_Strikes_usedRound', 1, 'test-campaign');
    expect(errSpy).not.toHaveBeenCalled();
  });

  // ── site 6: buildNatural20BonusesStep — missing-expression + neither-leg loud ─
  it('natural20 missing extraDamageExpression → LOUD, ctx bytes intact', async () => {
    const c = ctx({ isNatural20: true, playerStats: withActions([rider({ trigger: 'natural_20_attack_roll', extraDamageType: 'radiant' })], {}).playerStats });
    const r = await buildNatural20BonusesStep().handler(c);
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('"Broken Rider" missing extraDamageExpression — zero extra'));
  });

  it('natural20 unknown token extra expression → LOUD neither-roll-nor-flat, zero extra', async () => {
    const c = ctx({ isNatural20: true, playerStats: withActions([rider({ trigger: 'natural_20_attack_roll', extraDamageExpression: 'doom_blade', extraDamageType: 'radiant' })], {}).playerStats });
    const r = await buildNatural20BonusesStep().handler(c);
    expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('neither rolls nor resolves to a finite flat'));
  });

  it('natural20 numeric-string expression coerces flat honestly (+6, no noise)', async () => {
    const c = ctx({ isNatural20: true, playerStats: withActions([rider({ trigger: 'natural_20_attack_roll', extraDamageExpression: '6', extraDamageType: 'force' })], {}).playerStats });
    const r = await buildNatural20BonusesStep().handler(c);
    expect(r.data.formula).toBe('1d8+3 + 6 [force]');
    expect(r.data.total).toBe(17);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('natural20 disk-canonical Overwhelming Strike flat max(STR,DEX)=3 stays silent (#1035 leg)', async () => {
    const c = ctx({
      isNatural20: true,
      playerStats: withActions([{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', name: 'Overwhelming Strike', extraDamageExpression: 'increased_ability_score', extraDamageType: 'same_as_attack' }], {}).playerStats,
    });
    const r = await buildNatural20BonusesStep().handler(c);
    expect(r.data.formula).toBe('1d8+3 + 3 [slashing]');
    expect(r.data.total).toBe(14);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
