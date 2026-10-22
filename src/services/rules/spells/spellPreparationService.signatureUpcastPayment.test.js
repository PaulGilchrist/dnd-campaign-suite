// @maintained-by-ai
// SIGNATURE UPCAST-PAYMENT lane — CLA-312 (2024 Wizard lv20 'Signature Spells'), PAYMENT face of
// spellPreparationService: which EFFECTIVE cast levels ride free (exactly lv3, once per spell) and
// which PAY a slot (every higher level). Authorization oracle, generic slot ladder, Mastery side,
// rollback producer and rest re-arm are OTHER lanes (split below).
//
// LIVE BOUNDARY (verbatim citations, verified on disk 2026-10-21):
//   #1513 oracle header (:19-21): '#3  masteryOrSavantFreeCast  SpellMastery lv1/lv2 EXACT
//     name+level; Signature lv3 selection && !SignatureSpells_<Spell>_used;
//     _Divination_Savant_selection && !used -> true; false->CONTINUE  [upcast gates owned by
//     cla312/cla323 siblings]'  — mastery/signature UPCAST gates -> spellMasteryPayment /
//     signatureUpcastPayment (YOU).
//   #1512 increment lane (:261 name): 'used-flag rollbacks: Signature Spells gated
//     spellLevel === 3 (5/7/9 selections inert), Divination Savant ungated by level — both
//     write exactly false' — rollback gate hardcoded spellLevel === 3 (:593), lv5/7/9
//     selections never restored. PINNED THERE. THIS lane is byte-complementary: lv5/7/9 casts
//     PAY a cast-level slot (correct RAW) and NEVER stamp the latch; rollback rows not re-run here.
//   #1517 resource-flow owns consumeBaseSlot/consumeUpcastSlot pay/deny/null-fallback ladder
//     bytes AND the :720/:767 arity-2 campaign-discard pin — cited, not re-pinned; the slot
//     reads below ride that shape (reads arity-2, writes arity-4).
//   Mastery sibling header: lv1/lv2 mastery casts, UNLIMITED, no stamp — split by feature-type +
//     spell level; the CLA-323 lv1→lv2 gate/payment pair lives there, not here (removed).
//
// DISK LAW (readFileSync + drift-throw — disk text is law #1365): public/data/2024/classes.json
//   Wizard .class_levels[19] (level 20) .features[0] 'Signature Spells' (automation.type
//   'signature_spells'): "Choose two level 3 spells in your spellbook as your signature spells.
//   You always have these spells prepared, and you can cast each of them once at level 3 without
//   expending a spell slot. When you do so, you can't cast them in this way again until you
//   finish a Short or Long Rest. To cast either spell at a higher level, you must expend a spell
//   slot."  FREE set = lv3-exact, once per spell, latch fresh = null (rest re-arm:
//   restRules-shortRest.js:229-232 / restRules-longRest.js:360-363 write null — NO CLOCK here).
//   PAID set = every effective level > 3 ('must expend a spell slot'). CLA-312 root cause was
//   callers authorizing at BASE spell.level so lv4+ rode free AND burned the latch; live caller
//   law is gateLevel = isUpcast ? upcastLevel : spell.level (useCustomHandlers.js:19-20;
//   useActionSpellMetamagic.js:154/:180 pass the cast level).
//
// LATCH BYTES (REAL builders, never-retype #1362): 'SignatureSpells_selection' —
//   spellCalc2024.js:661 + signatureSpellsHandler.js:116 writes [spell1, spell2]; used-key
//   `SignatureSpells_<spellName.replace(/\s+/g,'_')>_used` — consumer spellPreparationService.js
//   :172-176 (gate spellLevel===3 :173, !used :176), consume stamp :512-516 (gate :513).
//   Slot keys + lv20 max bank are disk bytes: class_levels[19].spellcasting 4/3/3/3/3/2/2/1/1.
//
// PAYMENT LEDGER MATRIX (mutually-distinguishable write-tuples #1348; bank = disk lv20 max;
// latch byte SignatureSpells_Fireball_used):
//   lv3 free fresh      | write exactly [latch,true]                 | ZERO spell_slots reads/writes
//   lv3 second, spent   | write [spell_slots_level_3, 3->2]          | latch stays true (no re-stamp)
//   lv4 upcast          | write [spell_slots_level_4, 3->2]          | latch stays null
//   lv5 / lv6           | [spell_slots_level_5, 3->2] / [spell_slots_level_6, 2->1] | latch null
//   lv7 / lv9           | [spell_slots_level_7, 2->1] / [spell_slots_level_9, 1->0] | latch null
//   lv5 banked 0 DENY   | ZERO writes (:723 <=0 honored)             | latch null; lv3 entitlement
//     survives every paid/refused upcast (re-authorization against the SAME live store, #1521).
//
// QUIRK SCAN (spans :166-186/:512-516/:718-726/:834/:947-1018): vacuous self-compute 0 — every
//   freeCastAuthorized is a LIVE isFreeCastAuthorized call against the SAME store prepareSpellCast
//   consumes (no canned booleans); :966 ternary both arms live (lv3 base vs lv4-9 rows).
//   :0-swallow quantified: consumeUpcastSlot :723 denies at banked 0 (DENY row, zero-writes).
//   silent-undefined ?.: fixture ships automation skeleton + spellAbilities so passives lookups
//   (:880-881/:897) never short-circuit on these rows; console untouched (guard-row form #1518).
//   falsy map #1352: latch absent(->real null)/null/false authorize, true refuses; lv9 appears
//   paid AND as banked-1 refuse boundary. Case/name-exact: 'Counterspell' off-list and 'fireball'
//   lowercase deny. Dead twins quantified: disk has exactly ONE 'Signature Spells' row (2024
//   Wizard lv20) — no lv6/lv14 'Signature Spells (level N)' twins exist to fork; FREE_CAST_ENTRY_
//   TYPES (:9) excludes 'signature_spells', so the action scans stay dark (exact-of-N censuses).
//   invocationCallOrder: 'SignatureSpells_selection' read precedes the used-stamp write (pair row).
//   NO-CLOCK: zero timers; only rest rules null the latch (cited). Purity every row: input spell
//   + metaCtx snapshots unchanged; modifiedSpell is a fresh copy (:949/:997).
//
// KILL MATRIX (declared analytic — every mutant named, killed by a row):
//   :173 `=== 3` -> `>= 3`        | lv-upcast rows: auth flips true, latch-stamp censuses fail
//   :176 `!used` -> true          | spent-deny fails (T1); pair row phase-2 free-writes fail
//   :513 stamp gate dropped        | paid-upcast latch-null pins fail
//   :515 stamp dropped             | pair row exact-of-1 + store byte fail
//   :834 drop `!isFreeCast`       | free lv3 also pays — pair-row zero-slot census fails
//   :723 `<=0` -> `<0`             | DENY row writes -1 — zero-writes census fails
//   :966 ternary drop             | lv9 write key becomes spell_slots_level_3 — tuple fails
//   :1016-1017 envelope drop      | metaCtx toStrictEqual fails on EVERY row
//
// MOCK CENSUS exact-of-7 direct import boundaries of spellPreparationService.js: MOCKED 5 —
//   useRuntimeState (live mem store: consume reads what it wrote #1521; missing byte null = REAL
//   useRuntimeState.js:74), combatData(null), concentrationService(trio), storage, logService.
//   REAL 2 — metamagicRules (canned-hollowing ban: isPsionicSpell/hasPsionicSorcery compute over
//   the fixture passives []; hasPsionicSorcery THROWS on null passives :155 — fixture honors it),
//   castingTimeUtils (never reached on these rows). Unit never mocked; barrel keys 0;
//   dead-module mocks 0; clearRuntimeState exported for mock-shape completeness of the module.
//
// PRESERVED-CITED-BY: none inbound — grep -rln 'signatureUpcastPayment' across src shows only this
// file (2026-10-21). Campaign locked 'test-campaign' (old 'camp' bytes fixed per #1514 catch).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneDeep } from 'lodash';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1521 streak form) ──
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));

const wizard = classes2024.find(c => c.name === 'Wizard');
const lv20 = wizard.class_levels.find(l => l.level === 20);
const sigFeature = lv20.features.find(f => f.name === 'Signature Spells');
if (!sigFeature || sigFeature.automation?.type !== 'signature_spells') {
  throw new Error('disk drift: 2024 Wizard lv20 Signature Spells row missing');
}
if (wizard.class_levels.filter(l => (l.features || []).some(f => (f.name || '').startsWith('Signature Spells'))).length !== 1) {
  throw new Error('disk drift: more than one Signature Spells row — re-scan dead twins');
}
for (const clause of [
  'Choose two level 3 spells',
  'once at level 3 without expending a spell slot',
  "can't cast them in this way again until you finish a Short or Long Rest",
  'To cast either spell at a higher level, you must expend a spell slot',
]) {
  if (!sigFeature.description.includes(clause)) {
    throw new Error(`CLA-312 disk law drifted: missing '${clause}'`);
  }
}
const diskFireball = spells2024.find(s => s.name === 'Fireball');
const diskSlow = spells2024.find(s => s.name === 'Slow');
const diskCounterspell = spells2024.find(s => s.name === 'Counterspell');
const fb5e = spells5e.find(s => s.name === 'Fireball');
if (!diskFireball || diskFireball.level !== 3 || !diskSlow || diskSlow.level !== 3 ||
  !diskCounterspell || diskCounterspell.level !== 3 || !fb5e || fb5e.level !== 3) {
  throw new Error('disk drift: spell name/level bytes changed (both rulesets)');
}
const lv20Bank = cloneDeep(
  Object.fromEntries(Object.entries(lv20.spellcasting).filter(([k]) => /^spell_slots_level_\d+$/.test(k))));
if (lv20Bank.spell_slots_level_3 !== 3 || lv20Bank.spell_slots_level_9 !== 1) {
  throw new Error('disk drift: lv20 spellcasting bank changed');
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => null);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

import { prepareSpellCast, isFreeCastAuthorized } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CASTER = 'DivinationWizard';
const CAMPAIGN = 'test-campaign';
const LATCH = 'SignatureSpells_Fireball_used';
const LADDER = /^spell_slots_level_\d+$/;

function makeStats() {
  return {
    name: CASTER,
    level: 20,
    rules: '2024',
    class: { name: wizard.name },
    spellAbilities: { spellCastingAbility: wizard.spell_casting_ability, ...cloneDeep(lv20Bank) },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

// Live mem store (store-faithfulness #1521): consume reads exactly what it wrote; a missing
// key answers null (REAL useRuntimeState.js:74 byte), so the falsy-map rows see store truth.
function liveRuntime(initial = {}) {
  const store = {
    SignatureSpells_selection: [diskFireball.name, diskSlow.name], // signatureSpellsHandler.js:116 [spell1, spell2]
    ...cloneDeep(lv20Bank),
    ...initial,
  };
  getRuntimeValue.mockImplementation((_name, key) => (key in store ? store[key] : null));
  setRuntimeValue.mockImplementation((_name, key, value) => { store[key] = value; });
  return store;
}

// Caller-faithful effective-level gate (useCustomHandlers.js:19-20).
const gate = (spellName, effectiveLevel, stats) =>
  isFreeCastAuthorized(CASTER, spellName, effectiveLevel, stats, CAMPAIGN);

const payWrites = () => setRuntimeValue.mock.calls.filter(c => LADDER.test(String(c[1])));
const latchWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('SignatureSpells_'));

describe('CLA-312 — Signature Spells upcast payment (2024 Wizard lv20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('lv3 authorization falsy-map: fresh latch (absent/null/false) authorizes; spent, off-list and lowercase deny', () => {
    const stats = makeStats();
    liveRuntime();
    expect(gate('Fireball', 3, stats)).toBe(true);                    // absent -> store null -> fresh
    liveRuntime({ [LATCH]: null });
    expect(gate('Fireball', 3, stats)).toBe(true);                    // rest re-arm null = fresh
    liveRuntime({ [LATCH]: false });
    expect(gate('Fireball', 3, stats)).toBe(true);                    // false = fresh (#1512 write byte)
    liveRuntime({ [LATCH]: true });
    expect(gate('Fireball', 3, stats)).toBe(false);                   // spent -> refuse
    liveRuntime();
    expect(gate(diskCounterspell.name, 3, stats)).toBe(false);       // name-exact: off-list lv3 denies
    expect(gate('fireball', 3, stats)).toBe(false);                   // case trail: selection is case-exact
  });

  it('lv4-9 authorization denies every upcast level even with a fresh latch', () => {
    const stats = makeStats();
    liveRuntime();
    for (const lv of [4, 5, 6, 7, 8, 9]) {
      expect(gate('Fireball', lv, stats)).toBe(false);
    }
  });

  it('once-per-rest pair ledger on ONE live store: lv3 free stamps the latch, second lv3 pays the slot', async () => {
    const stats = makeStats();
    const store = liveRuntime();
    const spell = { ...diskFireball };

    const readMark = getRuntimeValue.mock.calls.length;
    const metaCtxIn = {};
    const r1 = await prepareSpellCast(spell, metaCtxIn, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: gate('Fireball', 3, stats),
    });

    expect(r1.freeCastUsed).toBe(true);
    expect(r1.slotConsumed).toBe(false);
    expect(r1.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, freeCastUsed: true, slotConsumed: false });
    expect(setRuntimeValue.mock.calls).toStrictEqual([[CASTER, LATCH, true, CAMPAIGN]]); // exact-of-1: no slot paid alongside
    expect(store[LATCH]).toBe(true);                                    // consume reads what it wrote
    expect(r1.modifiedSpell.level).toBe(3);
    expect('baseLevel' in r1.modifiedSpell).toBe(false);              // no level change -> no baseLevel stamp
    expect(r1.modifiedSpell).not.toBe(spell);
    expect(spell.level).toBe(3);                                      // purity
    expect(metaCtxIn).toStrictEqual({});
    // free-path census (#1519 form): during the cast the ladder was NEVER consulted, and nothing logged
    expect(getRuntimeValue.mock.calls.slice(readMark).filter(c => LADDER.test(String(c[1])))).toEqual([]);
    expect(addEntry).toHaveBeenCalledTimes(0);
    // invocationCallOrder: the selection read precedes the used-stamp write
    const selReadIdx = getRuntimeValue.mock.calls.map(c => c[1]).lastIndexOf('SignatureSpells_selection');
    expect(getRuntimeValue.mock.invocationCallOrder[selReadIdx])
      .toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]); // sole write = the stamp (exact-of-1 above)

    // phase 2 — SAME store: latch now true, authorization live-denies, base lv3 slot pays
    const auth2 = gate('Fireball', 3, stats);
    expect(auth2).toBe(false);                                        // reads the stamped byte back
    const r2 = await prepareSpellCast(spell, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: auth2,
    });
    expect(r2.freeCastUsed).toBe(false);
    expect(r2.slotConsumed).toBe(true);
    expect(payWrites()).toStrictEqual([[CASTER, 'spell_slots_level_3', 2, CAMPAIGN]]); // 3->2, cast level only
    expect(latchWrites()).toHaveLength(1);                        // phase-1 stamp is still the ONLY latch write
    expect(store.spell_slots_level_3).toBe(2);
    expect(r2.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, freeCastUsed: false, slotConsumed: true });
  });

  it.each([4, 5, 6, 7, 9])('lv%d upcast pays spell_slots_level_%d exactly once and leaves the lv3 entitlement intact', async (lv) => {
    const stats = makeStats();
    const store = liveRuntime();
    const bankBefore = store[`spell_slots_level_${lv}`];
    const freeCastAuthorized = gate('Fireball', lv, stats);       // caller gateLevel at the CAST level
    expect(freeCastAuthorized).toBe(false);

    const r = await prepareSpellCast({ ...diskFireball }, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: true, upcastLevel: lv, freeCastAuthorized,
    });

    expect(r.slotConsumed).toBe(true);
    expect(r.freeCastUsed).toBe(false);
    expect(setRuntimeValue.mock.calls).toStrictEqual([[CASTER, `spell_slots_level_${lv}`, bankBefore - 1, CAMPAIGN]]); // exact-of-1, cast-level key (CLA-312 core)
    expect(store[`spell_slots_level_${lv}`]).toBe(bankBefore - 1);
    expect(store[LATCH] ?? null).toBe(null);                      // free-cast key NEVER burned by an upcast
    expect(gate('Fireball', 3, stats)).toBe(true);                // next lv3 cast is still free
    expect(r.modifiedSpell.level).toBe(lv);
    expect(r.modifiedSpell.baseLevel).toBe(3);
    expect(r.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, freeCastUsed: false, slotConsumed: true });
  });

  it('lv5 banked at 0: payment refused, zero writes, lv3 free entitlement survives', async () => {
    const stats = makeStats();
    const store = liveRuntime({ spell_slots_level_5: 0 });
    const freeCastAuthorized = gate('Fireball', 5, stats);
    expect(freeCastAuthorized).toBe(false);

    const spell = { ...diskFireball };
    const r = await prepareSpellCast(spell, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: true, upcastLevel: 5, freeCastAuthorized,
    });

    expect(r.slotConsumed).toBe(false);
    expect(r.freeCastUsed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledTimes(0);               // :723 <=0 deny — never writes -1
    expect(store.spell_slots_level_5).toBe(0);
    expect(store[LATCH] ?? null).toBe(null);                     // refusal did not consume the free cast
    expect(gate('Fireball', 3, stats)).toBe(true);
    expect(r.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, freeCastUsed: false, slotConsumed: false }); // SP-005 carries the refusal truth
    expect(r.modifiedSpell.level).toBe(5);                       // modifiedSpell still upcast — abort is caller-side via metaCtx
    expect(spell.level).toBe(3);
  });
});
