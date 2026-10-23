// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  helpers.js magic-missile chain — module-direct sole-runner lane   */
/*                                                                    */
/*  FAMILY SPLIT (#1478/#1479): every execution/ consumer lane        */
/*  (noSavePath.test.js:11, index/earlyReturns/blockChecks lanes)    */
/*  mocks ./helpers.js wholesale, and helpers.test.js is shared-base  */
/*  (zero missile refs — verified). This lane REAL-RUNS the missile   */
/*  helper internals at helpers.js:554-704: isMagicMissile,            */
/*  rollTargetMissiles (:562),                                          */
/*  getMagicMissileCount pinned LIVE-PATH only (:654 — its export was   */
/*  DELETED fix#304, #1504 census, zero production importers; the        */
/*  module still runs it REAL internally for every executeMagicMissile). */
/*  resolveIgnoreResistance (:513), applyMissileDamage (:522),         */
/*  logMagicMissileSpell (:539), executeMagicMissile (:566).          */
/*                                                                    */
/*  BOUNDARY (cited, not duplicated):                                 */
/*   - hub routing disk rows -> missile branch, swallowed rollDamage, */
/*     hub-level shield/ignore-resistance tuples, hub no-crit ....   */
/*     src/services/rules/spells/spellCastService.missile.test.js    */
/*     (its :35 delegates THIS lane the arithmetic + case gate)       */
/*   - slotLevel->dart/formula/log ladder via executeMagicMissile ...*/
/*     ./helpers.sp075-magicMissile-upcast.test.js (:61-101)          */
/*   - zero-count skip damage tuple (hub level) .......................*/
/*     ./spellCastService.healingEdgeCases.test.js:478-503             */
/*   - no-crit + dart-spread semantics owned by the .noformula side  */
/*     (#1456); here only as landmine: maximized/doubled bake must    */
/*     NEVER reach the auto-hit missile path.                         */
/*  UNIQUE to this face: shield short-circuit order inside             */
/*  applyMissileDamage (:523-527), resolveIgnoreResistance guard       */
/*  (DEAD-VIA-HUB per missile.test.js header — index.js:115-119       */
/*  chokepoint throws first on every hub cast; ALIVE on this direct   */
/*  call, pinned here only), the :542 decorative inline-dup roll       */
/*  (#1357/58: computed twice — per-dart loop AND 'N× formula', the  */
/*  second parses NULL by REAL diceRoller and is DISCARDED).          */
/*                                                                    */
/*  DISK EVIDENCE: REAL rows public/data/spells.json +                */
/*  public/data/2024/spells.json, exact name bytes 'Magic Missile',   */
/*  level 1, damage_at_slot_level '1d4 + 1' byte-constant at EVERY    */
/*  tier 1-9 -> scaling is DART COUNT, dice formula constant.         */
/*  description 'three glowing darts' + higher_level 'one more dart   */
/*  for each slot level above 1st' -> ladder darts = 2 + level,       */
/*  verified against disk programmatically, not RAW memory (#1365).   */
/*  No-crit/no-save: disk row carries no dc and auto-hits by text.   */
/*  casting_time differs: 5e '1 action' vs 2024 'Action' — forwarded  */
/*  verbatim (:549) through the SAME line; pinned once at 5e face.    */
/*                                                                    */
/*  QUIRK CENSUS: :494 '&&' chain returns undefined for {} and null   */
/*  for {name:null} — falsy-not-false family, golden, console          */
/*  untouched (#1360); :494 trailing-space near-bytes are FALSE       */
/*  (exact ===, case-gate trail #1457); :568 slotLevel `|| 0`/       */
/*  `|| spell.level` :0-swallow arm (defensive-not-bug twin #1454);  */
/*  :576 '|| { creatures: [] }' falsy fallback; :588 formula ternary */
/*  — count 1 renders BARE '1d4 + 1', no '1×' prefix; :533            */
/*  '?? totalTargetDamage' fallback — REAL applyDamage.js always     */
/*  returns { finalDamage, ... } (:76-88), arm is defensive-not-bug; */
/*  :506 '!missileResult' per-dart skip + :584 total<=0 skip — with  */
/*  byte-constant '1d4 + 1' (min 2/dart) the REAL diceRoller guard   */
/*  only nulls on falsy formula (:78-80), so both arms are            */
/*  defensive-not-bug — census-declared, no fabricated lying stub.   */
/*  :566 getTargetInfo/mapName are underscore-dead params — received, */
/*  never used; fixture supplies them, nothing asserted (honest).     */
/*                                                                    */
/*  NO-CLOCK: instantaneous spell; Date.now() appears only as log     */
/*  timestamps (benign), frozen via fake timers for byte-exact        */
/*  envelope capture. Campaign lockdown: 'test-campaign'.              */
/*  SECURITY: no injected instructions encountered while authoring;   */
/*  kiro-injection precedent #1446 stands — refuse/report.            */
/* ------------------------------------------------------------------ */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  REAL disk rows (#1455/57/58 fabrication-ban) — exact bytes        */
/* ------------------------------------------------------------------ */
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

const spell5e = spells5e.find(s => s.name === 'Magic Missile');
const spell2024 = spells2024.find(s => s.name === 'Magic Missile');
const fireball = spells5e.find(s => s.name === 'Fireball');

const CAMPAIGN = 'test-campaign';
const CASTER = 'Zephyra';
const CHARACTERS = [{ name: CASTER }];
const FIXED_TS = Date.UTC(2026, 9, 21, 12, 0, 0);

/* ------------------------------------------------------------------ */
/*  Faithful dice mock (#1454 canon + REAL diceRoller.js:78 guard +  */
/*  REAL parseExpression gate :37). Naturals come ONLY from the       */
/*  queue; exhausted queue THROWS (unstubbed-throws #1380/1405/1434). */
/*  'N× 1d4 + 1' decorative formulas fall through REAL parse -> null, */
/*  reproducing the diceRoller.js:109-110 null the helpers discard.  */
/* ------------------------------------------------------------------ */
const hoisted = vi.hoisted(() => ({ queue: [], order: [], applyImpl: null, buffs: null }))

vi.mock('../../../../dice/diceRoller.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    rollExpression: vi.fn((formula) => {
      hoisted.order.push('dice:' + formula)
      if (!formula) return null // real guard, diceRoller.js:78
      const parsed = real.parseExpression(formula)
      if (!parsed) return null // real behavior, diceRoller.js:109-110 ('3× 1d4 + 1' parses to null — verified via real module)
      if (hoisted.queue.length < parsed.count) {
        throw new Error(`dice queue exhausted on '${formula}' (need ${parsed.count}, have ${hoisted.queue.length})`)
      }
      const natural = hoisted.queue.shift()
      return { total: natural + parsed.modifier, rolls: [natural], modifier: parsed.modifier, formula }
    }),
    rollExpressionMaximized: vi.fn(() => { throw new Error('maximized bake must never reach auto-hit magic missile (#1456 owns no-crit)') }),
    applyHealingRerollOnes: vi.fn(() => { throw new Error('healing-reroll lane surface (#1455), not missile' ) }),
  }
})

const CS = { creatures: [{ name: 'Goblin A', maxHp: 30, currentHp: 30 }] }

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => { hoisted.order.push('summary'); return CS }),
}))

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => { hoisted.order.push('buffs'); return hoisted.buffs }), // no shield buff by default
}))

vi.mock('../../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((...args) => {
    hoisted.order.push('apply')
    if (!hoisted.applyImpl) throw new Error('unstubbed applyDamageToTarget — every damage-applying test must define the outcome (#1380)')
    return hoisted.applyImpl(...args)
  }),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => { hoisted.order.push('log'); return Promise.resolve() }),
}))

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(() => { hoisted.order.push('invis') }),
}))

/* ---------------- SUT (never mocked) ---------------- */
import { isMagicMissile, executeMagicMissile } from './helpers.js';
import { getCombatSummary } from '../../../../../services/encounters/combatData.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../../rules/combat/applyDamage.js';
import { rollExpression, rollExpressionMaximized } from '../../../../dice/diceRoller.js';
import { addEntry } from '../../../../ui/logService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';

function makeServices(playerStats = { name: CASTER, automation: { passives: [] } }) {
  return {
    rollDamage: vi.fn(() => { hoisted.order.push('rollDamage') }),
    playerStats,
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin A' })),
    campaignName: CAMPAIGN,
    mapName: null,
    characters: CHARACTERS,
  };
}

describe('helpers.js magic-missile chain — module-direct sole runner', () => {
  let consoleError;

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_TS });
    vi.clearAllMocks(); // NOTE: clearAllMocks keeps implementations — taps in factory impls survive
    hoisted.buffs = null;
    hoisted.queue.length = 0;
    hoisted.order.length = 0;
    hoisted.applyImpl = null;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
  });

  describe('isMagicMissile (:493-495)', () => {
    it('matches the REAL disk-row name bytes case-insensitively and rejects near-bytes/other disk rows; && chain returns falsy-not-false and null input throws unguarded', () => {
      // disk-faithful names from BOTH ruleset rows
      expect(spell5e.name).toBe('Magic Missile');
      expect(spell2024.name).toBe('Magic Missile');
      expect(isMagicMissile(spell5e)).toBe(true);
      expect(isMagicMissile(spell2024)).toBe(true);
      expect(isMagicMissile({ name: 'magic missile' })).toBe(true);
      expect(isMagicMissile({ name: 'MAGIC MISSILE' })).toBe(true);
      // case-gate trail exact ===: near bytes are FALSE (#1457 form)
      expect(isMagicMissile({ name: 'Magic Missile ' })).toBe(false);
      expect(isMagicMissile({ name: 'Magic Missiles' })).toBe(false);
      expect(isMagicMissile(fireball)).toBe(false);
      // quirk face (:494): '&&' short-circuit yields undefined/null, never false;
      // null spell is an unguarded-deref TypeError — golden, console untouched.
      expect(isMagicMissile({})).toBeUndefined();
      expect(isMagicMissile({ name: null })).toBeNull();
      expect(() => isMagicMissile(null)).toThrow(TypeError);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('Magic Missile dart ladder — LIVE-PATH pin (getMagicMissileCount export DELETED fix#304 #1504; module-local :558 stays live internal at :654)', () => {
    it('darts = 2 + slot level at EVERY disk damage_at_slot_level tier of BOTH rulesets, whose dart formula is byte-constant (scaling is count-only) — proven through executeMagicMissile log bytes', async () => {
      const tiers5e = Object.keys(spell5e.damage.damage_at_slot_level);
      const tiers2024 = Object.keys(spell2024.damage.damage_at_slot_level);
      expect(tiers5e).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      expect(tiers2024).toEqual(tiers5e);
      // disk bytes prove the DART formula never scales...
      for (const lv of tiers5e) expect(spell5e.damage.damage_at_slot_level[lv]).toBe('1d4 + 1');
      for (const lv of tiers2024) expect(spell2024.damage.damage_at_slot_level[lv]).toBe('1d4 + 1');
      // ...while the dart count does, per disk higher_level bytes. The ladder arithmetic
      // (numMissiles = getMagicMissileCount(slotLevel), helpers.js:654) reaches TWO
      // observable bytes on the live seam: the :628 decorative summary formula and the
      // spell-log missileCount — pinned WITHOUT importing the demoted symbol (fix#304).
      expect(spell5e.description[0]).toContain('three glowing darts');
      expect(spell5e.higher_level[0]).toContain('one more dart for each slot level above 1st');
      const services = makeServices();
      for (const lv of tiers5e) {
        const darts = Number(lv) + 2;
        rollExpression.mockClear();
        addEntry.mockClear();
        hoisted.queue.length = 0;
        hoisted.order.length = 0;
        hoisted.queue.push(...Array(darts).fill(1)); // totals 2/dart — never hits the :670 skip
        hoisted.applyImpl = () => ({ finalDamage: 2 });

        await executeMagicMissile(spell5e, { slotLevel: Number(lv), magicMissileDistribution: { 'Goblin A': darts } }, services);

        expect(rollExpression.mock.calls).toEqual([...Array(darts).fill(['1d4 + 1']), [`${darts}× 1d4 + 1`]]);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1].spellLevel).toBe(Number(lv)); // paid slot forwarded to the ladder
        expect(addEntry.mock.calls[0][1].missileCount).toBe(darts);
      }
      // base case straight off the disk level byte: slotLevel absent -> :653 falls back to
      // spell.level 1 -> 3 darts in the summary formula and the log.
      rollExpression.mockClear();
      addEntry.mockClear();
      hoisted.queue.length = 0;
      hoisted.queue.push(1, 1, 1);
      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 3 } }, services);
      expect(rollExpression.mock.calls).toEqual([...Array(3).fill(['1d4 + 1']), ['3× 1d4 + 1']]);
      expect(addEntry.mock.calls[0][1].missileCount).toBe(3);
    });
  });

  describe('executeMagicMissile (:566-618) — helper internals', () => {
    it('single target: queue naturals roll per-dart into a rolls ARRAY of dart totals, exact rollDamage/applyDamage/getRuntimeValue tuples, full call ORDER with the :542 decorative inline-dup roll parsing null and discarded, exact spell-log envelope', async () => {
      const services = makeServices();
      hoisted.queue.push(1, 4, 3); // naturals -> dart totals 2, 5, 4 (each +1)
      hoisted.applyImpl = () => ({ finalDamage: 5, damageReduced: true }); // resistance-shaped recalc (#1449 element-wise)

      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 3 } }, services);

      // dice: 3 per-dart byte-constant formulas, then the decorative dup at :542
      expect(rollExpression.mock.calls).toEqual([['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['3× 1d4 + 1']]);
      // full-set exact payload, arity 1: rolls is a DARTS ARRAY of per-dart totals, not a scalar
      expect(services.rollDamage).toHaveBeenCalledTimes(1);
      expect(services.rollDamage.mock.calls[0]).toEqual([{
        name: 'Magic Missile (Goblin A)',
        formula: '3× 1d4 + 1',
        total: 11,
        rolls: [2, 5, 4],
        modifier: 0,
        context: { targetName: 'Goblin A', isAutoDamage: true, damageType: 'Force', isAutoHit: true },
      }]);
      // combatSummary identity + exact 5-tuple; ignoreResistance false from empty passives (:519 some-scan)
      expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
      expect(getRuntimeValue.mock.calls).toEqual([['Goblin A', 'activeBuffs', CAMPAIGN]]);
      expect(applyDamageToTarget).toHaveBeenCalledWith(CS, 'Goblin A', 11, ['Force'], { campaignName: CAMPAIGN, characters: CHARACTERS, ignoreResistance: false, attackerName: CASTER });
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(CASTER, CAMPAIGN);
      // darts (:583->:505) precede buffs/apply (:586->:523), then invis/rollDamage
      // -> :542 decorative dup (parses null, DISCARDED) -> addEntry
      expect(hoisted.order).toEqual(['summary', 'dice:1d4 + 1', 'dice:1d4 + 1', 'dice:1d4 + 1', 'buffs', 'apply', 'invis', 'rollDamage', 'dice:3× 1d4 + 1', 'log']);
      // exact spell-log envelope, exact key-set, frozen timestamp, 5e casting_time byte '1 action'
      expect(addEntry.mock.calls).toEqual([[CAMPAIGN, {
        type: 'spell',
        characterName: CASTER,
        spellName: 'Magic Missile',
        spellLevel: 1,
        castingTime: '1 action',
        missileCount: 3,
        missileDamage: '1d4 + 1',
        damageType: 'Force',
        targets: [{ name: 'Goblin A', missiles: 3, rawDamage: 11, finalDamage: 5, shieldImmune: undefined }], // :523 'null?.some()' -> undefined, NOT false — silent-undefined golden (#1469)
        totalRawDamage: 11,
        totalFinalDamage: 5,
        timestamp: FIXED_TS,
      }]]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('multi-target allocation walks distribution order, zeroes skip cleanly (no dice, no damage), a count-1 target renders the BARE formula (:588 ternary), and the :542 decorative roll is SLOT-derived not allocation-summed', async () => {
      const services = makeServices();
      hoisted.queue.push(2, 2, 1); // A darts 3+3=6, B dart 1+1=2; Ogre(0) consumes nothing
      hoisted.applyImpl = (_cs, targetName) => (targetName === 'Goblin A'
        ? { finalDamage: 3, damageReduced: true }
        : { finalDamage: 2, damageReduced: false });

      await executeMagicMissile(spell5e, { slotLevel: 2, magicMissileDistribution: { 'Goblin A': 2, Ogre: 0, 'Goblin B': 1 } }, services);

      // dice consumed strictly in distribution order; Ogre's zero arm (:581 continue) fires BEFORE any roll
      expect(rollExpression.mock.calls).toEqual([['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['4× 1d4 + 1']]);
      expect(services.rollDamage.mock.calls.map(c => c[0])).toEqual([
        { name: 'Magic Missile (Goblin A)', formula: '2× 1d4 + 1', total: 6, rolls: [3, 3], modifier: 0, context: { targetName: 'Goblin A', isAutoDamage: true, damageType: 'Force', isAutoHit: true } },
        { name: 'Magic Missile (Goblin B)', formula: '1d4 + 1', total: 2, rolls: [2], modifier: 0, context: { targetName: 'Goblin B', isAutoDamage: true, damageType: 'Force', isAutoHit: true } },
      ]);
      expect(applyDamageToTarget.mock.calls.map(c => [c[1], c[2]])).toEqual([['Goblin A', 6], ['Goblin B', 2]]);
      // log: slot-derived missileCount 4 (ladder owned by sp075 lane, cited) vs only 3 darts actually rolled
      expect(addEntry.mock.calls[0][1].targets).toEqual([
        { name: 'Goblin A', missiles: 2, rawDamage: 6, finalDamage: 3, shieldImmune: undefined },
        { name: 'Goblin B', missiles: 1, rawDamage: 2, finalDamage: 2, shieldImmune: undefined },
      ]);
      expect(addEntry.mock.calls[0][1].missileCount).toBe(4);
      expect(addEntry.mock.calls[0][1].spellLevel).toBe(2);
      expect(addEntry.mock.calls[0][1].totalRawDamage).toBe(8);
      expect(addEntry.mock.calls[0][1].totalFinalDamage).toBe(5);
    });

    it('returns undefined before ANY side effect when distribution is absent or empty (:572 guard)', async () => {
      const absent = makeServices();
      expect(await executeMagicMissile(spell5e, undefined, absent)).toBeUndefined();
      await executeMagicMissile(spell5e, {}, absent);
      await executeMagicMissile(spell5e, { slotLevel: 3, magicMissileDistribution: {} }, absent);

      expect(rollExpression).not.toHaveBeenCalled();
      expect(getCombatSummary).not.toHaveBeenCalled();
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(absent.rollDamage).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('#1456 disk law: the Shield SPELL buff (toggleBuff bytes — name "Shield", effect "shield", NO oneShot) short-circuits INSIDE applyMissileDamage before ignore-resistance resolution: applyDamage unreached, passives-missing caster still never throws, darts and rollDamage still fire at full raw total, log spells shieldImmune with zero final damage', async () => {
      // Disk spells.json:8779: "...and you take no damage from magic missile" — blanket
      // MM immunity is the Shield SPELL's own grant; the same-name monster reaction is
      // NOT it (next row). playerStats WITHOUT automation.passives proves the short-
      // circuit precedes :527 resolveIgnoreResistance (direct-face ordering).
      const services = makeServices({ name: CASTER });
      hoisted.queue.push(3, 2); // dart totals 4 + 3 = 7
      hoisted.buffs = [{ name: 'Shield', effect: 'shield', sourceCharacter: CASTER }];

      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 2 } }, services);

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
      expect(services.rollDamage.mock.calls[0][0].total).toBe(7); // cosmetic full-total roll survives the shield
      expect(addEntry.mock.calls[0][1].targets).toEqual([{ name: 'Goblin A', missiles: 2, rawDamage: 7, finalDamage: 0, shieldImmune: true }]);
      expect(addEntry.mock.calls[0][1].totalFinalDamage).toBe(0);
    });

    it('#1456 RAW gate: a MONSTER shield-reaction stamp (MA-1170 buildShieldBuff bytes — oneShot:true, +5 AC vs ONE named triggering attack) does NOT grant whole-volley missile immunity — all dart damage flows through applyDamageToTarget, shieldImmune:false', async () => {
      // Monster Stamp disk law (MonsterCardHelpers.js:1888-1899 + MA-1170 comment): the
      // authored reaction row grants acBonus against the triggering attack only — the
      // Magic Missile immunity is text reserved to the Shield spell disk row (:8779).
      // PRE-FIX capture: these stamp bytes zeroed the volley (applyDamage unreached,
      // shieldImmune:true) — full-missile-immunity-vs-RAW, the #1456 bug.
      const services = makeServices();
      hoisted.queue.push(3, 2); // dart totals 4 + 3 = 7
      hoisted.buffs = [{ effect: 'shield', acBonus: 5, oneShot: true, source: 'Shield', vsAttack: `${CASTER}:Magic Missile`, appliedRoundContext: { d20: 12, total: 14, targetAc: 11 }, timestamp: FIXED_TS }];
      applyDamageToTarget.mockReturnValue({ finalDamage: 7, damageReduced: false });

      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 2 } }, services);

      expect(applyDamageToTarget).toHaveBeenCalledWith(CS, 'Goblin A', 7, ['Force'], { campaignName: CAMPAIGN, characters: CHARACTERS, ignoreResistance: false, attackerName: CASTER });
      expect(endInvisibilityOnHostileAction).toHaveBeenCalled();
      expect(addEntry.mock.calls[0][1].targets).toEqual([{ name: 'Goblin A', missiles: 2, rawDamage: 7, finalDamage: 7, shieldImmune: false }]);
      expect(addEntry.mock.calls[0][1].totalFinalDamage).toBe(7);
    });

    it('resolveIgnoreResistance (:513-520): only the auto_effect+ignore_resistance pair flips the forwarded flag — full tuple otherwise identical; missing passives THROWS with console.error after dice were already spent (alive direct; hub face REVISED fix#300 — fix#126 degrade un-shadowed the guard, see missile.test.js header)', async () => {
      const services = makeServices({ name: CASTER, automation: { passives: [{ type: 'auto_effect', effect: 'ignore_immunity' }, { type: 'feat', effect: 'ignore_resistance' }] } });
      hoisted.queue.push(2);
      applyDamageToTarget.mockReturnValue({ finalDamage: 3, damageReduced: false });
      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 1 } }, services);
      expect(applyDamageToTarget.mock.calls[0][4]).toEqual({ campaignName: CAMPAIGN, characters: CHARACTERS, ignoreResistance: false, attackerName: CASTER });

      vi.clearAllMocks();
      hoisted.queue.length = 0;
      services.playerStats.automation.passives = [{ type: 'auto_effect', effect: 'ignore_resistance' }];
      hoisted.queue.push(1);
      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 1 } }, services);
      expect(applyDamageToTarget.mock.calls[0][4]).toEqual({ campaignName: CAMPAIGN, characters: CHARACTERS, ignoreResistance: true, attackerName: CASTER });

      vi.clearAllMocks();
      hoisted.queue.length = 0;
      hoisted.queue.push(3);
      const naked = makeServices({ name: CASTER }); // no automation at all
      await expect(executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 1 } }, naked))
        .rejects.toThrow('playerStats.automation.passives is required for ignore resistance check');
      // honest partial-side-effect pin: the dart ROLLED (:505) before the guard (:515) rejected — nothing downstream fired
      expect(rollExpression.mock.calls).toEqual([['1d4 + 1']]);
      expect(naked.rollDamage).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('[spellCast] executeMagicMissile: playerStats.automation.passives is missing');
    });

    it('metaCtx.slotLevel 0 is :0-swallowed to spell.level 1 (:568) and a null summary substitutes { creatures: [] } before forwarding (:576)', async () => {
      const services = makeServices();
      hoisted.queue.push(1); // dart total 2
      applyDamageToTarget.mockReturnValue({ finalDamage: 2, damageReduced: false });
      getCombatSummary.mockReturnValueOnce(null);

      await executeMagicMissile(spell5e, { slotLevel: 0, magicMissileDistribution: { 'Goblin A': 1 } }, services);

      // 0 || spell.level -> 1 -> 3 missiles -> decorative '3×', while the allocated single dart stays byte-bare (:588 ternary)
      expect(rollExpression.mock.calls).toEqual([['1d4 + 1'], ['3× 1d4 + 1']]);
      expect(services.rollDamage.mock.calls[0][0]).toEqual({ name: 'Magic Missile (Goblin A)', formula: '1d4 + 1', total: 2, rolls: [2], modifier: 0, context: { targetName: 'Goblin A', isAutoDamage: true, damageType: 'Force', isAutoHit: true } });
      expect(applyDamageToTarget.mock.calls[0][0]).toEqual({ creatures: [] });
      expect(addEntry.mock.calls[0][1].spellLevel).toBe(1);
      expect(addEntry.mock.calls[0][1].missileCount).toBe(3);
    });

    it('exhausted dice queue throws: the helper rolls EVERY allocated dart through rollExpression and never fabricates totals (:504 loop honesty)', async () => {
      const services = makeServices();
      hoisted.queue.push(1); // only 1 natural for 3 darts
      await expect(executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 3 } }, services)).rejects.toThrow(/queue exhausted on '1d4 \+ 1'/);
      expect(services.rollDamage).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('auto-hit contract: no attack roll, no crit/maximize bake ever reaches the missile path (#1456 boundary landmine)', async () => {
      const services = makeServices();
      hoisted.queue.push(4);
      applyDamageToTarget.mockReturnValue({ finalDamage: 5, damageReduced: false });
      await executeMagicMissile(spell5e, { magicMissileDistribution: { 'Goblin A': 1 } }, services);
      expect(rollExpressionMaximized).not.toHaveBeenCalled(); // and any call THROWS in the mock — this asserts silence
      expect(services.getTargetInfo).not.toHaveBeenCalled(); // :566 underscore-dead param stays dead
    });
  });
});
