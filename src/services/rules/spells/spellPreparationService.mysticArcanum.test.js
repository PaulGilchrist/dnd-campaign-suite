// @maintained-by-ai
// CLA-231 lane — Mystic Arcanum PREPARATION-PHASE per-level counter key select:
// a lv7 arcanum cast reads/consumes/restores mysticArcanumLevel7, never a lower
// counter. Owned HERE: authorize key-select, prepareSpellCast consume census,
// rollback key-select under twin-spent counters.
// Owned ELSEWHERE (do not regrow): oracle tri-state decisive-FALSE vs continue ->
// spellPreparationService.isFreeCastAuthorized.test.js gate #4 (#1513); increment
// cap-1 / null-coalesce / lv 6..9 gate / membership clamp ->
// spellPreparationService.incrementFreeCastResource.test.js (#1512); sheet grant
// rows -> spellCalc2024-arcanum.test.js; payment mechanics -> spellCalc2024
// arcanum rows (gate #1513 map); long-rest re-arm 'long_rest' recharge bytes ->
// restRules siblings (seam-not-clock).
//
// Disk canon (readFileSync drift-throw below, #1509-1514 streak): 5e spells.json
// Eyebite lv6 / Etherealness lv7 / Power Word Stun lv8; 2024 spells.json same
// bytes. classes.json quirk pinned honestly: 2024 ladder names are exact
// 'Mystic Arcanum (level N spell)' rows L11/13/15/17, while 5e L13/L15 prose
// repeats '6th-level' — the service gate (:536 spellLevel>=6&&<=9) keys off the
// SPELL level byte, never the feature prose, so both rulesets flow identically.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Static mocks — exact-of-6 census of spellPreparationService.js imports
// (:1 useRuntimeState, :2 combatData, :3 concentrationService, :4 storage,
// :5 metamagicRules, :6 logService; :7 castingTimeUtils is pure, unmocked).
// Direct paths only — no barrels (#1475/#1505); unit under test never mocked.
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, incrementFreeCastResource, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ---------------------------------------------------------------------------
// Fixture integrity (#1509-1514): every numeric byte re-verified vs disk here.
// Fabrication-ban census-first: Eyebite / Etherealness / Power Word Stun are
// REAL disk rows; no 'Test Feature' names (#1512 purge canon).
// ---------------------------------------------------------------------------

const diskSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const disk5e = Array.isArray(diskSpells) ? diskSpells : diskSpells.spells;
function diskLevel(name) {
  const row = disk5e.find(s => s.name === name);
  if (!row) throw new Error(`fixture fabrication: '${name}' is not a real disk spell row`);
  return row.level;
}
const EYEBITE = 'Eyebite';
const ETHEREALNESS = 'Etherealness';
const PWS = 'Power Word Stun';
if (!(diskLevel(EYEBITE) === 6 && diskLevel(ETHEREALNESS) === 7 && diskLevel(PWS) === 8)) {
  throw new Error(`fixture drift: disk arcanum spell levels changed (${EYEBITE}/${ETHEREALNESS}/${PWS})`);
}

const PLAYER = 'HexWarlock';
const CAMPAIGN = 'test-campaign'; // lockdown — never an old 'camp' byte (#1514)

function makeWarlockStats() {
  return {
    name: PLAYER,
    class: { name: 'Warlock', arcanums: [EYEBITE, ETHEREALNESS, PWS] },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 5,
    spellAbilities: {
      spellCastingAbility: 'CHA',
      toHit: 8,
      saveDc: 13,
      modifier: 3,
      spell_slots_level_5: 1,
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 70,
  };
}

function makeSpell(name, level) {
  return { name, level, casting_time: '1 action', school: 'Necromancy' };
}

function seed(store) {
  getRuntimeValue.mockImplementation((_player, key) => store[key]);
}

function arcanumReads() {
  return getRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('mysticArcanum'));
}

describe('CLA-231 — Mystic Arcanum per-level counter key select (authorize / consume / rollback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed({});
  });

  describe('isFreeCastAuthorized — key select', () => {
    it('lv7-spent + lv6-armed: lv7 cast DENIES reading only mysticArcanumLevel7, lv6 cast still allows on its own key (pre-fix drained lv6 first)', () => {
      seed({ mysticArcanumLevel6: 1, mysticArcanumLevel7: 0 });
      const stats = makeWarlockStats();
      // sync boolean — no await needed, no Promise leak
      expect(isFreeCastAuthorized(PLAYER, ETHEREALNESS, 7, stats, CAMPAIGN)).toBe(false);
      // the lv7 query consulted ONLY the level-7 key (2-arg read tier, no campaign arg)
      const [last] = arcanumReads().slice(-1);
      expect(last).toEqual([PLAYER, 'mysticArcanumLevel7']);
      expect(last).toHaveLength(2);
      expect(arcanumReads().some(c => c[1] === 'mysticArcanumLevel6')).toBe(false);
      // lv6 arcanum is independent and still armed
      expect(isFreeCastAuthorized(PLAYER, EYEBITE, 6, stats, CAMPAIGN)).toBe(true);
      expect(arcanumReads().some(c => c[1] === 'mysticArcanumLevel6')).toBe(true);
    });

    it('non-member and case-mismatch names never reach the arcanum counter read and deny (#1457 exact-case membership)', () => {
      seed({ mysticArcanumLevel6: 1 });
      const stats = makeWarlockStats();
      expect(isFreeCastAuthorized(PLAYER, 'Circle of Death', 6, stats, CAMPAIGN)).toBe(false);
      expect(isFreeCastAuthorized(PLAYER, 'eyebite', 6, stats, CAMPAIGN)).toBe(false);
      expect(arcanumReads()).toEqual([]); // membership gate :192 short-circuits before any key read
    });
  });

  describe('prepareSpellCast — consume census (exactly one arcanum write, or none)', () => {
    // [spell, level, stored counters, expected FULL setRuntimeValue census, expected arcanum reads]
    const rows = [
      // CLA-231 core: own-level drain, full census — no lv7/slot write on a lv6 cast
      [EYEBITE, 6, { mysticArcanumLevel6: 1, mysticArcanumLevel7: 1 }, [[PLAYER, 'mysticArcanumLevel6', 0, CAMPAIGN]], [[PLAYER, 'mysticArcanumLevel6']]],
      // CLA-231 core: pre-fix [6,7,8,9] loop drained lv6 first — assert lv7 write, zero lv6 writes
      [ETHEREALNESS, 7, { mysticArcanumLevel6: 1, mysticArcanumLevel7: 1 }, [[PLAYER, 'mysticArcanumLevel7', 0, CAMPAIGN]], [[PLAYER, 'mysticArcanumLevel7']]],
      // absent-counter quirk (:557 ?? 1): auto-arms to 1 then consumes to 0 — consumes may go first
      [PWS, 8, {}, [[PLAYER, 'mysticArcanumLevel8', 0, CAMPAIGN]], [[PLAYER, 'mysticArcanumLevel8']]],
      // count>0 guard (:558): READ happens, WRITE does not — no negative ledger even on a contradictory authorize
      [ETHEREALNESS, 7, { mysticArcanumLevel7: 0 }, [], [[PLAYER, 'mysticArcanumLevel7']]],
      // level gate consume face (:554 isMysticArcanumLevel): lv5 name-in-list never reads or writes an arcanum key
      [EYEBITE, 5, { mysticArcanumLevel6: 1 }, [], []],
      // membership gate consume face + case trail: lowercase not a member
      ['eyebite', 6, { mysticArcanumLevel6: 1 }, [], []],
    ];
    it.each(rows)('%s lv%i @ %j', async (spellName, level, store, expectedWrites, expectedReads) => {
      seed(store);
      const stats = makeWarlockStats();
      const spell = makeSpell(spellName, level);
      const res = await prepareSpellCast(spell, {}, {
        playerName: PLAYER,
        playerStats: stats,
        campaignName: CAMPAIGN,
        freeCastAuthorized: true,
      });

      expect(res.freeCastUsed).toBe(true);
      expect(res.slotConsumed).toBe(false);
      expect(res.metaCtx.freeCastUsed).toBe(true);
      expect(res.metaCtx.slotConsumed).toBe(false);
      // FULL write census — exactly the arcanum key(s), nothing else (:556-559)
      expect(setRuntimeValue.mock.calls).toEqual(expectedWrites);
      // read ledger: own-level key, 2-arg tier (no campaign — pre-existing pattern)
      expect(arcanumReads()).toEqual(expectedReads);
      // purity / input immutability (#1511/T4): inputs byte-identical after the cast
      expect(spell).toEqual(makeSpell(spellName, level));
      expect(stats).toEqual(makeWarlockStats());
    });
  });

  describe('incrementFreeCastResource — rollback key select (cap/clamp owned by #1512 sibling)', () => {
    it.each([
      // BOTH counters spent: pre-fix loop hit lv6 first (0 < 1) and restored the WRONG counter
      [ETHEREALNESS, 7, { mysticArcanumLevel6: 0, mysticArcanumLevel7: 0 }, [[PLAYER, 'mysticArcanumLevel7', 1, CAMPAIGN]], [[PLAYER, 'mysticArcanumLevel7']]],
      // membership + case gate on the rollback face (:613-614): lowercase non-member never touches a key
      ['eyebite', 6, { mysticArcanumLevel6: 0 }, [], []],
    ])('rollback %s lv%i @ %j', (spellName, level, store, expectedWrites, expectedReads) => {
      seed(store);
      incrementFreeCastResource(PLAYER, spellName, level, makeWarlockStats(), CAMPAIGN);
      expect(setRuntimeValue.mock.calls).toEqual(expectedWrites);
      expect(arcanumReads()).toEqual(expectedReads);
    });
  });
});
