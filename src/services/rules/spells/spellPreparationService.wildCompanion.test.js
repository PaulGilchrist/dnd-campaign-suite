// @maintained-by-ai
// ---------------------------------------------------------------------------
// spellPreparationService.wildCompanion.test.js — CLA-388 lane: the WILD
// COMPANION paid-grant shared-key auth + consume face of spellPreparationService.
// ROUTED VERBATIM by the BASE MASTER table (spellPreparationService.test.js,
// #1524): 'CLA-388 wild companion paid-grant consume ..... wildCompanion', and
// by the oracle fold-map (isFreeCastAuthorized.test.js, #1513 gate row #8):
// 'shared-key consumption owned by wildCompanion' — re-quoted verbatim by
// uncovered.isFreeCastAuthorized.test.js L5: 'consumption is wildCompanion's
// face' (its L5 pins the GENERIC :116-:118 array mechanics with 'Struct Lane'
// synthetics; REAL disk-row membership + the consume ledger live HERE, never
// there). Stamp side is WildCompanionModal.test.jsx (:43/:60 pay-then-stamp,
// cited not regrown); Long-Rest re-arm is restRules-longRest.wildCompanion
// .test.js (registration + null re-arm owner); FEY-familiar handler face is
// spellCastHandler.wildCompanion.test.js (#1972, L387-389). This lane runs
// NONE of those — it owns only the service's auth gate byte and consume bytes.
//
// SHARED-vs-PERSPELL TOPOLOGY (the #1521 FT-070 contrast, INVERTED — there
// sharing was the bug and per-spell keys are the fix; HERE the shared key IS
// the design because the disk entry names exactly ONE spell):
//   key                       source                store shape        consume byte
//   _Wild_Companion_freeCast  :116 entry.name +   spell-name array   full-clear -> null (:476,
//                             '_freeCast'           ['Find Familiar']   Bewitching consume-shared-
//                                                                      array precedent; NO counter)
//   _Shadow_Magic_<Spell>_    :78 per-spell key   integer count      decrement count-1 (:423-431)
//     freeCastCount           + perSpellTracking    (null = fresh)     — shadowTouched lane, cited
//   Family census (disk is law): the family sharing this ONE latch is EXACTLY
//   {Find Familiar} — disk automation.spell is the single string 'Find Familiar';
//   Speak with Animals/Plants are NOT on the entry, so both the auth :118
//   includes() and the consume :471-:472 some() refuse them (T5 steal-canary).
//
// LATCH ARITHMETIC PINS (fresh/spent canon #1510/#1517): this latch is NOT a
// counter — there is no uses/usesMax coalesce and no decrement. Fresh-paid =
// array armed (stamp by modal, unified campaign-tier auth probe :117 decides); spent = the
// REAL null written by :476 (store-faithful #1517 — null is the production
// consume byte, never undefined); spent-0-equivalent refuses with READ-happens-
// WRITE-silent (#1515 distinction). Re-arm lives ONLY in restRules-constants
// LONG_REST_RESOURCES (#1510-constants family, NO-CLOCK — zero timers here).
//
// ARITY vs REAL (owner unify call, asymmetry CLOSED): the AUTH probe and the
// CONSUME read are BOTH the explicit campaign-tier arity-3 form (:117 and :485
// [name,key,campaign]) and the consume write arity-4 (:487). Both forms are
// byte-pinned per row below — dropping campaignName anywhere dies in the ledgers.
//
// QUIRK SCANS: golden guard-row #1518 console-untouched (no console spies;
// addEntry returns a resolved Promise so the service's unguarded .catch never
// derefs undefined). vacuous self-compute hunt: consumeWildCompanionGrant has
// no self-echo writes (read -> constant null clear, never write-back of what
// it read); the auth shared branch has no name-arm twins (single gate).
// :0-swallow: quantified N/A — the latch has no numeric arm; the only truthy
// gate is `stored &&` at :118, whose falsy set {undefined, null, '', []} all
// deny (absent/null pinned in T2). silent-undefined ?.: the disk row is
// ALWAYS named (T1 drift-throw), so the :116 entry.name deref is census-safe;
// automation-absent stats skip the whole gate #8 scan (`|| []`) -> deny here
// is default-deny, not a crash. 'null + N': none on this lane (no counters).
// Case trails exact everywhere ('Find Familiar' not 'find familiar' — pinned
// deny bytes). Chokepoint extraction: the summons description prose is READ
// from the service bytes at load, instantiated with {playerName,spellName} —
// zero retyped prose (#1362 form). Dead twins, both directions (#1528 Venn):
// disk set {the lv2 classes.json row} <-> code set {free_spell+resourceCost
// match} intersects at exactly one row; the 5e druid has NO Wild Companion and
// feats.json has NO row in either ruleset (censused at load) — membership is
// re-derived HERE, only for this lane's channel. InvocationCallOrder: consume
// read-before-clear pinned in T3. Purity: stats JSON-snapshot EVERY row.
//
// MOCK CENSUS — exact-of-5 boundary mocks of the 7 imports (:1-:7):
// useRuntimeState (mem-backed + __mem handle, store-faithful #1517),
// combatData (null), concentrationService, storage, logService
// (addEntry -> Promise.resolve({}) re-armed in beforeEach — known-dead
// family-wide except the T3 summons row this lane owns). REAL 2:
// metamagicRules + castingTimeUtils (canned-hollowing ban, REAL x3 precedent
// #1523/#1525/#1527 — the Druid fixture has no psionic passive, REAL verdict
// is inert FALSE). The unit-under-test is NEVER mocked. No barrel imports
// (legacy __fixtures__ barrel has zero test consumers — dead-residue report).
// clearRuntimeState dropped (dead-mock: the service imports only get/set).
//
// KILL MATRIX (analytic, #1361 canon — never git): drop consumeWildCompanionGrant
// call (:506) -> T3 write-set/log die (CLA-388 never-consumed revives); drop
// resourceCost gate :471 -> T4b renamed-cost probe consumes (fingerprint dies);
// drop some()-spell check :472 -> T5 sibling cast steals the grant; drop
// Array.isArray :475 -> T4a null-store re-clears + logs; drop includes() :475
// -> T5 steals on any armed array; clear-null swapped to [] at :476 -> T3
// write byte dies; arity-3 read :474 -> 2 -> T3 consume-read tuple dies;
// `stored &&` :118 -> T2 REAL-null deny flips; rename disk feature 'Wild
// Companion' -> T1 key-builder pin + every ledger tuple die (modal :43/:60
// cross-channel stamp breaks with it); :838 free-branch swapped to paid ->
// T3 zero-slot/write-set die.
//
// SECURITY NOTE (#1446 precedent): disk JSON + service source scanned during
// derivation; nothing injection-shaped encountered — quoted text here is
// ownership fold-map prose only. Campaign lockdown: 'test-campaign' is the
// ONLY campaign string in this file (grep-sweep-proof).
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CAMPAIGN = 'test-campaign';
const CASTER = 'WildCompanionDruid';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1528 twenty-lane streak) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const feats5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/feats.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));

const druid2024 = classes2024.find(c => c.name === 'Druid');
const wcFeature = (druid2024?.class_levels?.find(l => l.level === 2)?.features || [])
  .find(f => f.name === 'Wild Companion');
if (!wcFeature?.automation) throw new Error('disk drift: 2024 Druid lv2 Wild Companion row moved in classes.json — re-read the disk');
const WC_AUTO = wcFeature.automation;
// Automation bytes VERBATIM (the CLA-388 latch fingerprint):
if (JSON.stringify(WC_AUTO) !== JSON.stringify({ type: 'free_spell', spell: 'Find Familiar', action: 'action', casting_time: '1 action', resourceCost: 'wild_companion' })) {
  throw new Error('disk drift: Wild Companion automation bytes changed — re-census the lane before editing');
}
// Topology proof: NO counter bytes exist on the row, so gate #8's shared
// _freeCast array (:116-:118) is the ONLY live auth channel, and per-spell
// tracking (#1521 inverse) is disk-absent.
if (['uses', 'usesMax', 'recharge', 'perSpellTracking', 'uses_expression', 'freeCastSpells'].some(k => k in WC_AUTO)) {
  throw new Error('disk drift: Wild Companion automation gained counter/per-spell bytes — latch topology changed, re-route this lane');
}
// Latch prefix derives from entry.name (:116); must equal the modal-stamp byte
// (WildCompanionModal.jsx :43/:60, cited) and the restRules-constants :266 registration.
const GRANT = `_${wcFeature.name.replace(/\s+/g, '_')}_freeCast`;
if (GRANT !== '_Wild_Companion_freeCast') throw new Error(`disk drift: latch key re-derived to '${GRANT}' — modal stamps the old byte`);

const ff2024 = spells2024.find(s => s.name === 'Find Familiar');
const ff5e = spells5e.find(s => s.name === 'Find Familiar');
const swa2024 = spells2024.find(s => s.name === 'Speak with Animals');
if (!ff2024 || ff2024.level !== 1 || ff2024.concentration !== false || ff2024.ritual !== true) throw new Error('disk drift: 2024 Find Familiar row changed — concentration:false is the zero-touch-concentration pin');
if (!ff5e || ff5e.level !== 1 || ff5e.casting_time !== '1 hour' || ff2024.casting_time !== '1 hour or Ritual') throw new Error('disk drift: Find Familiar ruleset casting_time bytes moved (the 2024-only Ritual tag is the census)');
if (!swa2024 || swa2024.level !== 1) throw new Error('disk drift: Speak with Animals sibling row moved — T5 steal-canary spell');

// Census: CLA-388 is a 2024 CLASS FEATURE — feats.json has no row in either
// ruleset, and the 5e druid has no Wild Companion level (fabrication-ban
// proof: the steering hypothesis of a feat-level freeCastSpells/uses row is
// DISK-REFUTED, not restated).
if (feats2024.some(f => f.name === 'Wild Companion') || feats5e.some(f => f.name === 'Wild Companion')) throw new Error('disk drift: Wild Companion became a FEAT — latch topology re-route required');
const druid5e = classes5e.find(c => c.name === 'Druid');
if (druid5e?.class_levels?.some(l => (l.features || []).some(f => f.name === 'Wild Companion'))) throw new Error('disk drift: 5e druid now ships Wild Companion — ruleset census stale');

// Chokepoint extraction (#1362): the summons description prose is READ from
// the service bytes and instantiated — zero retyped prose in assertions.
const SERVICE_SRC = readFileSync(resolve(process.cwd(), 'src/services/rules/spells/spellPreparationService.js'), 'utf8');
const descMatch = SERVICE_SRC.match(/description: `(\$\{playerName\} casts \$\{spellName\} via Wild Companion[^`]*)`/);
if (!descMatch) throw new Error('drift: CLA-388 summons description template moved — re-derive before editing');
const expectedDescription = (spellName) => descMatch[1]
  .replace('${playerName}', CASTER)
  .replace('${spellName}', spellName);

// ── Mock census: exact-of-5 boundary mocks (REAL: metamagicRules + castingTimeUtils) ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  return { setRuntimeValue, getRuntimeValue, __mem: mem };
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

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// Entry as the live builder assembles it: feature name + automation verbatim.
const wcEntry = () => ({ name: wcFeature.name, ...WC_AUTO });

function druidStats(overrides = {}) {
  return {
    name: CASTER,
    rules: '2024',
    level: 2,
    class: { name: 'Druid' },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    spellAbilities: {
      spellCastingAbility: 'Wisdom',
      modifier: 5,
      saveDc: 19,
      spell_slots_level_1: 4,
      spells: [ff2024],
    },
    automation: { actions: [wcEntry()], bonusActions: [], specialActions: [], passives: [] },
    ...overrides,
  };
}

// READ-ONLY oracle census (#1526 cast-helper form): bare boolean, zero writes,
// zero logs, purity, campaign-arity on every campaign-tier read.
function auth(spellName, spellLevel, stats) {
  const frozen = JSON.parse(JSON.stringify(stats));
  const readsBefore = getRuntimeValue.mock.calls.length;
  const verdict = isFreeCastAuthorized(CASTER, spellName, spellLevel, stats, CAMPAIGN);
  expect(verdict instanceof Promise).toBe(false);
  expect(setRuntimeValue).not.toHaveBeenCalled();
  expect(addEntry).not.toHaveBeenCalled();
  expect(stats).toEqual(frozen);
  const reads = getRuntimeValue.mock.calls.slice(readsBefore);
  expect(reads.every(r => r[2] === CAMPAIGN)).toBe(true); // #1520 forward-lock: EVERY read carries the explicit tier
  return { verdict, reads, keys: reads.map(r => r[1]) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mem.clear();
  addEntry.mockReturnValue(Promise.resolve({}));
});

describe('CLA-388 Wild Companion — paid-grant shared-key auth + consume in spellPreparationService (2024 Druid lv2)', () => {
  it('disk law: 2024 classes.json lv2 row is the ONLY Wild Companion channel (feats.json absent both rulesets); automation bytes verbatim and the latch key re-derives to the modal stamp', () => {
    expect(WC_AUTO.resourceCost).toBe('wild_companion');
    expect(WC_AUTO.type).toBe('free_spell');
    expect(WC_AUTO.spell).toBe('Find Familiar'); // single string, not an array — family = exactly {Find Familiar}
    expect(GRANT).toBe('_Wild_Companion_freeCast');
    expect(ff2024.casting_time).toBe('1 hour or Ritual');
    expect(ff5e.casting_time).toBe('1 hour'); // ruleset near-copy distinguished by the 2024 Ritual tag byte
  });

  it('auth gate #8 shared array on the REAL disk entry: armed grants as the deciding campaign-tier probe; absent, REAL-null, non-array, off-name and case-flipped stores all deny', () => {
    mem.set(GRANT, ['Find Familiar']);
    const allow = auth('Find Familiar', 1, druidStats());
    expect(allow.verdict).toBe(true);
    expect(allow.reads[allow.reads.length - 1]).toEqual([CASTER, GRANT, CAMPAIGN]); // :117 unified campaign-tier read decides and HALTS the scan

    // Every falsy/off-list store denies with the probe still made (#1518 `stored &&`
    // + Array.isArray + exact-name includes arms), read-only, never re-armed.
    for (const spent of [undefined, null, 'Find Familiar', ['Speak with Animals']]) {
      mem.clear();
      if (spent !== undefined) mem.set(GRANT, spent);
      const deny = auth('Find Familiar', 1, druidStats());
      expect(deny.verdict, JSON.stringify(spent)).toBe(false);
      expect(deny.keys).toContain(GRANT); // decided-by-CONTINUE into default-deny (#1513 fold), probe always read
    }
    // Case trail: exact-name includes() (:118) — lowercase in an armed store denies,
    // and a lowercase CAST against the armed proper-name store denies too.
    mem.clear();
    mem.set(GRANT, ['find familiar']);
    expect(auth('Find Familiar', 1, druidStats()).verdict).toBe(false);
    mem.clear();
    mem.set(GRANT, ['Find Familiar']);
    expect(auth('find familiar', 1, druidStats()).verdict).toBe(false);
  });

  it('consumes the paid grant exactly once: full-clear to null (arity-3 read before arity-4 write), byte-exact FEY summons row, zero slot ledger', async () => {
    mem.set(GRANT, ['Find Familiar']);
    mem.set('spell_slots_level_1', 4);
    const stats = druidStats();
    const result = await prepareSpellCast(ff2024, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false); // envelope face owned by resource-flow (#1524 master) — branch discriminator only here
    // Exact-of-1 write-set: the single grant clear, campaign carried (:476 arity-4).
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, GRANT, null, CAMPAIGN]]);
    expect(mem.get(GRANT)).toBe(null); // REAL production null — the spent byte T4 re-reads (#1517)
    // Consume read is the same unified campaign-tier arity-3 form as the auth probe.
    const grantReadIdx = getRuntimeValue.mock.calls.findIndex(r => r.length === 3 && r[1] === GRANT);
    expect(grantReadIdx).toBeGreaterThanOrEqual(0);
    expect(getRuntimeValue.mock.invocationCallOrder[grantReadIdx]).toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]);
    // Exact summons row, exact key-set; the ONE permitted weak matcher is the Date.now stamp.
    expect(addEntry.mock.calls).toEqual([[CAMPAIGN, {
      type: 'summons',
      characterName: CASTER,
      summonName: 'Familiar', // hardcoded byte, distinct from spell.name 'Find Familiar' (#1348)
      description: expectedDescription('Find Familiar'),
      summonedCreatures: ['Familiar'],
      timestamp: expect.any(Number),
    }]]);
    expect(addEntry.mock.calls[0][1].description).toContain('FEY');
    expect(addEntry.mock.calls[0][1].description).toContain('disappears when you finish a Long Rest');
    // No spell_slots writes on the whole ledger (write-set is exact-of-1 above):
    expect(mem.get('spell_slots_level_1')).toBe(4);
    // Disk byte concentration:false -> the concentration channel never opens (zero summary reads).
    expect(getCombatSummary).not.toHaveBeenCalled();
  });

  it('CLA-388 cannot-regress: spent-null stays spent and a renamed resourceCost fingerprint authorizes-but-never-consumes — both refuse READ-happens-WRITE-silent', async () => {
    // (a) the REAL post-consume byte: null. Auth re-run denies; even a force-trusted
    // freeCastAuthorized:true cast cannot re-stamp, re-log, or drain anything.
    mem.set(GRANT, null);
    expect(auth('Find Familiar', 1, druidStats()).verdict).toBe(false);
    const forced = await prepareSpellCast(ff2024, {}, {
      playerName: CASTER, playerStats: druidStats(), campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: true,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled(); // :475 Array.isArray(null) guard — write-silent
    expect(addEntry).not.toHaveBeenCalled();
    expect(forced.freeCastUsed).toBe(true); // the unpaid cast runs free of grants; nothing re-arms (#1515 read-vs-write distinction)
    expect(mem.get(GRANT)).toBe(null);

    // (b) STRUCT probe (mutation of the disk bytes, NOT a disk row): rename the
    // resourceCost. Auth never reads :471 — still TRUE; consume never fires — the
    // grant STAYS armed. This asymmetry is the unpaid-unlimited fingerprint: disk
    // resourceCost is the consume channel's identity byte.
    const renamed = { ...druidStats(), automation: { actions: [{ ...wcEntry(), resourceCost: 'wild_shape' }], bonusActions: [], specialActions: [], passives: [] } };
    mem.set(GRANT, ['Find Familiar']);
    expect(auth('Find Familiar', 1, renamed).verdict).toBe(true);
    await prepareSpellCast(ff2024, {}, {
      playerName: CASTER, playerStats: renamed, campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: true,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(mem.get(GRANT)).toEqual(['Find Familiar']); // armed-but-unconsumable — the fingerprint stays visible
  });

  it('family sibling Speak with Animals never touches the shared grant: denied by exact-name gates, and a force-paid attempt leaves the latch armed for Find Familiar (FT-070 #1521 inverse — isolation is the rule)', async () => {
    mem.set(GRANT, ['Find Familiar']);
    expect(auth('Speak with Animals', 1, druidStats()).verdict).toBe(false);
    expect(auth('Speak with Plants', 3, druidStats()).verdict).toBe(false); // lv3 sibling, disk-absent from the entry
    await prepareSpellCast(swa2024, {}, {
      playerName: CASTER, playerStats: druidStats(), campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: true,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled(); // :471-:472 some() spell-name gate — sibling steals nothing
    expect(addEntry).not.toHaveBeenCalled();
    expect(mem.get(GRANT)).toEqual(['Find Familiar']);
    expect(auth('Find Familiar', 1, druidStats()).verdict).toBe(true); // latch survived the refusal, still spendable
  });
});
