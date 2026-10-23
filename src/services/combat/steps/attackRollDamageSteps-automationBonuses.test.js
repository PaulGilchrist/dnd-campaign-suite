// @maintained-by-ai
// attackRollDamageSteps-automationBonuses lane: CANON fold for attackRollBonuses.js
// generic guards + the melee/monk/heavy/frenzy/divine-fury branches (no other file in
// the repo touches melee_weapon_hit, monk_weapon_or_unarmed_hit, melee_heavy_weapon_hit,
// _Elemental_Attunement_option, or first_hit_while_raging). Exact bytes hand-derived
// from the deterministic diceRoller stub (#829/#815: NdM → each die floor(M/2)+1);
// full-acc pins, never a loop-oracle (#1007/#710); campaign-keyed store bytes (#1021);
// near-miss co-located (#948); falsifiable per-clause guards (#842); honest titles (#910);
// no range-only pins (#973); zero wall-clock — round economy is seam-mocked (#app).
//
// PRESERVED cites (#936 fold arms — load-bearing, who cites them):
//   frenzy apply + 5 guard arms ......... attackRollBonuses.frenzy-cla147.test.js (#1026)
//   weaponHitBonuses modal ' or ' CANON . attackRollBonuses-spellDiscriminator.test.js (#1025, its :29 cites this file's ' or ' modal)
//   whb oncePerTurn-skip / uses-depleted / option-skip / upgraded-suppress / stamp /
//   both-triggers / condition ........... attackRollBonuses-lunarForm.test.js (never re-driven there, #1024/#1028)
//   brutalStrike inactive guard ......... attackRollBonuses-brutalStrike.test.js:18 ("guards folded … live in automationBonuses.test.js")
//   celestial dice-app / latch-inert /
//   riderless / buffless / zero-guard ... attackRollBonuses-cla048-celestial-rider.test.js:10-12 (CANON shared with natural20-celestial sibling)
//
// Applied recs:
//   #1022 applied: brutal-strike dice/te legs (weak toContain('+ 1d6…')/expect.any(Array))
//     removed — subsumed by the bs lane's exact-byte t1 + selection CANON (#986/#938);
//     only the exact-byte inactive guard survives here, per the bs lane's folded-guard cite.
//   #1023 applied HERE (fold host): Hamstring Blow (speed_reduction, clock:true)
//     addExpiration exact-payload leg — the ONLY falsifier of the clock branch
//     (:150-162/:215-222) anywhere; te full-object pin + grant-log byte.
//   #1027 applied: generic append/skip arms kept CANON, toContain→exact full-acc
//     toEqual; modal paths negative-pinned for zero-stamp (consume-after-modal falsifier).
//   #1035 test-integrity applied: celestial guard suite fixtures omitted targetName and
//     ALL short-circuited at attackRollBonuses.js:461 (`if (!ctx.targetName) return
//     { data: {} }`) — vacuous-green, pass wrong-reason. Re-pointed: every guard fixture
//     now carries targetName + branch-pins proving it lands past :461 on its named check;
//     the :461 arm itself stays CANON in the natural20-celestial sibling (zero-dup #54).
//
// unique-vs-siblings kept here: natural20 max(STR,DEX) default (Math.max branch — the
// n20-celestial sibling always passes abilityIncreased); brutalStrike inactive guard;
// celestial guard suite + one exact app/stamp leg (cla048 shares CANON across the two).
//
// old->new map: CLA-280 melee+unarmed gain legs + plain melee leg → t2 (one true-flag
// gain, distinguishable bytes); unarmed/ranged gate falsified by t2+t3 pair.
// monk 'fire'-explicit + default-fire → t4/t5 (option-normalize + fallback; explicit
// 'fire' was byte-identical to default and dropped). heavy explicit + default-type →
// t6 (two distinguishable dice, one call). frenzy t8-t13 kept (cited). df t14-t17 kept.
// brutalStrike old×5 → t18 (inactive guard) + t19 (Hamstring clock leg, added).
// natural20 old×10 → t20 (Math.max default only). celestial old×10 → t21-t26
// (5 guards + 1 exact app; duplicate app-name legs dropped, sibling-owned).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((f) => {
    if (!f || f === '0') return null;
    const base = f.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!base) return null;
    const m = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (m) {
      const c = parseInt(m[1], 10), s = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
      const rolls = Array(c).fill(Math.floor(s / 2) + 1);
      return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, modifier: mod };
    }
    const n = base.match(/^(\d+)$/);
    if (n) return { total: parseInt(n[1], 10), rolls: [parseInt(n[1], 10)], modifier: 0 };
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
  parseConstant: vi.fn((s) => (/^\d+$/.test(String(s)) ? Number(s) : undefined)),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({ getCombatContext: vi.fn(), getTargetFromAttacker: vi.fn() }));
vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  evaluateAutoExpression: vi.fn((expr, ps) => expr === 'proficiency_bonus' ? ps?.proficiency || 0 : null),
}));
vi.mock('../../rules/combat/applyDamage.js', () => ({ applyDamageToTarget: vi.fn() }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({ sendBardicInspirationOffensePrompt: vi.fn() }));
vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));
vi.mock('../../automation/common/resourceCheck.js', () => ({ spendResource: vi.fn() }));
vi.mock('../../automation/common/buffToggle.js', () => ({ getActiveBuffs: vi.fn(() => []) }));
vi.mock('../../ui/utils.js', () => ({ default: { guid: () => 'test-guid-123' } }));
vi.mock('./features/index.js', () => ({ featureModules: [] }));
vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({ applyMasteryEffect: vi.fn(() => Promise.resolve()) }));
vi.mock('../../rules/combat/rangeValidation.js', () => ({ getDistanceFeet: vi.fn(() => 3) }));
vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));
vi.mock('../../rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { addEntry } = await import('../../ui/logService.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { getActiveBuffs } = await import('../../automation/common/buffToggle.js');
const { addExpiration } = await import('../../rules/effects/expirations.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [], passives: [] }, level: 5, proficiency: 3 },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}
function buffsMock(b) { vi.mocked(getActiveBuffs).mockReturnValue(b); }
function gvImpl(fn) { getRuntimeValue.mockImplementation(fn); }
// frenzy ctx: raging (advantage + rage damage buff) STR melee hit, +2 flat bonus rider.
function frenzyCtx(overrides = {}) {
  return makeCtx({
    isMeleeOrUnarmed: true,
    hit: true,
    attack: { abilityName: 'Strength' },
    playerStats: { name: 'TestChar', level: 5, class: { class_levels: [{ rage_damage: 2 }] }, automation: { actions: [{ type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' }] } },
    formula: '1d8+3', total: 11, rolls: [8, 3],
    ...overrides,
  });
}
const FRENZY_BUFFS = [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d6' }];

describe('buildAttackRollDamageSteps - automationBonuses', () => {
  let steps;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  // ── automationBonuses (steps[11]) ──
  describe('automationBonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[11].condition(makeCtx(o));
      it('true when automation exists', () => expect(cond({ playerStats: { automation: { actions: [] } } })).toBe(true));
      it('false when automation missing', () => expect(cond({ playerStats: { automation: {} } })).toBe(false));
    });
    describe('handler', () => {
      it('returns data unchanged when no matching actions', async () => {
        const r = await steps[11].handler(makeCtx({ isMeleeOrUnarmed: true, formula: '1d8+3', total: 11, rolls: [8, 3] }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });

      // CLA-280 melee/unarmed gate (:13): one true-flag gain, one false-flag skip —
      // distinguishable rider bytes; unarmed shares the same isMeleeOrUnarmed flag.
      it('CLA-280: melee hit gains +1d8 [radiant] (exact acc)', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          attack: { weaponType: 'melee', properties: ['Versatile'] },
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' }] } },
          formula: '1d8+5', total: 10, rolls: [5, 5],
        }));
        expect(r.data).toEqual({ formula: '1d8+5 + 1d8 [radiant]', total: 15, rolls: [5, 5, 5] });
      });
      it('CLA-280: ranged attack gains NO melee_weapon_hit bonus (exact bytes)', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: false,
          attack: { weaponType: 'ranged', properties: ['Ammunition', 'Heavy', 'Range'] },
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d8', damageType: 'Radiant' }] } },
          formula: '1d8+3', total: 8, rolls: [5, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 8, rolls: [5, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      // Elemental attunement (:26): option normalizes lowercase; missing option falls back to fire.
      it('monk hit attunes to "Lightning" option → +1d6 [lightning]', async () => {
        gvImpl((_, p) => p === '_Elemental_Attunement_option' ? 'Lightning' : null);
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [lightning]', total: 15, rolls: [8, 3, 4] });
      });
      it('monk hit with no attunement stored defaults to [fire]', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [fire]', total: 15, rolls: [8, 3, 4] });
      });

      // Heavy weapon (:37 fallback chain): explicit type + no-type fallback in one
      // call, distinguishable by dice (1d6 vs 1d8).
      it('heavy hit appends explicit [slashing] and falls back to [slashing] when type missing', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          attack: { properties: ['Heavy'] },
          playerStats: { name: 'TestChar', automation: { actions: [
            { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' },
            { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d8' },
          ] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [slashing] + 1d8 [slashing]', total: 20, rolls: [8, 3, 4, 5] });
      });
      it('skips melee_heavy when weapon is not Heavy (exact bytes)', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          attack: { properties: ['Finesse'] },
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });

      // Frenzy fold (#936, cited #1026): apply + stamp once, five clause-guards each
      // byte-pinned with zero latch write.
      it('applies frenzy +2 on raging reckless STR hit and stamps _frenzyUsedRound once', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? FRENZY_BUFFS : null);
        const r = await steps[11].handler(frenzyCtx());
        expect(r.data).toEqual({ formula: '1d8+3 + 2 []', total: 13, rolls: [8, 3, 2] });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_frenzyUsedRound', 1, 'test-campaign');
      });
      it('frenzy: miss gains no bonus and never stamps the latch', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? FRENZY_BUFFS : null);
        const r = await steps[11].handler(frenzyCtx({ hit: false }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('frenzy: no reckless advantage buff → no bonus, no stamp', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(frenzyCtx());
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('frenzy: no rage damage buff → no bonus, no stamp', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? [{ effect: 'advantage_attacks_advantage_against' }] : null);
        const r = await steps[11].handler(frenzyCtx());
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('frenzy: Dexterity attack → no bonus, no stamp', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? FRENZY_BUFFS : null);
        const r = await steps[11].handler(frenzyCtx({ attack: { abilityName: 'Dexterity' } }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('frenzy: latch already used this round → no bonus', async () => {
        gvImpl((_, p) => p === '_frenzyUsedRound' ? 1 : p === 'activeBuffs' ? FRENZY_BUFFS : null);
        const r = await steps[11].handler(frenzyCtx());
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      // Divine fury: level-halved expression resolves, appends, stamps; modal pauses
      // before any write.
      it('divine fury while raging: barbarian_level / 2 → +2 [radiant], stamps once', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', level: 5, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 2 [radiant]', total: 13, rolls: [8, 3, 2] });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_divineFuryUsedRound', 1, 'test-campaign');
      });
      it('divine fury: latch already used this round → no bonus, no stamp', async () => {
        gvImpl((_, p) => p === '_divineFuryUsedRound' ? 1 : p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', level: 5, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('divine fury: not raging → no bonus, no stamp', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', level: 5, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      // #1026-fix same-shape arm: roll null (empty acc) ⇒ latch NOT burned. Pre-fix
      // fingerprint was the burned-round pair: byte-identical formula + stamp fired.
      it('divine fury: roll null → zero rider bytes AND zero stamp (write-only-if-applied)', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        vi.mocked(rollExpression).mockReturnValueOnce(null);
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { name: 'TestChar', level: 5, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '0', damageType: 'radiant' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(rollExpression).toHaveBeenCalledWith('0');
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('divine fury: "radiant or necrotic" opens divineFury modal, pending data, zero writes', async () => {
        gvImpl((_, p) => p === 'activeBuffs' ? [{ damageBonusExpression: '1d6' }] : null);
        const setDF = vi.fn();
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          setDivineFuryChoice: setDF,
          playerStats: { name: 'TestChar', level: 5, automation: { actions: [{ type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant or necrotic' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.modal).toEqual({ type: 'divineFury', props: { damageType: 'radiant or necrotic' } });
        expect(r.data).toEqual({ _divineFuryPending: true, bonusExpr: '2', bonusTotal: 2, bonusRolls: [2] });
        expect(setDF).toHaveBeenCalledWith('radiant or necrotic');
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      // Brutal strike fold (#1022): inactive guard here (cited by bs lane :18); dice/
      // selection/te application CANON is the bs lane's exact-byte t1/t2 (#986 order).
      it('brutalStrike inactive: sticky null → formula byte-identical, zero te writes', async () => {
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          targetName: 'Orc',
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'slashing' }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
      });
      // #1023: ONLY falsifier of the speed_reduction clock branch (:150-162, :215-222)
      // app-wide — Hamstring Blow te full-object + addExpiration exact payload + grant log.
      it('Hamstring Blow: speed_reduction te granted, addExpiration clock armed, grant logged', async () => {
        gvImpl((_, p) => p === '_brutalStrikeActive' ? true : p === '_brutalStrikeEffects' ? ['Hamstring Blow'] : p === 'targetEffects' ? [] : null);
        const r = await steps[11].handler(makeCtx({
          isMeleeOrUnarmed: true,
          targetName: 'Goblin',
          playerStats: { name: 'TestChar', automation: { actions: [{ type: 'attack_rider', name: 'Brutal Strike', featureLevel: 9, trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'slashing', options: [{ name: 'Hamstring Blow', effect: 'speed_reduction' }] }] } },
          formula: '1d8+3', total: 11, rolls: [8, 3],
        }));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [slashing]', total: 15, rolls: [8, 3, 4] });
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects')).toEqual([
          ['campaign', 'targetEffects', [{
            target: 'Goblin', source: 'TestChar', option: 'Hamstring Blow',
            effect: 'speed_reduction', value: 15, duration: 'until_start_of_next_turn',
          }], 'test-campaign'],
        ]);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
          attackerName: 'TestChar', targetName: 'Goblin',
          effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'TestChar', option: 'Hamstring Blow', target: 'Goblin' }],
          campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'TestChar',
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use', characterName: 'TestChar', abilityName: 'Hamstring Blow',
          description: "Hamstring Blow: Goblin speed reduced 15 ft until start of TestChar's next turn", targetName: 'Goblin',
        });
      });
    });
  });

  // ── weaponHitBonuses (steps[12]) — CANON for generic guards, cited by lunarForm
  //    (#1024/#1028: never re-driven there) and spellDiscriminator (#1025, ' or ' modal) ──
  describe('weaponHitBonuses step', () => {
    describe('condition', () => {
      const cond = (o) => steps[12].condition(makeCtx(o));
      it('true when automation.actions exists', () => expect(cond({ playerStats: { automation: { actions: [] } } })).toBe(true));
      it('false when automation missing', () => expect(cond({ playerStats: { automation: {} } })).toBe(false));
    });
    describe('handler', () => {
      const rider = (extra = {}) => ({ type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d4', damageType: 'cold', name: 'TB', ...extra });
      const ctxWith = (actions, o = {}) => makeCtx({ playerStats: { name: 'TestChar', automation: { actions, passives: [] } }, formula: '1d8+3', total: 11, rolls: [8, 3], ...o });
      it('returns data unchanged when no matching actions', async () => {
        const r = await steps[12].handler(ctxWith([]));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });
      // both-triggers acceptance arms (cited): 'weapon_attack_hit' then beast_form.
      it('weapon_attack_hit rider appends +1d4 [cold] (exact acc)', async () => {
        const r = await steps[12].handler(ctxWith([rider()]));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d4 [cold]', total: 14, rolls: [8, 3, 3] });
      });
      it('weapon_or_beast_form_attack_hit rider appends +1d4 [piercing] (exact acc)', async () => {
        const r = await steps[12].handler(ctxWith([rider({ trigger: 'weapon_or_beast_form_attack_hit', damageType: 'piercing' })]));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d4 [piercing]', total: 14, rolls: [8, 3, 3] });
      });
      it('upgraded-suppress: superseded rider skipped (exact bytes)', async () => {
        const r = await steps[12].handler(ctxWith([rider()], { playerStats: { name: 'TestChar', automation: { actions: [rider()], passives: [{ name: 'TB', upgrades: 'TB' }] } } }));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });
      it('option-skip: chosen "poison" (no "strike") skips the rider (exact bytes)', async () => {
        gvImpl((_, p) => p === '_TB_option' ? 'poison' : null);
        const r = await steps[12].handler(ctxWith([rider({ options: ['poison', 'cold strike'] })]));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      });
      it('oncePerTurn skip: usedRound === round skips and re-stamps nothing (exact bytes)', async () => {
        gvImpl((_, p) => p === '_TB_usedRound' ? 1 : null);
        const r = await steps[12].handler(ctxWith([rider({ oncePerTurn: true })]));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('uses-depleted skip: stored uses "0" skips the rider (exact bytes)', async () => {
        gvImpl((_, p) => p === '_TB_uses' ? '0' : null);
        const r = await steps[12].handler(ctxWith([rider({ uses_expression: '1d4', recharge: true, usesMax: 3 })]));
        expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      // :278 modal-fire CANON cited by spellDiscriminator #1025 — strengthened to full data.
      it('"radiant or necrotic" opens damageTypeChoice modal with pending data, zero writes', async () => {
        const r = await steps[12].handler(ctxWith([rider({ damageType: 'radiant or necrotic' })]));
        expect(r.modal).toEqual({ type: 'damageTypeChoice', props: { title: 'TB — Damage Type', types: ['radiant', 'necrotic'] } });
        expect(r.data).toEqual({ _weaponHitPending: true, bonusExpr: '1d4', bonusTotal: 3, bonusRolls: [3], _weaponHitOnceKey: '_TB_usedRound' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
      it('recharge consumes uses 2→1 with the bonus applied', async () => {
        gvImpl((_, p) => p === '_TB_uses' ? '2' : null);
        const r = await steps[12].handler(ctxWith([rider({ uses_expression: '1d4', recharge: true, usesMax: 3 })]));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d4 [cold]', total: 14, rolls: [8, 3, 3] });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_TB_uses', 1, 'test-campaign');
      });
      it('oncePerTurn stamps _OB_usedRound at the seam with the bonus applied', async () => {
        const r = await steps[12].handler(ctxWith([rider({ name: 'OB', oncePerTurn: true })]));
        expect(r.data).toEqual({ formula: '1d8+3 + 1d4 [cold]', total: 14, rolls: [8, 3, 3] });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_OB_usedRound', 1, 'test-campaign');
      });
    });
  });

  // ── natural20Bonuses (steps[13]) — condition arms + dice/flat/zero handler arms are
  //    CANON in attackRollDamageSteps-natural20-celestial.test.js (drives this same step,
  //    superset of the old six here) — only the Math.max(STR,DEX) default branch is unique.
  //    #1035 fix: extraDamageType is the append gate; the fixture carries an authored type
  //    ('fire', lane-distinct byte) so Math.max stays observable — pre-fix this pinned the
  //    dead name-label byte ' + 5 [AB]' (extraDamageType discarded). ──
  describe('natural20Bonuses step', () => {
    it('increased_ability_score with no abilityIncreased appends max(STR,DEX) = +5 [fire]', async () => {
      const r = await steps[13].handler(makeCtx({
        isNatural20: true,
        playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 5 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: 'increased_ability_score', extraDamageType: 'fire', name: 'AB' }] } },
        formula: '1d8+3', total: 11, rolls: [8, 3],
      }));
      expect(r.data).toEqual({ formula: '1d8+3 + 5 [fire]', total: 16, rolls: [8, 3, 5] });
    });

    // #1035 zero-gate falsifier (lane-distinct shape): absent extraDamageType =
    // unauthored row → ZERO extra, ctx bytes byte-intact, console.error once.
    it('missing extraDamageType → zero extra (ctx bytes intact, console.error)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const r = await steps[13].handler(makeCtx({
        isNatural20: true,
        playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 5 }], automation: { actions: [{ type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: 'increased_ability_score', name: 'AB' }] } },
        formula: '1d8+3', total: 11, rolls: [8, 3],
      }));
      expect(r.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      expect(errSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── celestialRevelation (steps[14]) — guards CANON per cla048 lane cite; one exact
  //    dice-app + latch-stamp leg; proficiency-token resolution CANON in cla048 ──
  // #1035 test-integrity fix (ledger:436-457, fix#154 vacuity family): the handler's
  // FIRST arm is `if (!ctx.targetName) return { data: {} }` (attackRollBonuses.js:461).
  // Pre-fix EVERY guard fixture here omitted targetName, so all five short-circuited at
  // :461 and passed for the wrong reason — the suite asserted nothing about its named
  // discriminating checks. Now riderless() carries targetName so each case lands on
  // its claimed branch and branch-pins prove arrival order: riderless never reads
  // buffs (:465 riders.length gate), buffless reads buffs but never rolls (:470
  // registry), rider-mismatch never rolls (:472 name match), latch-inert never rolls
  // (:477 oncePerTurn), zero-guard reaches the numeric reject (:487, console loud,
  // '0' parsed to 0). The :461 short-circuit arm itself is CANON in the
  // natural20-celestial sibling :415 (no roll, no stamp) — not re-driven here.
  describe('celestialRevelation step', () => {
    const riderless = (passives) => makeCtx({
      targetName: 'Goblin',
      playerStats: { name: 'TestChar', automation: { actions: [], passives } },
      formula: '1d8+3', total: 11, rolls: [8, 3],
    });
    it('riderless: no attack_rider passives → empty data (guards before buff read)', async () => {
      buffsMock([]);
      expect((await steps[14].handler(riderless([]))).data).toEqual({});
      expect(getActiveBuffs).not.toHaveBeenCalled();
    });
    it('buffless: active buff not in celestial registry → empty data (reached the registry guard)', async () => {
      buffsMock([{ name: 'Other Buff' }]);
      const r = await steps[14].handler(riderless([{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '1d6', trigger: 'hit' }]));
      expect(r.data).toEqual({});
      expect(getActiveBuffs).toHaveBeenCalledTimes(1);
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
    it('rider-mismatch: buff active but matching rider absent → empty data, no roll', async () => {
      buffsMock([{ name: 'Heavenly Wings' }]);
      expect((await steps[14].handler(riderless([{ type: 'attack_rider', name: 'Other', damageExpression: '1d6', trigger: 'hit' }]))).data).toEqual({});
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
    it('latch-inert: oncePerTurn rider already used this round → empty data, no roll, no stamp', async () => {
      buffsMock([{ name: 'Heavenly Wings' }]);
      gvImpl((_, p) => p === '_Heavenly_Wings_usedRound' ? 1 : null);
      expect((await steps[14].handler(riderless([{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '1d6', trigger: 'hit', oncePerTurn: true }]))).data).toEqual({});
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
    it('zero-guard: unrollable "0" expression → empty data (no fabricated bonus, console loud)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      buffsMock([{ name: 'Heavenly Wings' }]);
      expect((await steps[14].handler(riderless([{ type: 'attack_rider', name: 'Heavenly Wings', damageExpression: '0', trigger: 'hit' }]))).data).toEqual({});
      expect(rollExpression).toHaveBeenCalledWith('0');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledTimes(1);
    });
    it('Inner Radiance hit: +1d6 [radiant] exact acc, latch stamped once', async () => {
      buffsMock([{ name: 'Inner Radiance' }]);
      const r = await steps[14].handler(makeCtx({
        targetName: 'Goblin',
        playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { passives: [{ type: 'attack_rider', name: 'Inner Radiance', damageExpression: '1d6', damageType: 'radiant', trigger: 'hit', oncePerTurn: true }] } },
        formula: '1d8+3', total: 11, rolls: [8, 3],
      }));
      expect(r.data).toEqual({ formula: '1d8+3 + 1d6 [radiant]', total: 15, rolls: [8, 3, 4] });
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_Inner_Radiance_usedRound', 1, 'test-campaign');
    });
  });
});
