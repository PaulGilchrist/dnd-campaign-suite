// @maintained-by-ai
// CLA-138 Fey Reinforcements (2024 Ranger/Fey Wanderer lv11) — CAST-time lane in
// spellPreparationService: free-cast latch auth/consume + the no-Concentration quirk.
// Provenance (disk, read via readFileSync below with drift-throw):
//   public/data/2024/classes.json classes[7] Ranger / majors[1] Fey Wanderer /
//   features[3] "Fey Reinforcements" (level 11) automation =
//   {type:'fey_reinforcements', spell:'Summon Fey', uses_expression:'1', usesMax:1,
//    recharge:'long_rest', action:'action', duration:'Concentration, up to 1 hour',
//    casting_time:'passive'};
//   public/data/2024/spells.json "Summon Fey" (lv4, concentration:true,
//   duration:'Concentration, up to 1 hour', summon_spirit → Fey Spirit).
//   5e census (pinned): the feature is ABSENT from public/data/classes.json and
//   'Summon Fey' absent from public/data/spells.json — 2024-only design.
// no-Concentration = DESIGN, not defect. Disk quote (feature description): "Can
// modify it to not require Concentration (duration becomes 1 minute)." The quirk is
// honored ONLY on the free cast itself (source gate: freeCastAuthorized === true &&
// runtime choice === true) and ships on the spell row as exactly three bytes:
// concentration:false, duration:'1 minute', _noConcentrationChoice:true.
// Cannot-regress story (old defect): the OLD handler decremented the latch at arm
// (0) while checkFreeCastEntry demanded >0 on the SAME key — auth was dead and the
// lv4 slot burned despite the popup. Pinned here: fresh/null/armed ALLOW, spent 0
// DENY (strict >0, never >=0), free-never-burns-slot / paid-never-drains-latch.
// Latch canon (#1510/cla130 forms cited): featureFreeCastCount `stored ?? usesMax`
// null-re-arm T1; key bytes are featureFreeCastKey/featureNoConcentrationKey output
// for 'Fey Reinforcements', never retyped; campaign is carried on every WRITE while
// featureFreeCastCount/featureFreeCastKey reads run at the default tier (pre-existing
// pattern — cited, not changed). NO-CLOCK: recharge:'long_rest' is a seam-declared
// rest-rule registered by restRules-constants (owner lane, keys at :194/:197), not a
// wall-clock timer; Date.now() appears only inside log-row timestamps.
// Ownership map (siblings — never duplicated here): arm flow + latch write at usesMax
// + boolean choice stamp owned by FeyReinforcementsModal.test.jsx and
// feyReinforcementsHandler.test.js (confirmFeyReinforcement writes
// noConcentration === true|false — so the armed state is boolean, never absent);
// LR null re-arm registration owned by restRules-constants; row clickability owned by
// automationService.feyReinforcements.test.js. Caller boundary: prepareSpellCast
// trusts the freeCastAuthorized verdict from isFreeCastAuthorized — both lanes pinned
// below with the payment-channel exclusivity between them.
// Fixture integrity: entry + spell fixtures are DERIVED from the real disk rows
// (deep-cloned, zero retype); caster is synthetic ('FeyRanger', non-impersonating).
// Mock census (exact-of-6 module boundaries of the unit-under-test): useRuntimeState,
// combatData, concentrationService, storage, metamagicRules, logService.
// castingTimeUtils is left REAL (pure util, untouched on this feature path). The unit
// itself (spellPreparationService.js) is NEVER mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Disk rows: REAL bytes, drift-throw at load (#1509/#1510 form) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const rangerClass = classes2024.find(c => c.name === 'Ranger');
const feyWanderer = rangerClass?.majors?.find(m => m.name === 'Fey Wanderer');
const diskFeature = feyWanderer?.features?.find(f => f.name === 'Fey Reinforcements');
if (!diskFeature || diskFeature.level !== 11 || diskFeature.automation?.type !== 'fey_reinforcements'
  || diskFeature.automation?.spell !== 'Summon Fey' || diskFeature.automation?.recharge !== 'long_rest') {
  throw new Error('CLA-138 disk drift: 2024 classes.json Ranger/Fey Wanderer lv11 Fey Reinforcements row changed — re-read /majors/1/features[3].automation and update this lane');
}
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const diskSummonFey = spells2024.find(s => s.name === 'Summon Fey');
if (!diskSummonFey || diskSummonFey.level !== 4 || diskSummonFey.concentration !== true
  || diskSummonFey.duration !== 'Concentration, up to 1 hour' || diskSummonFey.ritual !== false) {
  throw new Error('CLA-138 disk drift: 2024 spells.json Summon Fey row changed — re-read the spell row and update this lane');
}
if (readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8').includes('fey_reinforcements')
  || readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8').includes('"Summon Fey"')) {
  throw new Error('CLA-138 census drift: fey_reinforcements/Summon Fey appeared in 5e data (2024-only feature) — re-verify this lane');
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  const clearRuntimeState = vi.fn(() => mem.clear());
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState, __mem: mem };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'FeyRanger', concentration: null }] })),
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

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { setRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';
// featureFreeCastKey / featureNoConcentrationKey output for 'Fey Reinforcements' — real bytes, never retyped.
const LATCH = '_Fey_Reinforcements_freeCastCount';
const CHOICE = '_Fey_Reinforcements_noConcentration';

// Disk-derived fixtures: JSON-clone per call so each cast sees fresh bytes (purity-checkable).
const feyReinforcementsEntry = { name: diskFeature.name, ...JSON.parse(JSON.stringify(diskFeature.automation)) };
const summonFeySpell = () => JSON.parse(JSON.stringify(diskSummonFey));

function rangerStats() {
  return {
    name: CASTER,
    rules: '2024',
    level: 17,
    class: { name: 'Ranger' },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 13, saveDc: 17, modifier: 4, spell_slots_level_4: 3 },
    automation: { actions: [], bonusActions: [], specialActions: [feyReinforcementsEntry], passives: [] },
  };
}

function cast(spell, { freeCastAuthorized }) {
  return prepareSpellCast(spell, {}, {
    playerName: CASTER,
    playerStats: rangerStats(),
    campaignName: CAMPAIGN,
    isUpcast: false,
    freeCastAuthorized,
  });
}

function store(pairs) {
  Object.entries(pairs).forEach(([k, v]) => mem.set(k, v));
}

describe('CLA-138 Fey Reinforcements free-cast auth (fresh/null/armed allow, spent 0 deny)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
  });

  it('authorizes Summon Fey while fresh: key absent or null LR re-arm fall back to usesMax via ?? (never read as spent)', () => {
    expect(isFreeCastAuthorized.length).toBe(5);
    // Fresh (never armed/cast): no runtime key → featureFreeCastCount ?? entry.usesMax=1.
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(true);
    // Long Rest nulls both keys (restRules registration, owner lane); `?? usesMax` re-arms.
    store({ [LATCH]: null });
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(true);
    // Arm-time stamp at usesMax (modal lane owns the write).
    store({ [LATCH]: 1 });
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(true);
  });

  it('denies with a spent latch (strict >0, never >=0) and denies off-entry spells (case-exact name gate)', () => {
    store({ [LATCH]: 0 });
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, rangerStats(), CAMPAIGN)).toBe(false);
    // Spell-name gate: the entry only ever grants 'Summon Fey' (exact bytes).
    store({ [LATCH]: 1 });
    expect(isFreeCastAuthorized(CASTER, 'summon fey', 4, rangerStats(), CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(CASTER, 'Cure Wounds', 4, rangerStats(), CAMPAIGN)).toBe(false);
  });
});

describe('CLA-138 free-cast consume + no-Concentration quirk at the spell row (paid lane excluded)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
  });

  it('unchecked free cast: consumes latch 1→0 and the false choice byte, stamps concentration, never burns the lv4 slot', async () => {
    store({ [LATCH]: 1, [CHOICE]: false, 'spell_slots_level_4': 3 });
    const spell = summonFeySpell();
    const result = await cast(spell, { freeCastAuthorized: true });

    expect(prepareSpellCast.length).toBe(3);
    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.metaCtx.freeCastUsed).toBe(true);
    expect(result.metaCtx.slotConsumed).toBe(false);
    // Default concentration path intact when the choice is armed-but-unchecked.
    expect(result.metaCtx.oldConcentrationSpell).toBe(null);
    expect(result.metaCtx.shouldSetConcentration).toBe(true);
    expect(addConcentration).toHaveBeenCalledTimes(1);
    expect(addConcentration.mock.calls[0].slice(1)).toEqual([CASTER, 'Summon Fey', 17, null]);
    // Exact-of-2 ordered write-set: latch consume precedes choice consume; no slot write.
    expect(setRuntimeValue.mock.calls).toEqual([
      [CASTER, LATCH, 0, CAMPAIGN],
      [CASTER, CHOICE, null, CAMPAIGN],
    ]);
    expect(mem.get(LATCH)).toBe(0);
    expect(mem.get(CHOICE)).toBe(null);
    expect(mem.get('spell_slots_level_4')).toBe(3);
    // Byte-faithful default row — no fabricated stamps.
    expect(result.modifiedSpell).toStrictEqual(spell);
    // Exact-of-1 log row (the decrement happened BEFORE this note — '0 remaining' pins it).
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][0]).toBe(CAMPAIGN);
    const { timestamp, ...logRow } = addEntry.mock.calls[0][1];
    expect(typeof timestamp).toBe('number');
    expect(logRow).toEqual({
      type: 'ability_use',
      characterName: CASTER,
      abilityName: 'Fey Reinforcements',
      spellName: 'Summon Fey',
      note: 'Fey Reinforcements free cast of Summon Fey — no spell slot consumed. 0 free casts remaining until your next Long Rest.',
    });
  });

  it('checked free cast: caster is NOT stamped concentrating; row ships exactly concentration:false + duration:"1 minute" + _noConcentrationChoice:true; latch then choice consumed in order', async () => {
    store({ [LATCH]: 1, [CHOICE]: true, 'spell_slots_level_4': 3 });
    const spell = summonFeySpell();
    const result = await cast(spell, { freeCastAuthorized: true });

    expect(addConcentration).not.toHaveBeenCalled();
    expect(result.metaCtx.shouldSetConcentration).toBe(false);
    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.modifiedSpell).toStrictEqual({
      ...spell,
      concentration: false,
      duration: '1 minute',
      _noConcentrationChoice: true,
    });
    // Purity/fresh-object: the input spell row is never mutated in place.
    expect(result.modifiedSpell).not.toBe(spell);
    expect(spell.concentration).toBe(true);
    expect(spell.duration).toBe('Concentration, up to 1 hour');
    expect(setRuntimeValue.mock.calls).toEqual([
      [CASTER, LATCH, 0, CAMPAIGN],
      [CASTER, CHOICE, null, CAMPAIGN],
    ]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const { timestamp, ...logRow } = addEntry.mock.calls[0][1];
    expect(typeof timestamp).toBe('number');
    expect(logRow).toEqual({
      type: 'ability_use',
      characterName: CASTER,
      abilityName: 'Fey Reinforcements',
      spellName: 'Summon Fey',
      note: 'Fey Reinforcements free cast of Summon Fey — no spell slot consumed. 0 free casts remaining until your next Long Rest. Concentration skipped — duration 1 minute.',
    });
  });

  it('paid cast NEVER enters the free lane: pays the lv4 slot while the armed latch and armed choice survive byte-for-byte', async () => {
    // Latch ARMED (1) and choice armed (true) but the caller pays — pins the
    // freeCastAuthorized === true gate on the quirk AND on the consume lane.
    store({ [LATCH]: 1, [CHOICE]: true, 'spell_slots_level_4': 3 });
    const spell = summonFeySpell();
    const result = await cast(spell, { freeCastAuthorized: false });

    expect(result.slotConsumed).toBe(true);
    expect(result.freeCastUsed).toBe(false);
    expect(result.metaCtx.slotConsumed).toBe(true);
    expect(result.metaCtx.freeCastUsed).toBe(false);
    expect(result.metaCtx.shouldSetConcentration).toBe(true);
    expect(addConcentration).toHaveBeenCalledTimes(1);
    // Exact-of-1 write-set: ONLY the slot payment; latch and choice untouched.
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'spell_slots_level_4', 2, CAMPAIGN]]);
    expect(mem.get(LATCH)).toBe(1);
    expect(mem.get(CHOICE)).toBe(true);
    // The quirk never leaks onto a paid cast — row ships disk bytes unchanged.
    expect(result.modifiedSpell).toStrictEqual(spell);
    // N=0 census: the free-cast consume log never fires on the paid lane
    // (paid-cast logging is owned by the spellCastService execution lane).
    expect(addEntry).not.toHaveBeenCalled();
  });
});
