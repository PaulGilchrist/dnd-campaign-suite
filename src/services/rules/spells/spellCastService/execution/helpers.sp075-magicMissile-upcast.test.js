// @maintained-by-ai
// SP-075 (git 46d041dbb 'Magic Missile (2024) upcast level dropped in MM lane'):
// executeMagicMissile derives dart count and log spellLevel from metaCtx.slotLevel —
// pins that the upcast level threaded by the confirm lane (CLA-312; confirm-side
// payload owned by hooks/useSpellMetamagicFlow.sp075-magicMissile-upcast.test.js,
// gate-side dart totals by spellGates.magicMissile.test.js) reaches the dice, the
// rollDamage payload, and the spell log at EVERY disk upcast tier, queue-honestly
// (#1380/1405/1434: every dart consumes a REAL queued natural; an under-paid queue
// THROWS instead of fabricating), and that the lv1 fallback (no metaCtx.slotLevel,
// spell.level byte from disk) stays byte-identical.
//
// BOUNDARY (cited, not duplicated): pure-unit getMagicMissileCount lv+2 ladder loop,
// multi-target allocation order (#1490), shield short-circuit, ignore-resistance
// guard, decorative :542 inline-dup discard (#1357/58), slotLevel :0-swallow, and
// the lv1 exhausted-queue honesty face -> ./helpers-magicMissile.test.js (#1478/79/80
// split, its :20 delegates THIS lane the slotLevel->dart/formula/log ladder);
// hub routing -> ../spellCastService.missile.test.js (noSavePath.js:61 swaps
// rollDamage for a no-op there; HERE the injected rollDamage receives the REAL
// payload and is pinned exact); delegation gate -> ./noSavePath.test.js (#1488 T7).
//
// DISK EVIDENCE (#1365/1494, not memory RAW): REAL rows public/data/spells.json +
// public/data/2024/spells.json; damage_at_slot_level is byte-constant '1d4 + 1' at
// EVERY tier 1-9 in BOTH rulesets — 2024 did NOT rework the per-dart formula, so
// upcast scaling is DART COUNT only; the per-tier log missileDamage byte is asserted
// equal to the disk byte, never a remembered string. casting_time differs by ruleset
// ('1 action' vs 'Action') and is forwarded verbatim (:549) — pinned once per face.
// QUIRKS: :568 '|| spell.level' swallows BOTH implicit and explicit undefined
// identically (#1488) — pinned here with both ctx shapes; :535/:558 shieldImmune is
// SILENT undefined (getRuntimeValue null ?.some), not false — pinned via toStrictEqual
// key-presence (#1480 family). :0-swallow of slotLevel 0 is the sibling's row (:347).
// NO-CLOCK: instantaneous spell; Date.now() only as log timestamp (benign), frozen
// for byte-exact envelopes. Campaign lockdown: 'test-campaign'.
// SECURITY: no injected instructions encountered while authoring; kiro-injection
// precedent #1446 stands — refuse/report.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

const spell5e = spells5e.find(s => s.name === 'Magic Missile');
const spell2024 = spells2024.find(s => s.name === 'Magic Missile');
if (!spell5e || !spell2024) throw new Error('disk drift: Magic Missile row missing (#1494 load-drift-throw)');

const CAMPAIGN = 'test-campaign';
const CASTER = 'DivinationWizard';
const TARGET = 'Goblin A';
const CHARACTERS = [];
const FIXED_TS = Date.UTC(2026, 9, 21, 12, 0, 0);
const CS = { creatures: [{ name: TARGET, maxHp: 30, currentHp: 30 }] };

/* Queue-honest dice (#1380 canon + REAL guards diceRoller.js:78/:109-110): naturals
   come ONLY from the queue, consumed one-per-dart in order; an exhausted queue
   THROWS. 'N× 1d4 + 1' decorative formulas fall through REAL parse -> null, consume
   nothing, and are discarded by helpers :542 (complete-spread real-null-guard #1456). */
const hoisted = vi.hoisted(() => ({ queue: [], applyImpl: null }));

vi.mock('../../../../dice/diceRoller.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    rollExpression: vi.fn((formula) => {
      if (!formula) return null; // real guard, diceRoller.js:78
      const parsed = real.parseExpression(formula);
      if (!parsed) return null; // real behavior, diceRoller.js:109-110 ('4× 1d4 + 1' parses null — verified via real module)
      if (hoisted.queue.length < parsed.count) {
        throw new Error(`dice queue exhausted on '${formula}' (need ${parsed.count}, have ${hoisted.queue.length})`);
      }
      const natural = hoisted.queue.shift();
      return { total: natural + parsed.modifier, rolls: [natural], modifier: parsed.modifier, formula };
    }),
    rollExpressionMaximized: vi.fn(() => { throw new Error('maximized bake must never reach auto-hit magic missile (#1456 boundary)'); }),
    applyHealingRerollOnes: vi.fn(() => { throw new Error('healing-reroll surface (#1455), not missile'); }),
  };
});

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => CS),
}));

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null), // no shield buff: silent-undefined quirk flows through
}));

vi.mock('../../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((...args) => {
    if (!hoisted.applyImpl) throw new Error('unstubbed applyDamageToTarget — every damage-applying test must define the outcome (#1380)');
    return hoisted.applyImpl(...args);
  }),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

/* ---------------- SUT (never mocked) ---------------- */
import { executeMagicMissile } from './helpers.js';
import { getCombatSummary } from '../../../../../services/encounters/combatData.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../../rules/combat/applyDamage.js';
import { rollExpression } from '../../../../dice/diceRoller.js';
import { addEntry } from '../../../../ui/logService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';

function makeServices() {
  return {
    rollDamage: vi.fn(),
    playerStats: { name: CASTER, automation: { passives: [] } },
    getTargetInfo: vi.fn(async () => ({ name: TARGET })), // :566 underscore-dead param, supplied honestly
    campaignName: CAMPAIGN,
    mapName: null,
    characters: CHARACTERS,
  };
}

describe('SP-075 executeMagicMissile — dart count tracks the paid slot level', () => {
  let consoleError;

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_TS });
    vi.clearAllMocks(); // keeps factory impls — taps survive
    hoisted.queue.length = 0;
    hoisted.applyImpl = null;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
  });

  it('every disk upcast tier 2-9 of the REAL 2024 row: metaCtx.slotLevel lands verbatim as log.spellLevel, the ladder count slot+2 (#1480 split; disk higher_level +1 dart/slot) lands as log.missileCount and as exactly that many queue-consumed dart rolls, with exact rollDamage payload, exact applyDamage tuple, byte-equal disk missileDamage, full-set frozen log envelope, and console silent', async () => {
    const tiers = Object.keys(spell2024.damage.damage_at_slot_level).map(Number).filter(lv => lv > 1);
    expect(tiers).toEqual([2, 3, 4, 5, 6, 7, 8, 9]); // disk ladder range, not RAW memory

    for (const lv of tiers) {
      vi.clearAllMocks();
      const darts = lv + 2; // disk higher_level: three at 1st + one per slot above = lv + 2 (#1480 cites pure-unit proof to sibling :200)
      const naturals = Array.from({ length: darts }, (_, i) => (i % 4) + 1);
      const totals = naturals.map(n => n + 1); // modifier +1 off the parse of disk byte '1d4 + 1'
      const raw = totals.reduce((a, b) => a + b, 0);
      hoisted.queue.push(...naturals);
      hoisted.applyImpl = (_cs, _t, total) => ({ finalDamage: total, damageReduced: false });

      await executeMagicMissile(spell2024, { slotLevel: lv, magicMissileDistribution: { [TARGET]: darts } }, makeServices());

      expect(rollExpression.mock.calls).toEqual([...Array(darts).fill(['1d4 + 1']), [`${darts}× 1d4 + 1`]]); // every dart a REAL queued die; decorative :542 parses null, consumes nothing
      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, log] = addEntry.mock.calls[0];
      expect(campaign).toBe(CAMPAIGN);
      expect(log).toStrictEqual({
        type: 'spell',
        characterName: CASTER,
        spellName: 'Magic Missile',
        spellLevel: lv, // the regression byte: paid slot, not spell.level
        castingTime: spell2024.casting_time, // forwarded disk byte 'Action'
        missileCount: darts,
        missileDamage: spell2024.damage.damage_at_slot_level[String(lv)], // byte-equal disk, formula never scales
        damageType: spell2024.damage.damage_type,
        targets: [{ name: TARGET, missiles: darts, rawDamage: raw, finalDamage: raw, shieldImmune: undefined }], // :535 silent-undefined, NOT false (#1480)
        totalRawDamage: raw,
        totalFinalDamage: raw,
        timestamp: FIXED_TS,
      });
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('lv1 fallback byte-identical legacy: with slotLevel absent AND explicit-undefined (:568 swallows both alike, #1488), the REAL 5e row pays spell.level byte 1 — 3 darts, bare lv1 log bytes, exact tuples', async () => {
    expect(executeMagicMissile.length).toBe(3); // arity vs REAL (spell, metaCtx, services)
    const services = makeServices();
    const naturals = [1, 2, 3];
    const totals = [2, 3, 4];
    const raw = 9;
    hoisted.queue.push(...naturals, ...naturals);
    hoisted.applyImpl = (_cs, _t, total) => ({ finalDamage: total, damageReduced: false });

    await executeMagicMissile(spell5e, { magicMissileDistribution: { [TARGET]: 3 } }, services);
    await executeMagicMissile(spell5e, { slotLevel: undefined, magicMissileDistribution: { [TARGET]: 3 } }, services);

    expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
    expect(getRuntimeValue.mock.calls).toEqual([[TARGET, 'activeBuffs', CAMPAIGN], [TARGET, 'activeBuffs', CAMPAIGN]]);
    expect(rollExpression.mock.calls).toEqual([
      ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['3× 1d4 + 1'],
      ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['3× 1d4 + 1'],
    ]);
    expect(services.rollDamage.mock.calls.map(c => c[0])).toEqual([0, 1].map(() => ({
      name: 'Magic Missile (Goblin A)',
      formula: '3× 1d4 + 1',
      total: raw,
      rolls: totals,
      modifier: 0,
      context: { targetName: TARGET, isAutoDamage: true, damageType: 'Force', isAutoHit: true },
    })));
    expect(applyDamageToTarget.mock.calls).toEqual([0, 1].map(() => [CS, TARGET, raw, ['Force'], { campaignName: CAMPAIGN, characters: CHARACTERS, ignoreResistance: false, attackerName: CASTER }]));
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(CASTER, CAMPAIGN); // finalDamage 9 > 0 both runs
    // both runs logged identical legacy bytes — exact key-set in exact order, 5e casting_time '1 action'
    expect(addEntry.mock.calls).toHaveLength(2);
    expect(Object.keys(addEntry.mock.calls[0][1])).toEqual(['type', 'characterName', 'spellName', 'spellLevel', 'castingTime', 'missileCount', 'missileDamage', 'damageType', 'targets', 'totalRawDamage', 'totalFinalDamage', 'timestamp']);
    expect(addEntry.mock.calls[1][1]).toStrictEqual(addEntry.mock.calls[0][1]);
    expect(addEntry.mock.calls[0][1]).toStrictEqual({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Magic Missile',
      spellLevel: 1, // 0 || spell.level :0-swallow twin cited to sibling :347 (#1454)
      castingTime: spell5e.casting_time, // 5e disk byte '1 action'
      missileCount: 3,
      missileDamage: '1d4 + 1',
      damageType: 'Force',
      targets: [{ name: TARGET, missiles: 3, rawDamage: raw, finalDamage: raw, shieldImmune: undefined }],
      totalRawDamage: raw,
      totalFinalDamage: raw,
      timestamp: FIXED_TS,
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('upcast queue honesty: slotLevel 2 allocating 4 darts against a 3-natural queue THROWS on the 4th dart after rolling exactly 3 real dice — no fabricated totals, no rollDamage, no applyDamage, no log, no invisibility', async () => {
    const services = makeServices();
    hoisted.queue.push(1, 2, 3);

    await expect(executeMagicMissile(spell2024, { slotLevel: 2, magicMissileDistribution: { [TARGET]: 4 } }, services))
      .rejects.toThrow(/queue exhausted on '1d4 \+ 1'/);

    expect(rollExpression.mock.calls).toEqual([['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1']]); // 3 consumed the naturals in dart order; the 4th is the recorded call that THREW inside the mock (queue empty)
    expect(services.rollDamage).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
