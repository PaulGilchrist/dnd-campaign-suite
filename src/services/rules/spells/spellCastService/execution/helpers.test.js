// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  helpers.js BASE lane — shared direct-unit residuals only.         */
/*                                                                    */
/*  Exporter -> owner census (ALL 12 exports of helpers.js):         */
/*   DIVINATION_SCHOOL :15        #1479 helpers-expertDivination     */
/*     (internal use :342; ZERO production importers of the export   */
/*     — dead-export candidate, report-only 🗑, byte lives on disk).  */
/*   refundSpellBreakerSlot :102  #1502 helpers-spellBreaker          */
/*   applyHexEffects :17-73       THIS lane — hexEffects.test.js:11  */
/*     VERBATIM: 'helpers.test.js owns applyHexEffects DIRECT unit    */
/*     bytes (guards, stamps, merged expiry legs)'; :351 VERBATIM    */
/*     'rounds byte itself owned by helpers.test.js' — rounds:600     */
/*     lives here (old :233 -> new :113/:127).                        */
/*   triggerArcaneWard :75-100    SPLIT: seam happy-path exact        */
/*     5-tuple + gate near-misses school/slotless-cantrip/             */
/*     passive_rule-MISMATCH/empty = #1495                            */
/*     spellCastService.featureTriggers.test.js:341-400 (REAL at      */
/*     seam). THIS lane keeps only what that seam cannot reach:       */
/*     :77-80 passives-missing THROW, :97-99 rejection SWALLOW,      */
/*     :81 passive_rule POSITIVE arm, :87 usesSpellSlot-false,       */
/*     :89 slot fallback to disk spell.level.                        */
/*   triggerDispelMagic :170-188 (+privates :109/:128/:153) #1478    */
/*     helpers-dispelMagic                                          */
/*   applyPowerWordHealToTarget :190-275 (+privates) #1481             */
/*     helpers-powerWordHeal                                          */
/*   applyPowerWordKillToTarget :277-334 #1482 helpers-powerWordKill */
/*   triggerExpertDivination :336-379 #1479 helpers-expertDivination */
/*   applyRegenerateSpell :381-491 (+privates :381/:390/:401/:423)   */
/*     helpers-regenerate                                           */
/*   isMagicMissile :493 / getMagicMissileCount :497 /                */
/*     executeMagicMissile :566-618  #1480 helpers-magicMissile +   */
/*     #1503 helpers.sp075-magicMissile-upcast. getMagicMissileCount */
/*     has ZERO production importers (internal :568) — dead-export    */
/*     candidate, report-only 🗑.                                     */
/*                                                                    */
/*  MISSILE-REFS VERDICT: OLD base imported ONLY applyHexEffects +  */
/*  triggerArcaneWard — #1503 :20 claim 'helpers base has zero       */
/*  missile refs' VERIFIED TRUE; nothing to fold-delete.             */
/*                                                                    */
/*  MOCKS: exact 13-of-13 census — every vi.mock below maps 1:1 to  */
/*  helpers.js imports :1-13 (dead-module hunt: 0 dead; never-mock- */
/*  the-unit-under-test: helpers.js runs REAL on every row). 4      */
/*  asserted mocks (runtime/expirations/spellUtils/arcaneWard); the */
/*  other 9 are import-isolation stubs for code paths owned by the */
/*  sub-lanes above — helpers.js cannot load without them resolve.   */
/*                                                                    */
/*  FIXTURES: REAL disk rows — Hex is 2024-only ('5e spells.json    */
/*  has NO Hex row' per #1497), Fireball 2024 Evocation, Arcane     */
/*  Lock 5e lv2, Aid 2024 lv2; existence-census drift-throws below. */
/*  Eldritch Hex passive row bytes match helpers.js:44 + index.js:   */
/*  499 guards and the disk feature classes.json:12570; same          */
/*  synthetic-collector idiom as hexEffects.test.js (#1492 honest    */
/*  non-impersonating). Lowercase 'hex'/'HEX' rows are near-byte    */
/*  case-trail probes for the :18 exact === (#1457), never disk.    */
/*                                                                    */
/*  QUIRK CENSUS: :22 '|| []' store-read fallback killed by seeding  */
/*  getRuntimeValue undefined (not []) on arm 1; :22 read omits the */
/*  campaign arg that the :63 write carries — tuple pin, not bug.   */
/*  :89 `|| spell.level` fallback bytes pinned at 2 both disks.     */
/*  NO-CLOCK: expiry arms here are CLA-107 removal clocks (game-     */
/*  state-free registration face); rounds:600 standing per #1497.    */
/*                                                                    */
/*  KILL-MATRIX (declared analytically; LIVE cp-backup only, NEVER   */
/*  git checkout): 'always-add-save-te' killed by arm-1 exact 1-set  */
/*  + guard-table; 'push-not-replace' killed by positional bystander */
/*  equality; 'stale-ability-survives' killed by ability:DEX byte;   */
/*  'clock-drops-save-leg' killed by arm-2 exact effects census;     */
/*  'rounds-mutant' killed by rounds:600; 'name-lowercase-accepts'   */
/*  killed by case trail; 'throws-removed-at-:77' killed by rejects; */
/*  'rejection-rethrows' killed by A2; 'passive_rule-arm-dropped'    */
/*  killed by A3 r1; ':89 fallback dropped' killed by A3 r3 byte 2.  */
/*                                                                    */
/*  Old->new map: 16 tests -> 5 (basic+Eldritch+both clock rows+     */
/*  both replace rows folded into H1 two-arm full-set table and      */
/*  H2 guard table; arcane happy-path folded out — #1495 seam owns   */
/*  it). Campaign lockdown: test-campaign.                            */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells2024 from '../../../../../../public/data/2024/spells.json';
import spells5e from '../../../../../../public/data/spells.json';

const HEX_DISK = spells2024.find(s => s.name === 'Hex');
if (!HEX_DISK) throw new Error('disk census: Hex row missing from public/data/2024/spells.json');
const FIREBALL24 = spells2024.find(s => s.name === 'Fireball');
if (!FIREBALL24) throw new Error('disk census: Fireball row missing from public/data/2024/spells.json');
const ARCANE_LOCK5E = spells5e.find(s => s.name === 'Arcane Lock');
if (!ARCANE_LOCK5E || ARCANE_LOCK5E.level !== 2) throw new Error('disk census: Arcane Lock lv2 missing from public/data/spells.json');
const AID24 = spells2024.find(s => s.name === 'Aid');
if (!AID24 || AID24.level !== 2) throw new Error('disk census: Aid lv2 missing from public/data/2024/spells.json');

/* ------------------------------------------------------------------ */
/*  Mocks — 1:1 with helpers.js imports :1-13 (exact census, 0 dead) */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));
vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));
vi.mock('../../../features/spellUtils.js', () => ({
  usesSpellSlot: vi.fn(() => true),
}));
vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));
vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));
vi.mock('../../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));
vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
  applyHealingRerollOnes: vi.fn(),
}));
vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));
vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

import {
  applyHexEffects,
  triggerArcaneWard,
} from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../effects/expirations.js';
import { usesSpellSlot } from '../../../features/spellUtils.js';
import { onAbjurationSpellCast } from '../../../../automation/handlers/class-wizard/arcaneWardHandler.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'TestWizard';

function makePlayerStats(passives = []) {
  return {
    name: CASTER,
    level: 10,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    automation: { passives },
  };
}

describe('helpers.js BASE lane', () => {
  let consoleError;
  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    usesSpellSlot.mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* H1 — DIRECT unit census (delegated verbatim by hexEffects:11 and  */
  /* :351). Two arms, full-set equality on BOTH the stored tes and    */
  /* the merged expiry object; arm 1 seeds the store UNDEFINED to      */
  /* kill the :22 '|| []' fallback byte; arm 2 seeds stale legs + a   */
  /* bystander to pin in-place positional replacement and the           */
  /* target/source triple match (:27/:47). No weak matchers: every     */
  /* assertion below is exact-value.                                    */
  it('Hex direct unit: both Eldritch arms write exact full-set tes stamps and arm ONE merged remove_target_effect clock with rounds:600; stale legs replaced in place, bystanders preserved positionally, seed store and inputs never mutated', () => {
    const bystander = { target: 'Goblin', effect: 'sanctuary', source: 'Cleric One' };
    const arms = [
      {
        label: 'base Hex, undefined store (kills :22 ||[] fallback)',
        passives: [],
        seed: undefined,
        expectedStored: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
        ],
        expectedExpiry: [{ type: 'remove_target_effect', effectKey: 'hex_ability_check_disadvantage', source: CASTER, target: 'Goblin' }],
      },
      {
        label: 'Eldritch Hex, stale legs + bystander (in-place replace)',
        passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
        seed: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'STR', duration: 'stale' },
          bystander,
          { target: 'Goblin', effect: 'hex_save_disadvantage', source: CASTER, ability: 'STR', duration: 'stale' },
        ],
        expectedStored: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
          bystander,
          { target: 'Goblin', effect: 'hex_save_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
        ],
        expectedExpiry: [
          { type: 'remove_target_effect', effectKey: 'hex_ability_check_disadvantage', source: CASTER, target: 'Goblin' },
          { type: 'remove_target_effect', effectKey: 'hex_save_disadvantage', source: CASTER, target: 'Goblin' },
        ],
      },
    ];

    for (const { label, passives, seed, expectedStored, expectedExpiry } of arms) {
      vi.mocked(setRuntimeValue).mockClear();
      vi.mocked(addExpiration).mockClear();
      vi.mocked(getRuntimeValue).mockClear();
      const seedCopy = cloneDeep(seed);
      getRuntimeValue.mockImplementation(() => cloneDeep(seed));
      const playerStats = makePlayerStats(passives);
      const spell = cloneDeep(HEX_DISK);

      applyHexEffects(spell, playerStats, CAMPAIGN, 'Goblin', 'DEX');

      // Exact tuple census incl. the store-read quirk :22 (2 args, no
      // campaign) vs the write :63 (4 args, campaign present).
      expect(getRuntimeValue.mock.calls[0], label).toEqual(['campaign', 'targetEffects']);
      expect(setRuntimeValue.mock.calls, label).toEqual([
        ['campaign', 'targetEffects', expectedStored, CAMPAIGN],
      ]);
      expect(addExpiration.mock.calls, label).toEqual([
        [{ attackerName: CASTER, targetName: 'Goblin', effects: expectedExpiry, campaignName: CAMPAIGN, rounds: 600 }],
      ]);
      // Inputs pristine: :23 copies the store; helper must never mutate.
      expect(getRuntimeValue, label).toHaveBeenCalledTimes(1);
      if (seed !== undefined) expect(seed, label).toEqual(seedCopy);
      expect(playerStats.automation.passives, label).toEqual(passives);
      expect(consoleError, label).not.toHaveBeenCalled();
    }
  });

  /* H2 — guard table (:18 name gate incl. #1457 case trail on the   */
  /* exact ===, :20 arg guards). Zero runtime-store READ, zero write, */
  /* zero clock, console untouched (#1360 golden). Falsy coverage:    */
  /* null + '' per guarded arg (#1352 triples, one row each).        */
  it('Hex guards short-circuit before any store read: non-Hex disk row, lowercase/uppercase near-bytes, null/empty target, null/empty ability — zero reads, writes, clocks, console output', () => {
    const rows = [
      { label: 'non-Hex (2024 disk Fireball)', spell: FIREBALL24, target: 'Goblin', ability: 'DEX' },
      { label: 'lowercase near-byte', spell: { name: 'hex' }, target: 'Goblin', ability: 'DEX' },
      { label: 'uppercase near-byte', spell: { name: 'HEX' }, target: 'Goblin', ability: 'DEX' },
      { label: 'target null', spell: HEX_DISK, target: null, ability: 'DEX' },
      { label: 'target empty string', spell: HEX_DISK, target: '', ability: 'DEX' },
      { label: 'ability null', spell: HEX_DISK, target: 'Goblin', ability: null },
      { label: 'ability empty string', spell: HEX_DISK, target: 'Goblin', ability: '' },
    ];
    for (const { label, spell, target, ability } of rows) {
      const snap = cloneDeep({ spell, target, ability });
      applyHexEffects(spell, makePlayerStats(), CAMPAIGN, target, ability);
      expect(getRuntimeValue, label).not.toHaveBeenCalled();
      expect(setRuntimeValue, label).not.toHaveBeenCalled();
      expect(addExpiration, label).not.toHaveBeenCalled();
      expect(consoleError, label).not.toHaveBeenCalled();
      expect({ spell, target, ability }, label).toEqual(snap);
      vi.mocked(getRuntimeValue).mockClear();
    }
  });

  /* A1 — passives-missing THROW (:77-79), unreachable at the #1495  */
  /* seam (its makePlayerStats always supplies an array). Exact throw */
  /* and console bytes; throws BEFORE school/usesSpellSlot gates —   */
  /* zero downstream calls.                                            */
  it('triggerArcaneWard throws the exact passives-required byte and console.errors once when automation is absent, an empty object, or passives:null — before school/slot gates fire', async () => {
    const rows = [
      { label: 'automation absent', stats: { ...makePlayerStats(), automation: undefined } },
      { label: 'automation empty object', stats: { ...makePlayerStats(), automation: {} } },
      { label: 'passives null', stats: makePlayerStats(null) },
    ];
    for (const { label, stats } of rows) {
      await expect(
        triggerArcaneWard(ARCANE_LOCK5E, { slotLevel: 2 }, stats, CAMPAIGN),
        label,
      ).rejects.toThrow('playerStats.automation.passives is required for Arcane Ward');
      expect(consoleError.mock.calls.map(c => c[0]), label).toEqual([
        '[spellCast] triggerArcaneWard: playerStats.automation.passives is missing',
      ]);
      expect(onAbjurationSpellCast, label).not.toHaveBeenCalled();
      expect(usesSpellSlot, label).not.toHaveBeenCalled();
      consoleError.mockClear();
    }
  });

  /* A2 — rejection swallow (:97-99): never a clock, never a rethrow. */
  it('triggerArcaneWard swallows handler rejection: resolves undefined, console.errors the exact prefix once, no rethrow', async () => {
    const err = new Error('ward capacity exceeded');
    onAbjurationSpellCast.mockRejectedValue(err);

    await expect(
      triggerArcaneWard(ARCANE_LOCK5E, { slotLevel: 2 }, makePlayerStats([{ type: 'arcane_ward' }]), CAMPAIGN),
    ).resolves.toBeUndefined();

    expect(onAbjurationSpellCast).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toBe('[spellCast] Arcane Ward trigger failed:');
    expect(consoleError.mock.calls[0][1]).toBe(err);
    // Reset the rejection implementation: clearAllMocks does NOT drop it.
    onAbjurationSpellCast.mockResolvedValue(undefined);
  });

  /* A3 — the three direct arms the #1495 seam near-miss table does   */
  /* NOT reach: passive_rule POSITIVE arm (:81 — the seam proves the  */
  /* mismatch near-miss only), usesSpellSlot-false zero (:87), and     */
  /* metaCtx-without-slotLevel fallback to the disk row's level 2     */
  /* (:89). Exact 5-tuple byte each time it does fire.                 */
  it('triggerArcaneWard direct arms: passive_rule arcane_ward fires once with exact 5-tuple (5e Arcane Lock), usesSpellSlot false fires zero, metaCtx-less cast falls back to 2024 disk Aid lv2 byte', async () => {
    const wardLike = [{ type: 'passive_rule', effect: 'arcane_ward' }];

    // r1 — passive_rule positive arm, explicit slotLevel from 5e disk.
    const stats1 = makePlayerStats(wardLike);
    await triggerArcaneWard(ARCANE_LOCK5E, { slotLevel: 2 }, stats1, CAMPAIGN);
    expect(onAbjurationSpellCast.mock.calls).toEqual([
      [{ name: 'Arcane Ward', automation: { type: 'arcane_ward' } }, stats1, 'Arcane Lock', 2, CAMPAIGN],
    ]);
    expect(usesSpellSlot.mock.calls[0]).toEqual([ARCANE_LOCK5E, { slotLevel: 2 }]);
    expect(consoleError).not.toHaveBeenCalled();

    // r2 — usesSpellSlot false (:87): zero dispatch.
    vi.clearAllMocks();
    usesSpellSlot.mockReturnValue(false);
    await triggerArcaneWard(ARCANE_LOCK5E, { slotLevel: 2 }, makePlayerStats(wardLike), CAMPAIGN);
    expect(onAbjurationSpellCast).not.toHaveBeenCalled();
    usesSpellSlot.mockReturnValue(true);

    // r3 — :89 fallback byte: metaCtx {} -> disk level 2 (2024 disk).
    vi.clearAllMocks();
    const stats3 = makePlayerStats([{ type: 'arcane_ward' }]);
    await triggerArcaneWard(AID24, {}, stats3, CAMPAIGN);
    expect(onAbjurationSpellCast.mock.calls).toEqual([
      [{ name: 'Arcane Ward', automation: { type: 'arcane_ward' } }, stats3, 'Aid', 2, CAMPAIGN],
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
